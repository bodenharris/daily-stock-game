import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { dev } from '$app/env';
import { db } from '#lib/server/db/index.ts';
import { games, guesses } from '#lib/server/db/schema.ts';
import { CALLS_PER_GAME, START_BALANCE_CENTS } from '#lib/game/config.ts';
import { blendedShare, lockMultiplier, settleCall, stakeOptionFor } from '#lib/game/economy.ts';
import { classifyGame } from '#lib/game/archetype.ts';
import { todayPuzzle } from '#lib/game/daily.ts';
import { puzzleAt, puzzleCount, visibleBars, type PuzzleData } from './puzzle-data.ts';
import type { CallResult, Direction, GameView } from '#lib/play/types.ts';

/**
 * Plays from a dev server are tagged 'dev' so testing never moves the real crowd. In development
 * the crowd also counts dev and simulated plays, so the payout can be exercised locally.
 */
const SOURCE = dev ? 'dev' : 'real';
const CROWD_SOURCES = dev ? ['real', 'dev', 'sim'] : ['real'];
const crowdSourceFilter = sql`source in ${sql.raw(`(${CROWD_SOURCES.map((s) => `'${s}'`).join(', ')})`)}`;

export class PlayError extends Error {
	readonly status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export interface Player {
	id: string;
	isAnonymous: boolean;
	email?: string | null;
}

type GameRow = typeof games.$inferSelect;
type GuessRow = typeof guesses.$inferSelect;

export interface Today {
	number: number;
	date: string;
	position: number;
	nextPuzzleAt: number;
	puzzle: PuzzleData;
}

export async function loadToday(now = new Date()): Promise<Today> {
	const count = await puzzleCount();
	if (count === 0) throw new PlayError(503, 'No puzzles loaded yet');
	const t = todayPuzzle(now, count);
	return { ...t, puzzle: await puzzleAt(t.position) };
}

/** Live crowd counts (real players only) for every step of a puzzle, from the continuous aggregate. */
export async function crowdFor(
	puzzleNumber: number
): Promise<Map<number, { up: number; down: number }>> {
	const rows = await db.execute<{ step: number; ups: number; calls: number }>(sql`
		select step, sum(ups)::int as ups, sum(calls)::int as calls
		from crowd_hourly
		where puzzle_number = ${puzzleNumber} and ${crowdSourceFilter}
		group by step`);
	const map = new Map<number, { up: number; down: number }>();
	for (const r of rows) map.set(Number(r.step), { up: r.ups, down: r.calls - r.ups });
	return map;
}

async function crowdForStep(puzzleNumber: number, step: number) {
	const [row] = await db.execute<{ ups: number; calls: number }>(sql`
		select coalesce(sum(ups), 0)::int as ups, coalesce(sum(calls), 0)::int as calls
		from crowd_hourly
		where puzzle_number = ${puzzleNumber} and step = ${step} and ${crowdSourceFilter}`);
	return { up: row.ups, down: row.calls - row.ups };
}

function toResult(g: GuessRow, crowd: { up: number; down: number } | undefined): CallResult {
	return {
		step: g.step,
		direction: g.up ? 'up' : 'down',
		stakePercent: g.stakeBp / 100,
		stakeCents: g.stakeCents,
		multiplierHundredths: Math.round(g.multiplier * 100),
		correct: g.correct,
		deltaCents: g.deltaCents,
		balanceAfterCents: g.balanceAfterCents,
		crowdUpShareAtCall: g.crowdUpShare,
		crowd: crowd ?? { up: 0, down: 0 }
	};
}

/** Consecutive daily puzzles finished, ending today or yesterday. */
export async function streakFor(userId: string, todayNumber: number): Promise<number> {
	const rows = await db
		.select({ n: games.puzzleNumber })
		.from(games)
		.where(and(eq(games.userId, userId), isNotNull(games.finishedAt)))
		.orderBy(desc(games.puzzleNumber))
		.limit(400);
	let expected = rows[0]?.n === todayNumber ? todayNumber : todayNumber - 1;
	let streak = 0;
	for (const { n } of rows) {
		if (n !== expected) break;
		streak++;
		expected--;
	}
	return streak;
}

export async function buildView(
	today: Today,
	game: GameRow | null,
	gameGuesses: GuessRow[],
	user: Player | null
): Promise<GameView> {
	const p = today.puzzle;
	const callsMade = game?.step ?? 0;
	const finished = callsMade >= p.calls;
	const crowd = callsMade > 0 ? await crowdFor(today.number) : new Map();
	const streak = user ? await streakFor(user.id, today.number) : 0;
	return {
		number: today.number,
		date: today.date,
		calls: p.calls,
		contextBars: p.contextBars,
		stepBars: p.stepBars,
		totalBars: p.closes.length,
		bars: visibleBars(p, callsMade),
		balanceCents: game?.balanceCents ?? START_BALANCE_CENTS,
		results: gameGuesses.sort((a, b) => a.step - b.step).map((g) => toResult(g, crowd.get(g.step))),
		finished,
		reveal: finished
			? {
					ticker: p.ticker,
					company: p.company,
					headline: p.headline,
					story: p.story,
					dates: p.dates,
					closes: p.closes,
					moves: p.moves
				}
			: null,
		nextPuzzleAt: today.nextPuzzleAt,
		signedIn: !!user && !user.isAnonymous,
		email: user && !user.isAnonymous ? (user.email ?? null) : null,
		bonus:
			game?.bonusCorrect != null && game.bonusTotal != null
				? { correct: game.bonusCorrect, total: game.bonusTotal }
				: null,
		streak
	};
}

export async function viewFor(user: Player | null, now = new Date()): Promise<GameView> {
	const today = await loadToday(now);
	if (!user) return buildView(today, null, [], null);
	const [game] = await db
		.select()
		.from(games)
		.where(and(eq(games.userId, user.id), eq(games.puzzleNumber, today.number)));
	const rows = game ? await db.select().from(guesses).where(eq(guesses.gameId, game.id)) : [];
	return buildView(today, game ?? null, rows, user);
}

export interface PlaceCallInput {
	step: number;
	direction: Direction;
	stakePercent: number;
	puzzleNumber: number;
}

/**
 * Place one call. Runs in a transaction holding a row lock on the game, so a double tap or a
 * second tab can never place the same call twice or skip ahead.
 */
export async function placeCall(
	user: Player,
	input: PlaceCallInput,
	now = new Date()
): Promise<{ view: GameView; result: CallResult }> {
	const today = await loadToday(now);
	if (input.puzzleNumber !== today.number) {
		throw new PlayError(409, 'A new puzzle is out. Refresh to play it.');
	}
	const p = today.puzzle;
	if (!Number.isInteger(input.step) || input.step < 1 || input.step > p.calls) {
		throw new PlayError(400, 'Bad step');
	}
	stakeOptionFor(input.stakePercent); // throws on an unknown chip

	const outcome = await db.transaction(async (tx) => {
		await tx
			.insert(games)
			.values({
				userId: user.id,
				puzzleNumber: today.number,
				puzzleSlug: p.slug,
				balanceCents: START_BALANCE_CENTS,
				source: SOURCE
			})
			.onConflictDoNothing();
		const [game] = await tx
			.select()
			.from(games)
			.where(and(eq(games.userId, user.id), eq(games.puzzleNumber, today.number)))
			.for('update');
		if (game.step !== input.step - 1) {
			throw new PlayError(409, 'That call was already made.');
		}

		const crowd = await crowdForStep(today.number, input.step);
		const multiplierHundredths = lockMultiplier(crowd, input.direction);
		const correct = p.outcomes[input.step - 1] === input.direction;
		const s = settleCall({
			balanceCents: game.balanceCents,
			stakePercent: input.stakePercent,
			multiplierHundredths,
			correct
		});
		const upShare = blendedShare(crowd, 'up');

		const [guess] = await tx
			.insert(guesses)
			.values({
				ts: now,
				gameId: game.id,
				puzzleNumber: today.number,
				step: input.step,
				up: input.direction === 'up',
				stakeBp: Math.round(input.stakePercent * 100),
				stakeCents: s.stakeCents,
				crowdUpShare: upShare,
				multiplier: multiplierHundredths / 100,
				correct,
				deltaCents: s.deltaCents,
				balanceAfterCents: s.balanceAfterCents,
				source: SOURCE
			})
			.returning();

		const finished = input.step === p.calls;
		const all = await tx.select().from(guesses).where(eq(guesses.gameId, game.id));
		const [updated] = await tx
			.update(games)
			.set({
				step: input.step,
				balanceCents: s.balanceAfterCents,
				...(finished
					? {
							finishedAt: now,
							archetype: classifyGame(
								all.map((g) => ({
									step: g.step,
									direction: g.up ? ('up' as const) : ('down' as const),
									stakePercent: g.stakeBp / 100,
									correct: g.correct,
									multiplierHundredths: Math.round(g.multiplier * 100),
									crowdUpShareAtCall: g.crowdUpShare
								})),
								s.balanceAfterCents
							).key
						}
					: {})
			})
			.where(eq(games.id, game.id))
			.returning();
		return { game: updated, guesses: all, guess };
	});

	const view = await buildView(today, outcome.game, outcome.guesses, user);
	const result = view.results.find((r) => r.step === input.step)!;
	return { view, result };
}

export { CALLS_PER_GAME };
