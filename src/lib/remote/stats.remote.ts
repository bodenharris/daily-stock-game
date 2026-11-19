import { getRequestEvent, query } from '$app/server';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { FINISH_BUCKET_CENTS, FINISH_CAP_CENTS, START_BALANCE_CENTS } from '#lib/game/config.ts';
import type { Direction } from '#lib/game/economy.ts';
import { exactStanding, type Standing } from '#lib/play/standing.ts';
import type { FinishBucket } from '#lib/play/types.ts';
import { db } from '#lib/server/db/index.ts';
import { games, guesses } from '#lib/server/db/schema.ts';
import { loadToday } from '#lib/server/game/play.ts';

interface CallSplit {
	step: number;
	calls: number;
	ups: number;
	/** Which way the chart actually went. */
	answer: Direction;
	/** Which way the viewer called it. */
	you: Direction | null;
}

interface LiveStats {
	number: number;
	players: number;
	finished: number;
	inProfit: number;
	medianCents: number | null;
	bestCents: number | null;
	/** Today's finishes in $10 buckets, lowest first; only non-empty buckets. */
	finishes: FinishBucket[];
	/** Calls per hour for the last 24 hours, oldest first, gaps filled with 0. */
	hourly: { at: number; calls: number }[];
	data: { priceRows: number; tickers: number };
	/** How long the stats statement took, in ms. */
	queryMs: number;
	/**
	 * Today's per-call crowd split and the right answer. Null until the viewer has finished
	 * today's game, so nobody can look up the split and pick the minority side.
	 */
	calls: CallSplit[] | null;
	/** The viewer's own finish today, ranked by the same exact rule as the game's end screen. */
	you: (Standing & { balanceCents: number }) | null;
}

type StatsRow = {
	players: number;
	finished: number;
	in_profit: number;
	median: number | null;
	best: number | null;
	above: number;
	finishes: FinishBucket[];
	steps: { step: number; calls: number; ups: number }[];
	hourly: { at: number; calls: number }[];
	price_rows: number;
	tickers: number;
};

/** Everything on the page in one statement, over one day of `games` and their calls. */
async function statsFor(puzzleNumber: number, myBalanceCents: number | null) {
	const started = performance.now();
	const {
		rows: [row]
	} = await db.execute<StatsRow>(sql`
		with day as (
			select balance_cents, finished_at from games
			where puzzle_number = ${puzzleNumber}
		), done as (
			select balance_cents from day where finished_at is not null
		), steps as (
			select guesses.step, count(*)::int as calls, (count(*) filter (where up))::int as ups
			from guesses join games on games.id = guesses.game_id
			where games.puzzle_number = ${puzzleNumber}
			group by guesses.step
		), buckets as (
			select least(balance_cents / ${FINISH_BUCKET_CENTS} * ${FINISH_BUCKET_CENTS},
					${FINISH_CAP_CENTS})::int as cents,
				count(*)::int as count
			from done group by 1
		), hours as (
			select generate_series(date_trunc('hour', now()) - interval '23 hours',
				date_trunc('hour', now()), interval '1 hour') as at
		), hourly as (
			select hours.at, count(guesses.game_id)::int as calls
			from hours
			left join guesses on guesses.ts >= hours.at and guesses.ts < hours.at + interval '1 hour'
			group by hours.at
		)
		select
			(select count(*)::int from day) as players,
			(select count(*)::int from done) as finished,
			(select (count(*) filter (where balance_cents > ${START_BALANCE_CENTS}))::int from done) as in_profit,
			(select percentile_cont(0.5) within group (order by balance_cents) from done) as median,
			(select max(balance_cents) from done) as best,
			(select (count(*) filter (where balance_cents > ${myBalanceCents}::int))::int from done) as above,
			(select coalesce(json_agg(b order by b.cents), '[]') from buckets b) as finishes,
			(select coalesce(json_agg(s order by s.step), '[]') from steps s) as steps,
			(select json_agg(json_build_object('at', (extract(epoch from h.at) * 1000)::bigint,
				'calls', h.calls) order by h.at) from hourly h) as hourly,
			(select sum(bars)::int from tickers) as price_rows,
			(select count(*)::int from tickers) as tickers`);
	return { row, queryMs: Math.round((performance.now() - started) * 10) / 10 };
}

/** The viewer's finished game for a puzzle, with the way they called each step. */
async function finishedGame(userId: string | undefined, puzzleNumber: number) {
	if (!userId) return null;
	const [row] = await db
		.select({
			balanceCents: games.balanceCents,
			ups: sql<boolean[]>`array_agg(${guesses.up} order by ${guesses.step})`
		})
		.from(games)
		.innerJoin(guesses, eq(guesses.gameId, games.id))
		.where(
			and(
				eq(games.userId, userId),
				eq(games.puzzleNumber, puzzleNumber),
				isNotNull(games.finishedAt)
			)
		)
		.groupBy(games.id);
	if (!row) return null;
	return {
		puzzle: puzzleNumber,
		balanceCents: row.balanceCents,
		directions: row.ups.map((up): Direction => (up ? 'up' : 'down'))
	};
}

/**
 * Live stats for today's puzzle. The page refreshes this every few seconds while it is visible:
 * short requests, not a stream, so a failed tick only skips that tick and nothing stays open.
 */
export const liveStats = query(async (): Promise<LiveStats> => {
	const today = await loadToday();
	// Only today's finish counts, so a page left open past midnight stops showing the new day's
	// answers until the viewer finishes that one too.
	const mine = await finishedGame(getRequestEvent().locals.user?.id, today.number);
	const { row, queryMs } = await statsFor(today.number, mine?.balanceCents ?? null);
	return {
		number: today.number,
		players: row.players,
		finished: row.finished,
		inProfit: row.in_profit,
		medianCents: row.median == null ? null : Math.round(row.median),
		bestCents: row.best,
		finishes: row.finishes,
		hourly: row.hourly,
		data: { priceRows: row.price_rows, tickers: row.tickers },
		queryMs,
		calls: mine
			? today.puzzle.outcomes.map((answer, i) => {
					const s = row.steps.find((x) => x.step === i + 1);
					return {
						step: i + 1,
						calls: s?.calls ?? 0,
						ups: s?.ups ?? 0,
						answer,
						you: mine.directions[i] ?? null
					};
				})
			: null,
		you: mine
			? { balanceCents: mine.balanceCents, ...exactStanding(row.above + 1, row.finished) }
			: null
	};
});
