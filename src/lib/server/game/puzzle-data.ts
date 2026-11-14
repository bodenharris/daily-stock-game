import { asc, eq, gte, lt } from 'drizzle-orm';
import { client, db } from '#lib/server/db/index.ts';
import { puzzles, schedule } from '#lib/server/db/schema.ts';
import { nextSlug } from './schedule-order.ts';
import type { Direction } from '#lib/play/types.ts';

export interface PuzzleData {
	slug: string;
	ticker: string;
	company: string;
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
	hindsight: Hindsight | null;
}

export interface Hindsight {
	date: string;
	close: number;
	/** Percent change from the last bar of the puzzle. */
	change: number;
}

/** Tickers that were renamed after delisting: show the symbol people knew at the time. */
const DISPLAY_TICKER: Record<string, string> = { BBBYQ: 'BBBY', SIVBQ: 'SIVB' };

/** Index (into `closes`) of the last bar visible before call `step` is made (step is 1-based). */
export function lastVisibleIndex(p: Pick<PuzzleData, 'contextBars' | 'stepBars'>, step: number) {
	return p.contextBars - 1 + (step - 1) * p.stepBars;
}

/** Work out the outcome of every stretch from the closes. */
export function outcomesFor(
	closes: number[],
	contextBars: number,
	stepBars: number,
	calls: number
): { outcomes: Direction[]; moves: number[] } {
	const outcomes: Direction[] = [];
	const moves: number[] = [];
	for (let step = 1; step <= calls; step++) {
		const from = closes[contextBars - 1 + (step - 1) * stepBars];
		const to = closes[contextBars - 1 + step * stepBars];
		outcomes.push(to > from ? 'up' : 'down');
		moves.push(Math.round(((to - from) / from) * 1000) / 10);
	}
	return { outcomes, moves };
}

// Puzzles never change once loaded, so keep them in memory: a call never waits on the
// price table twice for the same puzzle.
const bySlug = new Map<string, Promise<PuzzleData>>();
const byNumber = new Map<number, Promise<PuzzleData>>();

async function load(slug: string): Promise<PuzzleData> {
	const [p] = await db.select().from(puzzles).where(eq(puzzles.slug, slug));
	if (!p) throw new Error(`No puzzle ${slug}`);
	const after = p.calls * p.stepBars;
	const rows = await client<{ ts: string; close: number }[]>`
		(select ts::text as ts, close from prices
			where ticker = ${p.ticker} and ts <= ${p.lastContextDate}
			order by ts desc limit ${p.contextBars})
		union all
		(select ts::text as ts, close from prices
			where ticker = ${p.ticker} and ts > ${p.lastContextDate}
			order by ts asc limit ${after})
		order by ts`;
	if (rows.length !== p.contextBars + after) {
		throw new Error(
			`Puzzle ${p.slug}: expected ${p.contextBars + after} bars, found ${rows.length}`
		);
	}
	const closes = rows.map((r) => Number(r.close));
	const { outcomes, moves } = outcomesFor(closes, p.contextBars, p.stepBars, p.calls);
	const end = rows[rows.length - 1];
	// TimescaleDB's last() hyperfunction: the latest close within a year of the puzzle's end.
	// Only counted if the ticker was still trading near the one-year mark.
	const [later] = await client<{ close: number | null; ts: string | null }[]>`
		select last(close, ts) as close, last(ts, ts)::text as ts from prices
		where ticker = ${p.ticker} and ts > ${end.ts}::date
			and ts <= ${end.ts}::date + interval '1 year'`;
	const splitRows = await client<{ ts: string; factor: number }[]>`
		select ts::text as ts, factor from splits
		where ticker = ${p.ticker} and ts > ${rows[0].ts}::date`;
	// Undo later splits for display: the price as it was quoted on that day.
	const quotedOn = (date: string, adjusted: number) =>
		splitRows.reduce((v, s) => (s.ts > date ? v * Number(s.factor) : v), adjusted);
	const quoted = rows.map((r, i) => quotedOn(r.ts, closes[i]));

	const lastClose = closes[closes.length - 1];
	const yearOn = Date.parse(end.ts) + 330 * 86_400_000;
	const hindsight =
		later?.close != null && later.ts != null && Date.parse(later.ts) >= yearOn
			? {
					date: later.ts,
					close: quotedOn(later.ts, Number(later.close)),
					change: Math.round((Number(later.close) / lastClose - 1) * 1000) / 10
				}
			: null;
	return {
		slug: p.slug,
		ticker: DISPLAY_TICKER[p.ticker] ?? p.ticker,
		company: p.company,
		headline: p.headline,
		story: p.story,
		contextBars: p.contextBars,
		stepBars: p.stepBars,
		calls: p.calls,
		dates: rows.map((r) => r.ts),
		closes,
		quoted,
		outcomes,
		moves,
		hindsight
	};
}

function cached<K>(map: Map<K, Promise<PuzzleData>>, key: K, make: () => Promise<PuzzleData>) {
	let hit = map.get(key);
	if (!hit) {
		hit = make();
		hit.catch(() => map.delete(key));
		map.set(key, hit);
	}
	return hit;
}

/** Puzzle data by slug. Cached for the life of the process. */
export function puzzleBySlug(slug: string): Promise<PuzzleData> {
	return cached(bySlug, slug, () => load(slug));
}

/**
 * The puzzle for daily number `number`. The first request for a number writes it into the
 * `schedule` table; after that the day's puzzle never changes.
 */
export function puzzleForNumber(number: number, secret: string): Promise<PuzzleData> {
	return cached(byNumber, number, async () => {
		const [hit] = await db.select().from(schedule).where(eq(schedule.number, number));
		if (hit) return puzzleBySlug(hit.slug);
		const active = await db
			.select({ slug: puzzles.slug })
			.from(puzzles)
			.where(gte(puzzles.position, 0))
			.orderBy(asc(puzzles.position));
		if (active.length === 0) throw new Error('No puzzles loaded yet');
		// Everything scheduled before this number, oldest first, so the pick never repeats a puzzle
		// inside a pass however the catalog has grown.
		const earlier = await db
			.select({ slug: schedule.slug })
			.from(schedule)
			.where(lt(schedule.number, number))
			.orderBy(asc(schedule.number));
		const slug = nextSlug(
			number,
			active.map((a) => a.slug),
			earlier.map((e) => e.slug),
			secret
		);
		await db.insert(schedule).values({ number, slug }).onConflictDoNothing();
		const [row] = await db.select().from(schedule).where(eq(schedule.number, number));
		return puzzleBySlug(row.slug);
	});
}

/** Visible closes before call `nextStep`, normalised so the last context close is 100. */
export function visibleBars(p: PuzzleData, callsMade: number): number[] {
	const end = callsMade >= p.calls ? p.closes.length : lastVisibleIndex(p, callsMade + 1) + 1;
	const base = p.closes[p.contextBars - 1];
	return p.closes.slice(0, end).map((c) => Math.round((c / base) * 1000) / 10);
}
