import { and, desc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import { dev } from '$app/env';
import { BETTER_AUTH_SECRET, PLAY_SOURCE, PUZZLE_SECRET } from '$app/env/private';
import { db } from '#lib/server/db/index.ts';
import { games, guesses } from '#lib/server/db/schema.ts';
import { LAUNCH_DATE, START_BALANCE_CENTS } from '#lib/game/config.ts';
import { blendedShare, lockMultiplier, settleCall, stakeOptionFor } from '#lib/game/economy.ts';
import { classifyGame } from '#lib/game/archetype.ts';
import { easternDateString, midnightIn, puzzleNumberFor } from '#lib/game/daily.ts';
import { puzzleForNumber, visibleBars, type PuzzleData } from './puzzle-data.ts';
import type { CallResult, Direction, GameView } from '#lib/play/types.ts';

/**
 * Plays from a dev server are tagged 'dev' so testing never moves the real crowd. In development
 * the crowd also counts dev and simulated plays, so the payout can be exercised locally.
 */
const SOURCE = PLAY_SOURCE ?? (dev ? 'dev' : 'real');
const CROWD_SOURCES = SOURCE === 'dev' ? ['real', 'dev', 'sim'] : ['real'];
const SCHEDULE_SECRET = PUZZLE_SECRET ?? BETTER_AUTH_SECRET;
const sourceIn = sql`source in (${sql.join(
	CROWD_SOURCES.map((s) => sql`${s}`),
	sql`, `
)})`;

/** A game started before midnight can still be finished for this long after the rollover. */
export const GRACE_MS = 3 * 60 * 60 * 1000;

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
type Crowd = Map<number, { up: number; down: number }>;

export interface Day {
	number: number;
	date: string;
	/** Epoch ms when this puzzle unlocked (midnight Eastern starting its day). */
	unlockAt: number;
	/** Epoch ms when the next puzzle unlocks. */
	nextPuzzleAt: number;
	puzzle: PuzzleData;
}

/** Eastern calendar date of daily puzzle `number`. */
export function dateForNumber(number: number): string {
	const d = new Date(`${LAUNCH_DATE}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + number - 1);
	return d.toISOString().slice(0, 10);
}

export async function loadDay(number: number): Promise<Day> {
	try {
		const date = dateForNumber(number);
		return {
			number,
			date,
			unlockAt: midnightIn(date).getTime(),
			nextPuzzleAt: midnightIn(dateForNumber(number + 1)).getTime(),
			puzzle: await puzzleForNumber(number, SCHEDULE_SECRET)
		};
	} catch (e) {
		if (e instanceof Error && e.message === 'No puzzles loaded yet') {
			throw new PlayError(503, e.message);
		}
		throw e;
	}
}

export async function loadToday(now = new Date()): Promise<Day> {
	const number = puzzleNumberFor(now);
	const day = await loadDay(number);
	return { ...day, date: easternDateString(now) };
}

/** Live crowd counts for every step of a puzzle, from the continuous aggregate. */
export async function crowdFor(puzzleNumber: number): Promise<Crowd> {
	const rows = await db.execute<{ step: number; ups: number; calls: number }>(sql`
		select step, sum(ups)::int as ups, sum(calls)::int as calls
		from crowd_hourly
		where puzzle_number = ${puzzleNumber} and ${sourceIn}
		group by step`);
	const map: Crowd = new Map();
	for (const r of rows) map.set(Number(r.step), { up: r.ups, down: r.calls - r.ups });
	return map;
}

async function crowdForStep(puzzleNumber: number, step: number) {
	const [row] = await db.execute<{ ups: number; calls: number }>(sql`
		select coalesce(sum(ups), 0)::int as ups, coalesce(sum(calls), 0)::int as calls
		from crowd_hourly
		where puzzle_number = ${puzzleNumber} and step = ${step}
			and ${sourceIn}`);
	return { up: row.ups, down: row.calls - row.ups };
}

function toResult(
	g: GuessRow,
	crowd: { up: number; down: number } | undefined,
	move: number
): CallResult {
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
		move,
		crowd: crowd ?? { up: 0, down: 0 }
	};
}

function toStoredCall(g: GuessRow) {
	return {
		step: g.step,
		direction: g.up ? ('up' as const) : ('down' as const),
		stakePercent: g.stakeBp / 100,
		correct: g.correct,
		multiplierHundredths: Math.round(g.multiplier * 100),
		crowdUpShareAtCall: g.crowdUpShare
	};
}

/** Consecutive daily puzzles finished, ending today or yesterday. */
export async function streakFor(userId: string, todayNumber: number): Promise<number> {
	const rows = await db
		.select({ n: games.puzzleNumber })
		.from(games)
		.where(and(eq(games.userId, userId), isNotNull(games.finishedAt)))
		.orderBy(desc(games.puzzleNumber))
		.limit(1000);
	let expected = rows[0]?.n === todayNumber ? todayNumber : todayNumber - 1;
	let streak = 0;
	for (const { n } of rows) {
		if (n !== expected) break;
		streak++;
		expected--;
	}
	return streak;
}

/** A game's calls. Filters on the hypertable's segment column and time so old chunks are skipped. */
function guessesOf(game: Pick<GameRow, 'id' | 'puzzleNumber' | 'startedAt'>) {
	return db
		.select()
		.from(guesses)
		.where(
			and(
				eq(guesses.gameId, game.id),
				eq(guesses.puzzleNumber, game.puzzleNumber),
				gte(guesses.ts, new Date(game.startedAt.getTime() - 60_000))
			)
		);
}

function assembleView(
	day: Day,
	game: GameRow | null,
	gameGuesses: GuessRow[],
	user: Player | null,
	crowd: Crowd,
	streak: number
): GameView {
	const p = day.puzzle;
	const callsMade = game?.step ?? 0;
	const finished = callsMade >= p.calls;
	return {
		number: day.number,
		date: day.date,
		calls: p.calls,
		contextBars: p.contextBars,
		stepBars: p.stepBars,
		totalBars: p.closes.length,
		bars: visibleBars(p, callsMade),
		balanceCents: game?.balanceCents ?? START_BALANCE_CENTS,
		results: [...gameGuesses]
			.sort((a, b) => a.step - b.step)
			.map((g) => toResult(g, crowd.get(g.step), p.moves[g.step - 1])),
		finished,
		reveal: finished
			? {
					ticker: p.ticker,
					company: p.company,
					headline: p.headline,
					story: p.story,
					dates: p.dates,
					closes: p.quoted,
					moves: p.moves,
					hindsight: p.hindsight
				}
			: null,
		nextPuzzleAt: day.nextPuzzleAt,
		signedIn: !!user && !user.isAnonymous,
		email: user && !user.isAnonymous ? (user.email ?? null) : null,
		bonus:
			game?.bonusCorrect != null && game.bonusTotal != null
				? { correct: game.bonusCorrect, total: game.bonusTotal }
				: null,
		streak
	};
}

/**
 * The view a player should see now: today's puzzle, or, for a few hours after midnight,
 * yesterday's game if they were in the middle of it.
 */
export async function viewFor(user: Player | null, now = new Date()): Promise<GameView> {
	const today = await loadToday(now);
	if (!user) return assembleView(today, null, [], null, new Map(), 0);

	const inGrace = now.getTime() - today.unlockAt < GRACE_MS;
	const numbers = inGrace ? [today.number, today.number - 1] : [today.number];
	const [rows, streak] = await Promise.all([
		db
			.select()
			.from(games)
			.where(and(eq(games.userId, user.id), inArray(games.puzzleNumber, numbers))),
		streakFor(user.id, today.number)
	]);
	const todays = rows.find((g) => g.puzzleNumber === today.number) ?? null;
	const yesterdays = rows.find((g) => g.puzzleNumber === today.number - 1);
	const unfinishedYesterday =
		!todays && yesterdays && yesterdays.step > 0 && yesterdays.finishedAt == null;

	const day = unfinishedYesterday ? await loadDay(today.number - 1) : today;
	const game = unfinishedYesterday ? yesterdays! : todays;
	const [gameGuesses, crowd] = await Promise.all([
		game ? guessesOf(game) : Promise.resolve([]),
		crowdFor(day.number)
	]);
	return assembleView(day, game, gameGuesses, user, crowd, streak);
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
	// Yesterday's game may be finished during the grace period, but not started.
	const grace =
		input.puzzleNumber === today.number - 1 && now.getTime() - today.unlockAt < GRACE_MS;
	if (input.puzzleNumber !== today.number && !grace) {
		throw new PlayError(409, 'A new chart just came out. Here it is.');
	}
	const day = grace ? await loadDay(input.puzzleNumber) : today;
	const p = day.puzzle;
	if (!Number.isInteger(input.step) || input.step < 1 || input.step > p.calls) {
		throw new PlayError(400, 'Bad step');
	}
	try {
		stakeOptionFor(input.stakePercent);
	} catch {
		throw new PlayError(400, 'Pick a stake');
	}

	// The crowd before this player. Read outside the transaction: a call landing a few
	// milliseconds earlier or later makes no meaningful difference, and it keeps the lock short.
	const crowd = await crowdForStep(day.number, input.step);
	const multiplierHundredths = lockMultiplier(crowd, input.direction);
	const correct = p.outcomes[input.step - 1] === input.direction;

	const outcome = await db.transaction(async (tx) => {
		// Create-or-lock the game row in one statement (the no-op update takes the row lock).
		const [game] = await tx
			.insert(games)
			.values({
				userId: user.id,
				puzzleNumber: day.number,
				puzzleSlug: p.slug,
				balanceCents: START_BALANCE_CENTS,
				source: SOURCE
			})
			.onConflictDoUpdate({
				target: [games.userId, games.puzzleNumber],
				set: { step: sql`${games.step}` }
			})
			.returning();
		if (game.puzzleSlug !== p.slug) {
			throw new PlayError(409, 'This game belongs to a different chart.');
		}
		if (grace && game.step === 0) {
			throw new PlayError(409, 'A new chart just came out. Here it is.');
		}
		if (game.step !== input.step - 1) {
			throw new PlayError(409, 'That call was already made.');
		}

		const s = settleCall({
			balanceCents: game.balanceCents,
			stakePercent: input.stakePercent,
			multiplierHundredths,
			correct
		});

		await tx.insert(guesses).values({
			ts: now,
			gameId: game.id,
			puzzleNumber: day.number,
			step: input.step,
			up: input.direction === 'up',
			stakeBp: Math.round(input.stakePercent * 100),
			stakeCents: s.stakeCents,
			crowdUpShare: blendedShare(crowd, 'up'),
			multiplier: multiplierHundredths / 100,
			correct,
			deltaCents: s.deltaCents,
			balanceAfterCents: s.balanceAfterCents,
			source: SOURCE
		});

		let archetype: string | undefined;
		if (input.step === p.calls) {
			const all = await tx
				.select()
				.from(guesses)
				.where(and(eq(guesses.gameId, game.id), eq(guesses.puzzleNumber, day.number)));
			archetype = classifyGame(all.map(toStoredCall), s.balanceAfterCents).key;
		}
		const [updated] = await tx
			.update(games)
			.set({
				step: input.step,
				balanceCents: s.balanceAfterCents,
				...(archetype ? { finishedAt: now, archetype } : {})
			})
			.where(eq(games.id, game.id))
			.returning();
		return updated;
	});

	const [all, crowdNow, streak] = await Promise.all([
		guessesOf(outcome),
		crowdFor(day.number),
		streakFor(user.id, today.number)
	]);
	const view = assembleView(day, outcome, all, user, crowdNow, streak);
	const result = view.results.find((r) => r.step === input.step)!;
	return { view, result };
}
