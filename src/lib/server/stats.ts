import { dev } from '$app/env';
import { client } from '#lib/server/db/index.ts';

/** Same rule as the game: real players only, plus dev/sim plays on a dev server. */
const SOURCES = dev ? ['real', 'dev', 'sim'] : ['real'];

export interface StepStat {
	step: number;
	calls: number;
	ups: number;
	correct: number;
}

export interface Stats {
	number: number;
	players: number;
	finished: number;
	inProfit: number;
	medianCents: number | null;
	bestCents: number | null;
	steps: StepStat[];
	/** Calls per hour for the last 24 hours, oldest first, gaps filled with 0. */
	hourly: { at: number; calls: number }[];
	allTime: { calls: number; games: number; days: number };
	data: {
		priceRows: number;
		tickers: number;
		chunks: number;
		compressionRatio: number | null;
	};
	queryMs: number;
	at: number;
}

// Facts about the price table barely change; refresh them every ten minutes.
let dataCache: { value: Stats['data']; at: number } | null = null;

async function dataFacts(): Promise<Stats['data']> {
	if (dataCache && Date.now() - dataCache.at < 10 * 60_000) return dataCache.value;
	const [row] = await client<
		{ rows: string; tickers: number; chunks: number; before: string | null; after: string | null }[]
	>`
		select
			approximate_row_count('prices') as rows,
			(select count(*)::int from tickers) as tickers,
			(select count(*)::int from show_chunks('prices')) as chunks,
			s.before_compression_total_bytes as before,
			s.after_compression_total_bytes as after
		from hypertable_columnstore_stats('prices') s`;
	const before = Number(row?.before ?? 0);
	const after = Number(row?.after ?? 0);
	const value = {
		priceRows: Number(row?.rows ?? 0),
		tickers: row?.tickers ?? 0,
		chunks: row?.chunks ?? 0,
		compressionRatio: before > 0 && after > 0 ? before / after : null
	};
	dataCache = { value, at: Date.now() };
	return value;
}

export async function statsFor(puzzleNumber: number): Promise<Stats> {
	const started = performance.now();
	const [steps, finals, players, hourly, allTime, data] = await Promise.all([
		client<StepStat[]>`
			select step::int, sum(calls)::int as calls, sum(ups)::int as ups,
				sum(correct)::int as correct
			from crowd_hourly
			where puzzle_number = ${puzzleNumber} and source = any(${SOURCES})
			group by step order by step`,
		client<{ games: number; in_profit: number; median: number | null; best: number | null }[]>`
			select coalesce(sum(games), 0)::int as games,
				coalesce(sum(in_profit), 0)::int as in_profit,
				approx_percentile(0.5, rollup(balance_pct)) as median,
				max(best_cents)::int as best
			from finals_hourly
			where puzzle_number = ${puzzleNumber} and source = any(${SOURCES})`,
		client<{ n: number }[]>`
			select count(*)::int as n from games
			where puzzle_number = ${puzzleNumber} and source = any(${SOURCES})`,
		client<{ at: Date; calls: number }[]>`
			select time_bucket_gapfill('1 hour', bucket) as at,
				coalesce(sum(calls), 0)::int as calls
			from crowd_hourly
			where bucket > now() - interval '24 hours' and bucket <= now()
				and source = any(${SOURCES})
			group by 1 order by 1`,
		client<{ calls: number; games: number; days: number }[]>`
			select coalesce(sum(calls), 0)::int as calls,
				coalesce(sum(calls) filter (where step = 1), 0)::int as games,
				count(distinct day)::int as days
			from crowd_daily
			where source = any(${SOURCES})`,
		dataFacts()
	]);
	const f = finals[0];
	return {
		number: puzzleNumber,
		players: players[0]?.n ?? 0,
		finished: f?.games ?? 0,
		inProfit: f?.in_profit ?? 0,
		medianCents: f?.median == null ? null : Math.round(f.median),
		bestCents: f?.best ?? null,
		steps,
		hourly: hourly.map((h) => ({ at: new Date(h.at).getTime(), calls: h.calls })),
		allTime: allTime[0] ?? { calls: 0, games: 0, days: 0 },
		data,
		queryMs: Math.round((performance.now() - started) * 10) / 10,
		at: Date.now()
	};
}
