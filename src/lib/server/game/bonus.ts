import { and, eq, isNotNull, sql } from 'drizzle-orm';
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

/** Only windows after US stocks went decimal (2001), so old 1/8-dollar ticks can't give real charts away. */
const SINCE = '2001-06-01';

async function candidates(): Promise<{ symbol: string; bars: number }[]> {
	const rows = await client<{ symbol: string; bars: number }[]>`
		select t.symbol, count(p.ts)::int as bars
		from tickers t join prices p on p.ticker = t.symbol and p.ts >= ${SINCE}
		where not exists (select 1 from puzzles z where z.ticker = t.symbol)
		group by t.symbol
		having count(p.ts) >= ${BARS * 4}
		order by t.symbol`;
	return rows.filter((r) => !EXCLUDED.has(r.symbol));
}

async function build(puzzleNumber: number): Promise<BonusRound[]> {
	const rand = rng(0x5eed + puzzleNumber * 7919);
	const pool = await candidates();
	if (pool.length === 0) throw new Error('No tickers for the bonus round yet');
	const rounds: BonusRound[] = [];
	// Each chart is a fair coin: earlier answers never tell you the next one.
	const kinds = Array.from({ length: BONUS_ROUNDS }, () => rand() < 0.5);

	for (const isReal of kinds) {
		// Every round draws a real window: real rounds show it, random rounds borrow its volatility
		// so both kinds look equally lively.
		const pick = pool[Math.floor(rand() * pool.length)];
		const offset = Math.floor(rand() * (pick.bars - BARS));
		const window = await client<{ ts: string; close: number }[]>`
			select ts::text as ts, close from prices where ticker = ${pick.symbol} and ts >= ${SINCE}
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

export interface BonusState {
	number: number;
	charts: BonusChart[];
	/** Guesses made so far, in order, with the answer for each. */
	answered: { guess: boolean; answer: BonusAnswer }[];
	finished: boolean;
}

function scoreOf(rounds: BonusRound[], guesses: boolean[]) {
	return rounds.reduce((n, r, i) => n + (guesses[i] === r.answer.real ? 1 : 0), 0);
}

/** The bonus for a finished game: the charts, plus answers only for rounds already guessed. */
export async function bonusState(userId: string, puzzleNumber: number): Promise<BonusState> {
	const [game] = await db
		.select({ bonusGuesses: games.bonusGuesses })
		.from(games)
		.where(
			and(
				eq(games.userId, userId),
				eq(games.puzzleNumber, puzzleNumber),
				isNotNull(games.finishedAt)
			)
		);
	if (!game) throw new Error('Finish the game first');
	const rounds = await roundsFor(puzzleNumber);
	const made = game.bonusGuesses ?? [];
	return {
		number: puzzleNumber,
		charts: rounds.map((r) => ({ values: r.values })),
		answered: made.map((guess, i) => ({ guess, answer: rounds[i].answer })),
		finished: made.length >= rounds.length
	};
}

/**
 * Record the guess for round `index`, then reveal that round's answer. The guess is stored
 * first, in order, in one atomic update, so a round can't be replayed or answered out of order.
 */
export async function guessBonus(
	userId: string,
	puzzleNumber: number,
	index: number,
	guess: boolean
): Promise<BonusState> {
	const rounds = await roundsFor(puzzleNumber);
	if (index < 0 || index >= rounds.length) throw new Error('No such round');
	const [row] = await db
		.update(games)
		.set({ bonusGuesses: sql`array_append(coalesce(${games.bonusGuesses}, '{}'), ${guess})` })
		.where(
			and(
				eq(games.userId, userId),
				eq(games.puzzleNumber, puzzleNumber),
				isNotNull(games.finishedAt),
				sql`coalesce(array_length(${games.bonusGuesses}, 1), 0) = ${index}`
			)
		)
		.returning({ bonusGuesses: games.bonusGuesses });
	const made = row?.bonusGuesses;
	if (made && made.length === rounds.length) {
		await db
			.update(games)
			.set({ bonusCorrect: scoreOf(rounds, made), bonusTotal: rounds.length })
			.where(
				and(
					eq(games.userId, userId),
					eq(games.puzzleNumber, puzzleNumber),
					sql`${games.bonusCorrect} is null`
				)
			);
	}
	// Whether or not this guess was accepted, return the true stored state.
	return bonusState(userId, puzzleNumber);
}
