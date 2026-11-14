import { dev } from '$app/env';
import { PLAY_SOURCE } from '$app/env/private';
import { client } from '#lib/server/db/index.ts';

/** Same rule as the game: real players only, plus dev/sim plays on a dev server. */
const SOURCES =
	(PLAY_SOURCE ?? (dev ? 'dev' : 'real')) === 'dev' ? ['real', 'dev', 'sim'] : ['real'];

export interface StepStat {
	step: number;
	calls: number;
	ups: number;
}

export interface Stats {
	number: number;
	players: number;
	finished: number;
	inProfit: number;
	medianCents: number | null;
	bestCents: number | null;
	/** Today's crowd split per call. Only ever sent to viewers who finished today's game. */
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
	/** How long the live statement took on the database, in ms. */
	queryMs: number;
	at: number;
}

/**
 * A small shared cache: every caller asking for the same key within `ttlMs` of the last result
 * gets the same promise, and callers arriving while a load is running join it instead of
 * starting another. Failed loads are forgotten so the next caller retries.
 */
function shared<K, V>(ttlMs: number, load: (key: K) => Promise<V>): (key: K) => Promise<V> {
	const entries = new Map<K, { settledAt: number; value: Promise<V> }>();
	return (key) => {
		const now = Date.now();
		const hit = entries.get(key);
		if (hit && now - hit.settledAt < ttlMs) return hit.value;
		for (const [k, e] of entries) if (now - e.settledAt >= ttlMs) entries.delete(k);
		const entry = { settledAt: Infinity, value: load(key) };
		entries.set(key, entry);
		entry.value.then(
			() => {
				entry.settledAt = Date.now();
			},
			() => {
				if (entries.get(key) === entry) entries.delete(key);
			}
		);
		return entry.value;
	};
}

// Facts about the price table barely change; refresh them every ten minutes. The row count is
// exact: approximate_row_count() only sees uncompressed rows, so it undercounts the columnstore.
const dataFacts = shared<'prices', Stats['data']>(10 * 60_000, async () => {
	const [row] = await client<
		{ rows: string; tickers: number; chunks: number; before: string | null; after: string | null }[]
	>`
		select
			(select count(*) from prices) as rows,
			(select count(*)::int from tickers) as tickers,
			(select count(*)::int from show_chunks('prices')) as chunks,
			s.before_compression_total_bytes as before,
			s.after_compression_total_bytes as after
		from hypertable_columnstore_stats('prices') s`;
	const before = Number(row?.before ?? 0);
	const after = Number(row?.after ?? 0);
	return {
		priceRows: Number(row?.rows ?? 0),
		tickers: row?.tickers ?? 0,
		chunks: row?.chunks ?? 0,
		compressionRatio: before > 0 && after > 0 ? before / after : null
	};
});

interface LiveRow {
	players: number;
	games: number;
	in_profit: number;
	median: number | null;
	best: number | null;
	steps: StepStat[];
	hourly: { at: number; calls: number }[];
	all_calls: number;
	all_games: number;
	all_days: number;
}

/**
 * Everything live on the page in one statement, so a tick holds one pooled connection (the pool
 * is shared with gameplay) and pays one round trip. All of it reads continuous aggregates except
 * the player count, which is an index lookup on `games`.
 */
async function liveStatsFor(puzzleNumber: number): Promise<Stats> {
	const started = performance.now();
	const [[row], data] = await Promise.all([
		client<LiveRow[]>`
			with steps as (
				select step::int as step, sum(calls)::int as calls, sum(ups)::int as ups
				from crowd_hourly
				where puzzle_number = ${puzzleNumber} and source = any(${SOURCES})
				group by step
			), finals as (
				select coalesce(sum(games), 0)::int as games,
					coalesce(sum(in_profit), 0)::int as in_profit,
					approx_percentile(0.5, rollup(balance_pct)) as median,
					max(best_cents)::int as best
				from finals_hourly
				where puzzle_number = ${puzzleNumber} and source = any(${SOURCES})
			), hourly as (
				select time_bucket_gapfill('1 hour', bucket, now() - interval '23 hours', now()) as at,
					coalesce(sum(calls), 0)::int as calls
				from crowd_hourly
				where bucket > now() - interval '24 hours' and bucket <= now()
					and source = any(${SOURCES})
				group by 1
			), all_time as (
				select coalesce(sum(calls), 0)::int as all_calls,
					coalesce(sum(calls) filter (where step = 1), 0)::int as all_games,
					count(distinct day)::int as all_days
				from crowd_daily
				where source = any(${SOURCES})
			)
			select
				(select count(*)::int from games
					where puzzle_number = ${puzzleNumber} and source = any(${SOURCES})) as players,
				f.games, f.in_profit, f.median, f.best,
				(select coalesce(json_agg(s order by s.step), '[]') from steps s) as steps,
				(select coalesce(json_agg(json_build_object(
					'at', (extract(epoch from h.at) * 1000)::bigint, 'calls', h.calls) order by h.at), '[]')
					from hourly h) as hourly,
				a.all_calls, a.all_games, a.all_days
			from finals f, all_time a`,
		dataFacts('prices')
	]);
	const queryMs = Math.round((performance.now() - started) * 10) / 10;
	return {
		number: puzzleNumber,
		players: row?.players ?? 0,
		finished: row?.games ?? 0,
		inProfit: row?.in_profit ?? 0,
		medianCents: row?.median == null ? null : Math.round(row.median),
		bestCents: row?.best ?? null,
		steps: row?.steps ?? [],
		hourly: (row?.hourly ?? []).map((h) => ({ at: Number(h.at), calls: h.calls })),
		allTime: {
			calls: row?.all_calls ?? 0,
			games: row?.all_games ?? 0,
			days: row?.all_days ?? 0
		},
		data,
		queryMs,
		at: Date.now()
	};
}

const sharedStats = shared(3_000, liveStatsFor);

/**
 * Stats for a puzzle, computed at most once every 3 seconds however many pages are open:
 * every open stats page reads the same tick.
 */
export function statsFor(puzzleNumber: number): Promise<Stats> {
	return sharedStats(puzzleNumber);
}

export interface Standing {
	/** Share (0–1) of today's other finishers this balance beat; null if nobody else finished. */
	betterThan: number | null;
	/** Finished games today, including this one. */
	finished: number;
}

const sharedRank = shared(10_000, async (key: string): Promise<Standing> => {
	const [puzzleNumber, balanceCents] = key.split(':').map(Number);
	const [row] = await client<{ rank: number | null; games: number }[]>`
		select approx_percentile_rank(${balanceCents}, rollup(balance_pct)) as rank,
			coalesce(sum(games), 0)::int as games
		from finals_hourly
		where puzzle_number = ${puzzleNumber} and source = any(${SOURCES})`;
	const finished = row?.games ?? 0;
	if (!row || row.rank == null || finished < 2) return { betterThan: null, finished };
	// The sketch counts the viewer among those at or below their balance; leave them out.
	const below = (row.rank * finished - 1) / (finished - 1);
	return { betterThan: Math.min(1, Math.max(0, below)), finished };
});

/**
 * Share of today's other finishers (0–1) that a final balance beat, read from the Toolkit
 * percentile sketch in `finals_hourly`. Null when nobody else has finished yet. Shared per
 * balance for 10 seconds, so a page left open costs almost nothing.
 */
export async function betterThan(
	puzzleNumber: number,
	balanceCents: number
): Promise<number | null> {
	return (await sharedRank(`${puzzleNumber}:${balanceCents}`)).betterThan;
}

/** Where a final balance stands among today's finishers (same shared, cached query). */
export function standingOf(puzzleNumber: number, balanceCents: number): Promise<Standing> {
	return sharedRank(`${puzzleNumber}:${balanceCents}`);
}
