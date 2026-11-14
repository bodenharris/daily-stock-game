import { and, eq } from 'drizzle-orm';
import { client, db } from '#lib/server/db/index.ts';
import { games } from '#lib/server/db/schema.ts';
import { dailyVolatility, normalise, rng, syntheticPath } from './bonus-gen.ts';

export const BONUS_ROUNDS = 3;
const BARS = 90;

/**
 * Tickers whose charts are too famous or too wild to be fair "is this real?" material.
 * The puzzle tickers are excluded on top of these.
 */
const EXCLUDED = new Set(['GME', 'AMC', 'KODK', 'BBBYQ', 'XIV', 'USO', 'SIVBQ', 'TWTR', 'SMCI']);

export interface BonusChart {
	values: number[];
}

export interface BonusAnswer {
	real: boolean;
	/** Only for real charts, after answering. */
	ticker: string | null;
	from: string | null;
	to: string | null;
}

interface BonusRound {
	values: number[];
	answer: BonusAnswer;
}

const cache = new Map<number, Promise<BonusRound[]>>();

async function candidates(): Promise<{ symbol: string; bars: number }[]> {
	const rows = await client<{ symbol: string; bars: number }[]>`
		select t.symbol, t.bars from tickers t
		where t.bars >= ${BARS * 4}
			and not exists (select 1 from puzzles p where p.ticker = t.symbol)
		order by t.symbol`;
	return rows.filter((r) => !EXCLUDED.has(r.symbol));
}

async function build(puzzleNumber: number): Promise<BonusRound[]> {
	const rand = rng(0x5eed + puzzleNumber * 7919);
	const pool = await candidates();
	if (pool.length === 0) throw new Error('No tickers for the bonus round yet');
	const rounds: BonusRound[] = [];
	// Exactly one or two real charts, so "all real" or "all random" never wins outright.
	const realCount = rand() < 0.5 ? 1 : 2;
	const kinds = Array.from({ length: BONUS_ROUNDS }, (_, i) => i < realCount);
	for (let i = kinds.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[kinds[i], kinds[j]] = [kinds[j], kinds[i]];
	}

	for (const isReal of kinds) {
		// Every round draws a real window: real rounds show it, random rounds borrow its volatility
		// so both kinds look equally lively.
		const pick = pool[Math.floor(rand() * pool.length)];
		const offset = Math.floor(rand() * (pick.bars - BARS));
		const window = await client<{ ts: string; close: number }[]>`
			select ts::text as ts, close from prices where ticker = ${pick.symbol}
			order by ts offset ${offset} limit ${BARS}`;
		const closes = window.map((w) => Number(w.close));
		if (isReal) {
			rounds.push({
				values: normalise(closes),
				answer: {
					real: true,
					ticker: pick.symbol,
					from: window[0].ts,
					to: window.at(-1)!.ts
				}
			});
		} else {
			const vol = Math.min(0.06, Math.max(0.008, dailyVolatility(closes)));
			rounds.push({
				values: normalise(syntheticPath(rand, BARS, vol)),
				answer: { real: false, ticker: null, from: null, to: null }
			});
		}
	}
	return rounds;
}

function roundsFor(puzzleNumber: number): Promise<BonusRound[]> {
	let hit = cache.get(puzzleNumber);
	if (!hit) {
		hit = build(puzzleNumber);
		hit.catch(() => cache.delete(puzzleNumber));
		cache.set(puzzleNumber, hit);
		if (cache.size > 4) cache.delete(cache.keys().next().value!);
	}
	return hit;
}

/** The day's bonus charts, without answers. Everyone gets the same three. */
export async function bonusCharts(puzzleNumber: number): Promise<BonusChart[]> {
	return (await roundsFor(puzzleNumber)).map((r) => ({ values: r.values }));
}

/** The answer for one round, so the player gets feedback as they go. */
export async function bonusRoundAnswer(puzzleNumber: number, index: number): Promise<BonusAnswer> {
	const rounds = await roundsFor(puzzleNumber);
	const round = rounds[index];
	if (!round) throw new Error('No such round');
	return round.answer;
}

/** Check a player's guesses (true = "real"), store the score on their game, return the answers. */
export async function answerBonus(
	userId: string,
	puzzleNumber: number,
	guesses: boolean[]
): Promise<{ answers: BonusAnswer[]; correct: number; total: number }> {
	const rounds = await roundsFor(puzzleNumber);
	const correct = rounds.reduce((n, r, i) => n + (guesses[i] === r.answer.real ? 1 : 0), 0);
	// First answer counts: a second try never overwrites the stored score.
	const [game] = await db
		.select({ bonusCorrect: games.bonusCorrect })
		.from(games)
		.where(and(eq(games.userId, userId), eq(games.puzzleNumber, puzzleNumber)));
	if (game && game.bonusCorrect == null) {
		await db
			.update(games)
			.set({ bonusCorrect: correct, bonusTotal: rounds.length })
			.where(and(eq(games.userId, userId), eq(games.puzzleNumber, puzzleNumber)));
	}
	const stored = game?.bonusCorrect ?? correct;
	return { answers: rounds.map((r) => r.answer), correct: stored, total: rounds.length };
}
