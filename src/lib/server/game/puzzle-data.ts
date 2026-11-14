import { asc, eq, gte } from 'drizzle-orm';
import { client, db } from '#lib/server/db/index.ts';
import { puzzles } from '#lib/server/db/schema.ts';
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
	/** Outcome of each call, 1-based step at index step - 1. */
	outcomes: Direction[];
	/** Percent move of each stretch. */
	moves: number[];
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
const cache = new Map<number, Promise<PuzzleData>>();
let countCache: { count: number; at: number } | null = null;

export async function puzzleCount(): Promise<number> {
	if (countCache && Date.now() - countCache.at < 60_000) return countCache.count;
	const rows = await db
		.select({ slug: puzzles.slug })
		.from(puzzles)
		.where(gte(puzzles.position, 0))
		.orderBy(asc(puzzles.position));
	countCache = { count: rows.length, at: Date.now() };
	return rows.length;
}

async function load(position: number): Promise<PuzzleData> {
	const [p] = await db.select().from(puzzles).where(eq(puzzles.position, position));
	if (!p) throw new Error(`No puzzle at position ${position}`);
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
		outcomes,
		moves
	};
}

/** Puzzle data for a catalog position (0-based). Cached for the life of the process. */
export function puzzleAt(position: number): Promise<PuzzleData> {
	let hit = cache.get(position);
	if (!hit) {
		hit = load(position);
		hit.catch(() => cache.delete(position));
		cache.set(position, hit);
	}
	return hit;
}

/** Visible closes before call `nextStep`, normalised so the last context close is 100. */
export function visibleBars(p: PuzzleData, callsMade: number): number[] {
	const end = callsMade >= p.calls ? p.closes.length : lastVisibleIndex(p, callsMade + 1) + 1;
	const base = p.closes[p.contextBars - 1];
	return p.closes.slice(0, end).map((c) => Math.round((c / base) * 100 * 1000) / 1000);
}
