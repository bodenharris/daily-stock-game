import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { dev } from '$app/env';
import { BETTER_AUTH_SECRET, DEV_DAY_OFFSET, PLAY_SOURCE, PUZZLE_SECRET } from '$app/env/private';
import { db } from '#lib/server/db/index.ts';
import { games, guesses, schedule } from '#lib/server/db/schema.ts';
import { START_BALANCE_CENTS } from '#lib/game/config.ts';
import { blendedShare, lockMultiplier, settleCall, stakeOptionFor } from '#lib/game/economy.ts';
import { classifyGame } from '#lib/game/archetype.ts';
import { easternDateString, midnightIn, puzzleNumberFor } from '#lib/game/daily.ts';
import { puzzleForNumber, visibleBars, type PuzzleData } from './puzzle-data.ts';
import { standingOf, type Standing } from '#lib/server/stats.ts';
import { optionsFor } from './name-it.ts';
import { GRACE_MS, countStreak, dateForNumber, playedOnItsDay } from './streak.ts';

export { GRACE_MS, dateForNumber };
import { exactStanding } from '#lib/play/standing.ts';
import { FINISH_BUCKET_CENTS, FINISH_CAP_CENTS } from '#lib/stats/finishes.ts';
import type { CallResult, Direction, Finishes, GameView, NameIt } from '#lib/play/types.ts';

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

/**
 * The clock that decides which day it is. In development only, DEV_DAY_OFFSET shifts it by
 * whole days, so the archive and day rollover can be tried without waiting for midnight.
 * Timestamps on games and calls always use the real time.
 */
function dayClock(now: Date): Date {
	return dev && DEV_DAY_OFFSET ? new Date(now.getTime() + DEV_DAY_OFFSET * 86_400_000) : now;
}

/** Today's puzzle number. */
export function todayNumber(now = new Date()): number {
	return puzzleNumberFor(dayClock(now));
}

export async function loadToday(now = new Date()): Promise<Day> {
	const shifted = dayClock(now);
	const day = await loadDay(puzzleNumberFor(shifted));
	return { ...day, date: easternDateString(shifted) };
}

/** Whether `number` is a past day that really happened (it has a stored schedule entry). */
async function isPastDay(number: number, today: number): Promise<boolean> {
	if (!Number.isInteger(number) || number < 1 || number >= today) return false;
	const [row] = await db
		.select({ n: schedule.number })
		.from(schedule)
		.where(eq(schedule.number, number));
	return !!row;
}

/**
 * The day a call or guess is for. Today's page may only play today (and, for a few hours after
 * midnight, finish yesterday's game it had started); the archive may play any past day.
 */
async function dayFor(
	puzzleNumber: number,
	archive: boolean,
	now: Date
): Promise<{ today: number; day: Day; grace: boolean }> {
	// The archive only needs today's number: it never loads (and so never schedules) today.
	if (archive) {
		const today = todayNumber(now);
		if (!(await isPastDay(puzzleNumber, today))) {
			throw new PlayError(404, 'That chart is not in the archive.');
		}
		return { today, day: await loadDay(puzzleNumber), grace: false };
	}
	const today = await loadToday(now);
	if (puzzleNumber === today.number) return { today: today.number, day: today, grace: false };
	const grace = puzzleNumber === today.number - 1 && now.getTime() - today.unlockAt < GRACE_MS;
	if (!grace) throw new PlayError(409, 'A new chart just came out. Here it is.');
	return { today: today.number, day: await loadDay(puzzleNumber), grace: true };
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

/**
 * Consecutive daily puzzles finished on their own day, ending today or yesterday. Past days
 * played from the archive don't count: a streak means showing up every day.
 */
export async function streakFor(userId: string, todayNumber: number): Promise<number> {
	const rows = await db
		.select({ n: games.puzzleNumber, startedAt: games.startedAt, finishedAt: games.finishedAt })
		.from(games)
		.where(and(eq(games.userId, userId), isNotNull(games.finishedAt)))
		.orderBy(desc(games.puzzleNumber))
		.limit(1000);
	const onTime = rows
		.filter((r) => playedOnItsDay(r.n, r.startedAt, r.finishedAt!))
		.map((r) => r.n);
	return countStreak(onTime, todayNumber);
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
	streak: number,
	standing: Standing | null = null,
	nameIt: NameIt | null = null,
	finishes: Finishes | null = null
): GameView {
	const p = day.puzzle;
	const callsMade = game?.step ?? 0;
	const finished = callsMade >= p.calls;
	// After the last call the player names the moment first; nothing identifying is sent until
	// that guess is stored. (If the options can't be built, the reveal goes out anyway.)
	const revealed = finished && (!nameIt || nameIt.answered);
	// The standing line sits above the finishes curve, so it comes from the same exact place and count
	// whenever there is one. The percentile sketch (an estimate, cached for a few seconds) is the
	// fallback if the finishes couldn't be read.
	const shownStanding = finishes ? exactStanding(finishes.place, finishes.finished) : standing;
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
		reveal: revealed
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
		streak,
		standing: finished ? shownStanding : null,
		nameIt,
		finishes: revealed ? finishes : null
	};
}

/** "Name it" for a finished game. Never lets a failure here hold back the reveal. */
async function nameItFor(day: Day, game: GameRow | null): Promise<NameIt | null> {
	if (!game || game.finishedAt == null) return null;
	try {
		const options = await optionsFor(day.puzzle);
		const answered = game.nameGuess != null;
		const index = (slug: string) => {
			const i = options.findIndex((o) => o.slug === slug);
			return i < 0 ? null : i;
		};
		return {
			options: options.map((o) => o.headline),
			answered,
			guess: answered && game.nameGuess ? index(game.nameGuess) : null,
			answer: answered ? index(day.puzzle.slug) : null
		};
	} catch (e) {
		console.error('name it options failed', e);
		return null;
	}
}

/** The full view of one game: shared by viewFor and the commands that change a game. */
async function viewOfGame(
	day: Day,
	game: GameRow,
	user: Player,
	todayNumber: number
): Promise<GameView> {
	const [all, crowd, streak, standing, nameIt, finishes] = await Promise.all([
		guessesOf(game),
		crowdFor(day.number),
		streakFor(user.id, todayNumber),
		standingFor(day, game),
		nameItFor(day, game),
		finishesFor(day, game)
	]);
	return assembleView(day, game, all, user, crowd, streak, standing, nameIt, finishes);
}

/** Standing for a finished game; never lets a stats hiccup break the game view. */
function standingFor(day: Day, game: GameRow | null): Promise<Standing | null> {
	if (!game || game.finishedAt == null) return Promise.resolve(null);
	return standingOf(day.number, game.balanceCents).catch(() => null);
}

/**
 * Where everyone finished that day, for the end screen's curve, plus the viewer's exact
 * place, in one statement over the day's finished games (the `(puzzle_number, finished_at)`
 * index narrows it to one day). Balances come in $10 buckets, the same ones the stats page
 * gets. The place counts strictly better balances, so ties share the better place. Nobody is
 * named. Only for a finished game, and never lets a failure here break the game view.
 */
async function finishesFor(day: Day, game: GameRow | null): Promise<Finishes | null> {
	if (!game || game.finishedAt == null) return null;
	try {
		const rows = await db.execute<{ cents: number; count: number; above: number }>(sql`
			select least(balance_cents / ${FINISH_BUCKET_CENTS} * ${FINISH_BUCKET_CENTS},
					${FINISH_CAP_CENTS})::int as cents,
				count(*)::int as count,
				count(*) filter (where balance_cents > ${game.balanceCents})::int as above
			from games
			where puzzle_number = ${day.number} and finished_at is not null and ${sourceIn}
			group by 1
			order by 1`);
		if (rows.length === 0) return null;
		return {
			buckets: rows.map((r) => ({ cents: r.cents, count: r.count })),
			place: rows.reduce((n, r) => n + r.above, 0) + 1,
			finished: rows.reduce((n, r) => n + r.count, 0)
		};
	} catch (e) {
		console.error('finishes failed', e);
		return null;
	}
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
	const [gameGuesses, crowd, standing, nameIt, finishes] = await Promise.all([
		game ? guessesOf(game) : Promise.resolve([]),
		crowdFor(day.number),
		standingFor(day, game),
		nameItFor(day, game),
		finishesFor(day, game)
	]);
	return assembleView(day, game, gameGuesses, user, crowd, streak, standing, nameIt, finishes);
}

export interface PlaceCallInput {
	step: number;
	direction: Direction;
	stakePercent: number;
	puzzleNumber: number;
	/** Played from the archive (a past day), not today's page. */
	archive?: boolean;
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
	// Yesterday's game may be finished during the grace period, but not started.
	const { today, day, grace } = await dayFor(input.puzzleNumber, !!input.archive, now);
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
				source: SOURCE,
				// The app's clock, the same one that stamps guesses, so time filters always agree.
				startedAt: now
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

	const view = await viewOfGame(day, outcome, user, today);
	const result = view.results.find((r) => r.step === input.step)!;
	return { view, result };
}

/**
 * Store the player's "Name it" guess (an option index, or null to skip), then send the view
 * with the reveal. Only once per game: a second answer just returns the stored one.
 */
export async function nameMoment(
	user: Player,
	puzzleNumber: number,
	choice: number | null,
	archive = false,
	now = new Date()
): Promise<GameView> {
	const { today, day } = await dayFor(puzzleNumber, archive, now);
	const options = await optionsFor(day.puzzle);
	if (choice != null && (!Number.isInteger(choice) || choice < 0 || choice >= options.length)) {
		throw new PlayError(400, 'Pick one of the options');
	}
	const where = and(eq(games.userId, user.id), eq(games.puzzleNumber, day.number));
	const [updated] = await db
		.update(games)
		.set({ nameGuess: choice == null ? '' : options[choice].slug })
		.where(and(where, isNotNull(games.finishedAt), isNull(games.nameGuess)))
		.returning();
	const game = updated ?? (await db.select().from(games).where(where))[0];
	if (!game || game.finishedAt == null) throw new PlayError(409, 'Finish the game first');
	return viewOfGame(day, game, user, today);
}

/** The view of a past day, for the archive. */
export async function dayView(
	user: Player | null,
	number: number,
	now = new Date()
): Promise<GameView> {
	const today = todayNumber(now);
	if (!(await isPastDay(number, today))) {
		throw new PlayError(404, 'That chart is not in the archive.');
	}
	const day = await loadDay(number);
	if (!user) return assembleView(day, null, [], null, new Map(), 0);
	const [game] = await db
		.select()
		.from(games)
		.where(and(eq(games.userId, user.id), eq(games.puzzleNumber, number)));
	if (game) return viewOfGame(day, game, user, today);
	return assembleView(day, null, [], user, new Map(), await streakFor(user.id, today));
}

export interface ArchiveDay {
	number: number;
	/** Eastern date, YYYY-MM-DD. */
	date: string;
	/** This player's game, if they played it. */
	played: { step: number; finished: boolean; balanceCents: number; right: number } | null;
}

/** Every past day that happened, newest first, with how this player did on each. */
export async function archiveFor(
	user: Player | null,
	now = new Date()
): Promise<{ today: number; days: ArchiveDay[] }> {
	const today = todayNumber(now);
	const days = await db
		.select({ number: schedule.number })
		.from(schedule)
		.where(lt(schedule.number, today))
		.orderBy(desc(schedule.number))
		.limit(400);
	const numbers = days.map((d) => d.number);
	const mine =
		user && numbers.length
			? await db
					.select()
					.from(games)
					.where(and(eq(games.userId, user.id), inArray(games.puzzleNumber, numbers)))
			: [];
	const right = new Map<string, number>();
	if (mine.length) {
		const rows = await db
			.select({
				gameId: guesses.gameId,
				right: sql<number>`count(*) filter (where ${guesses.correct})::int`
			})
			.from(guesses)
			.where(
				and(
					inArray(guesses.puzzleNumber, numbers),
					inArray(
						guesses.gameId,
						mine.map((g) => g.id)
					)
				)
			)
			.groupBy(guesses.gameId);
		for (const r of rows) right.set(r.gameId, r.right);
	}
	return {
		today,
		days: numbers.map((number) => {
			const g = mine.find((m) => m.puzzleNumber === number);
			return {
				number,
				date: dateForNumber(number),
				played: g
					? {
							step: g.step,
							finished: g.finishedAt != null,
							balanceCents: g.balanceCents,
							right: right.get(g.id) ?? 0
						}
					: null
			};
		})
	};
}
