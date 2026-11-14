import { getRequestEvent, query } from '$app/server';
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { games, guesses } from '#lib/server/db/schema.ts';
import { loadToday } from '#lib/server/game/play.ts';
import { exactStandingOf, statsFor, type Stats } from '#lib/server/stats.ts';
import type { Direction } from '#lib/play/types.ts';

const TICK_MS = 4000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface CallSplit {
	step: number;
	calls: number;
	ups: number;
	/** Which way the chart actually went. */
	answer: Direction;
	/** Which way the viewer called it. */
	you: Direction | null;
}

export type LiveStats = Omit<Stats, 'steps'> & {
	/**
	 * Today's per-call crowd split and the right answer. Null until the viewer has finished
	 * today's game, so nobody can look up the split and pick the minority side.
	 */
	calls: CallSplit[] | null;
	/**
	 * The viewer's own finish today, or null if they haven't finished. `finished` is the exact
	 * count of finished games behind `betterThan`, the same one the game's leaderboard shows.
	 */
	you: { balanceCents: number; betterThan: number | null; finished: number } | null;
};

/** The viewer's finished game for a puzzle: one lookup on the (user, puzzle) unique index. */
async function finishedGame(userId: string | undefined, puzzleNumber: number) {
	if (!userId) return null;
	const [row] = await db
		.select({ id: games.id, balanceCents: games.balanceCents })
		.from(games)
		.where(
			and(
				eq(games.userId, userId),
				eq(games.puzzleNumber, puzzleNumber),
				isNotNull(games.finishedAt)
			)
		);
	if (!row) return null;
	const calls = await db
		.select({ step: guesses.step, up: guesses.up })
		.from(guesses)
		.where(and(eq(guesses.gameId, row.id), eq(guesses.puzzleNumber, puzzleNumber)));
	const directions = new Map(calls.map((c) => [c.step, (c.up ? 'up' : 'down') as Direction]));
	return { puzzle: puzzleNumber, balanceCents: row.balanceCents, directions };
}

/**
 * Live stats for today's puzzle, pushed every few seconds while the page is open. The heavy
 * numbers come from a shared tick (one query for every open page); each connection only checks
 * whether its own viewer has finished today's game.
 */
export const liveStats = query.live(async function* (): AsyncGenerator<LiveStats> {
	const userId = getRequestEvent().locals.user?.id;
	// Which puzzle the viewer's finish belongs to, so a page left open past midnight
	// stops showing tomorrow's answers until they finish that one too.
	let mine: Awaited<ReturnType<typeof finishedGame>> = null;
	while (true) {
		const today = await loadToday();
		// A finish never un-happens, so once found it is not looked up again until the day rolls.
		if (mine?.puzzle !== today.number) mine = await finishedGame(userId, today.number);
		const [{ steps, ...stats }, rank] = await Promise.all([
			statsFor(today.number),
			mine ? exactStandingOf(today.number, mine.balanceCents) : null
		]);
		yield {
			...stats,
			calls: mine
				? today.puzzle.outcomes.map((answer, i) => {
						const s = steps.find((x) => x.step === i + 1);
						return {
							step: i + 1,
							calls: s?.calls ?? 0,
							ups: s?.ups ?? 0,
							answer,
							you: mine?.directions.get(i + 1) ?? null
						};
					})
				: null,
			you: mine && rank ? { balanceCents: mine.balanceCents, ...rank } : null
		};
		await sleep(TICK_MS);
	}
});
