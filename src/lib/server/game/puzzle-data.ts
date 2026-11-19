import { error } from '@sveltejs/kit';
import { asc, eq, gte, lt, sql } from 'drizzle-orm';
import { PUZZLE_SECRET } from '$app/env/private';
import { db } from '#lib/server/db/index.ts';
import { puzzles, schedule } from '#lib/server/db/schema.ts';
import type { Direction } from '#lib/game/economy.ts';
import { nextSlug } from './schedule-order.ts';

export interface PuzzleData {
	slug: string;
	ticker: string;
	headline: string;
	story: string;
	contextBars: number;
	stepBars: number;
	calls: number;
	dates: string[];
	closes: number[];
	/** Closes as quoted on the day (later splits undone), for display at the reveal. */
	quoted: number[];
	/** Outcome of each call, 1-based step at index step - 1. */
	outcomes: Direction[];
	/** Percent move of each stretch. */
	moves: number[];
	/** Where the price was about a year after the last stretch, if it still traded. */
	hindsight: { date: string; close: number; change: number } | null;
}

/** Tickers that were renamed after delisting: show the symbol people knew at the time. */
const DISPLAY_TICKER: Record<string, string> = { BBBYQ: 'BBBY', SIVBQ: 'SIVB' };

type Shape = Pick<PuzzleData, 'contextBars' | 'stepBars' | 'calls'>;

/** Index (into `closes`) of the last bar visible before call `step` is made (step is 1-based). */
export function lastVisibleIndex(p: Shape, step: number) {
	return p.contextBars - 1 + (step - 1) * p.stepBars;
}

/** Each call's outcome, and its stretch's move in percent to one decimal. */
export function outcomesFor(closes: number[], p: Shape) {
	const outcomes: Direction[] = [];
	const moves: number[] = [];
	for (let step = 1; step <= p.calls; step++) {
		const from = closes[lastVisibleIndex(p, step)];
		const to = closes[lastVisibleIndex(p, step + 1)];
		outcomes.push(to > from ? 'up' : 'down');
		moves.push(Math.round(((to - from) / from) * 1000) / 10);
	}
	return { outcomes, moves };
}

/** Visible closes before call `callsMade + 1`, normalised so the last context close is 100. */
export function visibleBars(p: Shape & Pick<PuzzleData, 'closes'>, callsMade: number): number[] {
	const end = callsMade >= p.calls ? p.closes.length : lastVisibleIndex(p, callsMade + 1) + 1;
	const base = p.closes[p.contextBars - 1];
	return p.closes.slice(0, end).map((c) => Math.round((c / base) * 1000) / 10);
}

async function load(slug: string): Promise<PuzzleData> {
	const [p] = await db.select().from(puzzles).where(eq(puzzles.slug, slug));
	if (!p) throw new Error(`No puzzle ${slug}`);
	const after = p.calls * p.stepBars;
	const [window, later, splitRows] = await Promise.all([
		db.execute<{ ts: string; close: number }>(sql`
			(select ts::text as ts, close from prices
				where ticker = ${p.ticker} and ts <= ${p.lastContextDate}
				order by ts desc limit ${p.contextBars})
			union all
			(select ts::text as ts, close from prices
				where ticker = ${p.ticker} and ts > ${p.lastContextDate}
				order by ts limit ${after})
			order by ts`),
		// The latest close within a year of the puzzle's last bar.
		db.execute<{ ts: string; close: number }>(sql`
			with last_bar as (
				select max(ts) as ts from (
					select ts from prices
					where ticker = ${p.ticker} and ts > ${p.lastContextDate}
					order by ts limit ${after}
				) stretch
			)
			select prices.ts::text as ts, close from prices, last_bar
			where ticker = ${p.ticker} and prices.ts > last_bar.ts
				and prices.ts <= last_bar.ts + interval '1 year'
			order by prices.ts desc limit 1`),
		db.execute<{ ts: string; factor: number }>(
			sql`select ts::text as ts, factor from splits where ticker = ${p.ticker}`
		)
	]);
	const rows = window.rows;
	if (rows.length !== p.contextBars + after) {
		throw new Error(
			`Puzzle ${p.slug}: expected ${p.contextBars + after} bars, found ${rows.length}`
		);
	}
	const closes = rows.map((r) => r.close);
	const { outcomes, moves } = outcomesFor(closes, p);
	// Undo later splits for display: the price as it was quoted on that day.
	const quotedOn = (date: string, adjusted: number) =>
		splitRows.rows.reduce((v, s) => (s.ts > date ? v * s.factor : v), adjusted);

	// Only counted if the ticker was still trading near the one-year mark.
	const end = rows[rows.length - 1].ts;
	const year = later.rows[0];
	const hindsight =
		year && Date.parse(year.ts) >= Date.parse(end) + 330 * 86_400_000
			? {
					date: year.ts,
					close: quotedOn(year.ts, year.close),
					change: Math.round((year.close / closes[closes.length - 1] - 1) * 1000) / 10
				}
			: null;
	return {
		slug: p.slug,
		ticker: DISPLAY_TICKER[p.ticker] ?? p.ticker,
		headline: p.headline,
		story: p.story,
		contextBars: p.contextBars,
		stepBars: p.stepBars,
		calls: p.calls,
		dates: rows.map((r) => r.ts),
		closes,
		quoted: rows.map((r, i) => quotedOn(r.ts, closes[i])),
		outcomes,
		moves,
		hindsight
	};
}

// A puzzle and a day's schedule entry never change once written, so a Worker isolate keeps what
// it has loaded. Only settled values are kept: Workers forbid awaiting another request's I/O.
const bySlug = new Map<string, PuzzleData>();
const slugByNumber = new Map<number, string>();

/**
 * The slug for daily number `number`. The first request for a number writes it into `schedule`
 * (the first writer wins); after that the day's puzzle never changes.
 */
async function slugFor(number: number): Promise<string> {
	const [hit] = await db
		.select({ slug: schedule.slug })
		.from(schedule)
		.where(eq(schedule.number, number));
	if (hit) return hit.slug;
	const [active, earlier] = await Promise.all([
		db
			.select({ slug: puzzles.slug })
			.from(puzzles)
			.where(gte(puzzles.position, 0))
			.orderBy(asc(puzzles.position)),
		db
			.select({ slug: schedule.slug })
			.from(schedule)
			.where(lt(schedule.number, number))
			.orderBy(asc(schedule.number))
	]);
	if (active.length === 0) error(503, 'No puzzles loaded yet');
	const slug = nextSlug(
		number,
		active.map((a) => a.slug),
		earlier.map((e) => e.slug),
		PUZZLE_SECRET
	);
	const [row] = await db
		.insert(schedule)
		.values({ number, slug })
		.onConflictDoUpdate({ target: schedule.number, set: { slug: sql`${schedule.slug}` } })
		.returning({ slug: schedule.slug });
	return row.slug;
}

/** The puzzle for daily number `number`. */
export async function puzzleForNumber(number: number): Promise<PuzzleData> {
	const slug = slugByNumber.get(number) ?? (await slugFor(number));
	slugByNumber.set(number, slug);
	const puzzle = bySlug.get(slug) ?? (await load(slug));
	bySlug.set(slug, puzzle);
	return puzzle;
}
