import { error } from '@sveltejs/kit';
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, lt, max, sql } from 'drizzle-orm';
import {
	FINISH_BUCKET_CENTS,
	FINISH_CAP_CENTS,
	GRACE_MS,
	START_BALANCE_CENTS
} from '#lib/game/config.ts';
import { dateForNumber, midnightIn, puzzleNumberFor } from '#lib/game/daily.ts';
import { blendedShare, lockMultiplier, settleCall, type Direction } from '#lib/game/economy.ts';
import { exactStanding } from '#lib/play/standing.ts';
import type { CallResult, Finishes, GameView, NameIt } from '#lib/play/types.ts';
import { db } from '#lib/server/db/index.ts';
import { games, guesses, schedule } from '#lib/server/db/schema.ts';
import { optionsFor, type NameItCandidate } from './name-it.ts';
import { puzzleForNumber, visibleBars, type PuzzleData } from './puzzle-data.ts';
import { countStreak, playedOnItsDay } from './streak.ts';

const NEW_CHART = 'A new chart just came out. Here it is.';
const NOT_IN_ARCHIVE = 'That chart is not in the archive.';
const ALREADY_MADE = 'That call was already made.';

export interface Player {
	id: string;
	isAnonymous?: boolean | null;
	email?: string;
}

type GameRow = typeof games.$inferSelect;
type GuessRow = typeof guesses.$inferSelect;
type Crowd = Map<number, { up: number; down: number }>;

interface Day {
	number: number;
	/** Eastern calendar date, YYYY-MM-DD. */
	date: string;
	/** Epoch ms when this puzzle unlocked (midnight Eastern starting its day). */
	unlockAt: number;
	/** Epoch ms when the next puzzle unlocks. */
	nextPuzzleAt: number;
	puzzle: PuzzleData;
}

async function loadDay(number: number): Promise<Day> {
	const date = dateForNumber(number);
	return {
		number,
		date,
		unlockAt: midnightIn(date).getTime(),
		nextPuzzleAt: midnightIn(dateForNumber(number + 1)).getTime(),
		puzzle: await puzzleForNumber(number)
	};
}

export function todayNumber(now = new Date()): number {
	return puzzleNumberFor(now);
}

export function loadToday(now = new Date()): Promise<Day> {
	return loadDay(todayNumber(now));
}

/**
 * The day a request is for. Today's page may only play today (and, for a few hours after
 * midnight, finish yesterday's game it had started); the archive may play any past day that
 * really happened, which is one with a stored schedule entry.
 */
async function dayFor(
	puzzleNumber: number,
	archive: boolean,
	now: Date
): Promise<{ today: number; day: Day; grace: boolean }> {
	// The archive only needs today's number: it never loads (and so never schedules) today.
	if (archive) {
		const today = todayNumber(now);
		const [past] =
			puzzleNumber < today
				? await db
						.select({ number: schedule.number })
						.from(schedule)
						.where(eq(schedule.number, puzzleNumber))
				: [];
		if (!past) error(404, NOT_IN_ARCHIVE);
		return { today, day: await loadDay(puzzleNumber), grace: false };
	}
	const today = await loadToday(now);
	if (puzzleNumber === today.number) return { today: today.number, day: today, grace: false };
	const grace = puzzleNumber === today.number - 1 && now.getTime() - today.unlockAt < GRACE_MS;
	if (!grace) error(409, NEW_CHART);
	return { today: today.number, day: await loadDay(puzzleNumber), grace: true };
}

/** The crowd's calls on every step of a day, this player's included. */
async function crowdFor(puzzleNumber: number): Promise<Crowd> {
	const rows = await db
		.select({
			step: guesses.step,
			calls: count(),
			ups: sql<number>`count(*) filter (where ${guesses.up})`.mapWith(Number)
		})
		.from(guesses)
		.innerJoin(games, eq(games.id, guesses.gameId))
		.where(eq(games.puzzleNumber, puzzleNumber))
		.groupBy(guesses.step);
	return new Map(rows.map((r) => [r.step, { up: r.ups, down: r.calls - r.ups }]));
}

/**
 * Consecutive daily puzzles finished on their own day, ending today or yesterday. Past days
 * played from the archive don't count: a streak means showing up every day.
 */
async function streakFor(userId: string, today: number): Promise<number> {
	const rows = await db
		.select({ n: games.puzzleNumber, startedAt: games.startedAt, finishedAt: games.finishedAt })
		.from(games)
		.where(and(eq(games.userId, userId), isNotNull(games.finishedAt)))
		.orderBy(desc(games.puzzleNumber));
	const onTime = rows.filter((r) => playedOnItsDay(r.n, r.startedAt, r.finishedAt!));
	return countStreak(
		onTime.map((r) => r.n),
		today
	);
}

type Options = NameItCandidate[];

/**
 * "Name it" for a finished game, from `built` options if the caller already has them. A failure
 * here never holds back the reveal.
 */
async function nameItFor(day: Day, game: GameRow, built?: Options): Promise<NameIt | null> {
	if (game.finishedAt == null) return null;
	try {
		const options = built ?? (await optionsFor(day.puzzle));
		const answered = game.nameGuess != null;
		const index = (slug: string | null) => {
			const i = options.findIndex((o) => o.slug === slug);
			return answered && i >= 0 ? i : null;
		};
		return {
			options: options.map((o) => o.headline),
			answered,
			guess: index(game.nameGuess),
			answer: index(day.puzzle.slug),
			span: [day.puzzle.dates[0], day.puzzle.dates[day.puzzle.dates.length - 1]]
		};
	} catch (e) {
		console.error('Could not build the Name it options', e);
		return null;
	}
}

/**
 * Where everyone finished that day, plus this game's exact place, in one group-by over the day's
 * finished games. The place counts strictly better balances, so ties share the better place.
 */
async function finishesFor(day: Day, game: GameRow): Promise<Finishes | null> {
	if (game.finishedAt == null) return null;
	const bucket = sql<number>`least(${games.balanceCents} / ${FINISH_BUCKET_CENTS} * ${FINISH_BUCKET_CENTS}, ${FINISH_CAP_CENTS})`;
	const rows = await db
		.select({
			cents: bucket.mapWith(Number),
			count: count(),
			above:
				sql<number>`count(*) filter (where ${games.balanceCents} > ${game.balanceCents})`.mapWith(
					Number
				),
			top: max(games.balanceCents)
		})
		.from(games)
		.where(and(eq(games.puzzleNumber, day.number), isNotNull(games.finishedAt)))
		.groupBy(sql`1`)
		.orderBy(sql`1`);
	if (rows.length === 0) return null;
	return {
		buckets: rows.map((r) => ({ cents: r.cents, count: r.count })),
		place: rows.reduce((n, r) => n + r.above, 0) + 1,
		finished: rows.reduce((n, r) => n + r.count, 0),
		leaderCents: Math.max(...rows.map((r) => r.top ?? 0))
	};
}

function toResult(g: GuessRow, crowd: Crowd, move: number): CallResult {
	return {
		step: g.step,
		direction: g.up ? 'up' : 'down',
		stakeCents: g.stakeCents,
		correct: g.correct,
		deltaCents: g.deltaCents,
		balanceAfterCents: g.balanceAfterCents,
		crowdUpShareAtCall: g.crowdUpShare,
		move,
		crowd: crowd.get(g.step) ?? { up: 0, down: 0 }
	};
}

/** What `user` sees of `day`: their game on it, if they have one, and the reveal once earned. */
async function viewOf(
	day: Day,
	today: number,
	user: Player | null,
	game: GameRow | null,
	options?: Options
): Promise<GameView> {
	const [calls, crowd, streak, nameIt, finishes] = await Promise.all([
		game
			? db.select().from(guesses).where(eq(guesses.gameId, game.id)).orderBy(asc(guesses.step))
			: [],
		game ? crowdFor(day.number) : new Map(),
		user ? streakFor(user.id, today) : 0,
		game && nameItFor(day, game, options),
		game && finishesFor(day, game)
	]);
	const p = day.puzzle;
	const callsMade = game?.step ?? 0;
	const finished = callsMade >= p.calls;
	// After the last call the player names the moment first; nothing identifying is sent until
	// that guess is stored. (If the options can't be built, the reveal goes out anyway.)
	const revealed = finished && (!nameIt || nameIt.answered);
	const signedIn = !!user && !user.isAnonymous;
	return {
		number: day.number,
		date: day.date,
		calls: p.calls,
		contextBars: p.contextBars,
		stepBars: p.stepBars,
		bars: visibleBars(p, callsMade),
		balanceCents: game?.balanceCents ?? START_BALANCE_CENTS,
		results: calls.map((g) => toResult(g, crowd, p.moves[g.step - 1])),
		finished,
		reveal: revealed
			? {
					ticker: p.ticker,
					headline: p.headline,
					story: p.story,
					dates: p.dates,
					closes: p.quoted,
					hindsight: p.hindsight
				}
			: null,
		nextPuzzleAt: day.nextPuzzleAt,
		signedIn,
		email: signedIn ? (user.email ?? null) : null,
		streak,
		standing: finishes ? exactStanding(finishes.place, finishes.finished) : null,
		nameIt,
		finishes: revealed ? finishes : null
	};
}

/**
 * The view a player should see now: today's puzzle, or, for a few hours after midnight,
 * yesterday's game if they were in the middle of it.
 */
export async function viewFor(user: Player | null, now = new Date()): Promise<GameView> {
	const today = await loadToday(now);
	if (!user) return viewOf(today, today.number, null, null);

	const inGrace = now.getTime() - today.unlockAt < GRACE_MS;
	const rows = await db
		.select()
		.from(games)
		.where(
			and(
				eq(games.userId, user.id),
				inArray(games.puzzleNumber, inGrace ? [today.number, today.number - 1] : [today.number])
			)
		);
	const todays = rows.find((g) => g.puzzleNumber === today.number);
	const yesterdays = rows.find((g) => g.puzzleNumber === today.number - 1);
	if (!todays && yesterdays && yesterdays.step > 0 && yesterdays.finishedAt == null) {
		return viewOf(await loadDay(yesterdays.puzzleNumber), today.number, user, yesterdays);
	}
	return viewOf(today, today.number, user, todays ?? null);
}

/** The view of a past day, for the archive. */
export async function dayView(
	user: Player | null,
	number: number,
	now = new Date()
): Promise<GameView> {
	const { today, day } = await dayFor(number, true, now);
	const [game] = user
		? await db
				.select()
				.from(games)
				.where(and(eq(games.userId, user.id), eq(games.puzzleNumber, number)))
		: [];
	return viewOf(day, today, user, game ?? null);
}

interface CallInput {
	puzzleNumber: number;
	/** Played from the archive (a past day), not today's page. */
	archive?: boolean;
	step: number;
	direction: Direction;
	stakePercent: number;
}

/** Place one call. A double tap or a second tab can never place the same call twice or skip ahead. */
export async function placeCall(
	user: Player,
	input: CallInput,
	now = new Date()
): Promise<{ view: GameView; result: CallResult }> {
	const { today, day, grace } = await dayFor(input.puzzleNumber, !!input.archive, now);
	const p = day.puzzle;
	const { step } = input;
	if (step > p.calls) error(400, 'Bad step');

	// The crowd before this player. A call landing a moment earlier or later makes no difference.
	const crowd = (await crowdFor(day.number)).get(step) ?? { up: 0, down: 0 };
	const multiplierHundredths = lockMultiplier(crowd, input.direction);
	const correct = p.outcomes[step - 1] === input.direction;

	// Yesterday's game may be finished during the grace period, but not started.
	const [game] = grace
		? await db
				.select()
				.from(games)
				.where(and(eq(games.userId, user.id), eq(games.puzzleNumber, day.number)))
		: await db
				.insert(games)
				.values({
					userId: user.id,
					puzzleNumber: day.number,
					puzzleSlug: p.slug,
					balanceCents: START_BALANCE_CENTS,
					startedAt: now
				})
				.onConflictDoUpdate({
					target: [games.userId, games.puzzleNumber],
					set: { step: sql`${games.step}` }
				})
				.returning();
	if (!game || (grace && game.step === 0)) error(409, NEW_CHART);
	if (game.puzzleSlug !== p.slug) error(409, 'This game belongs to a different chart.');
	if (game.step !== step - 1) error(409, ALREADY_MADE);

	const s = settleCall({
		balanceCents: game.balanceCents,
		stakePercent: input.stakePercent,
		multiplierHundredths,
		correct
	});
	const finishedAt = step === p.calls ? now : null;

	// Advance the game and record the call in one statement. The update only matches while the
	// game is still at the previous step, and Postgres re-checks that after waiting on a
	// concurrent update of the row, so of two racing requests exactly one inserts its call.
	const { rows } = await db.execute(sql`
		with advanced as (
			update ${games}
			set step = ${step}, balance_cents = ${s.balanceAfterCents}, finished_at = ${finishedAt}
			where id = ${game.id} and step = ${step - 1}
			returning id
		)
		insert into ${guesses} (game_id, step, ts, up, stake_percent, stake_cents, crowd_up_share,
			multiplier_hundredths, correct, delta_cents, balance_after_cents)
		select id, ${step}::smallint, ${now}::timestamptz, ${input.direction === 'up'}::boolean,
			${input.stakePercent}::smallint, ${s.stakeCents}::integer, ${blendedShare(crowd, 'up')}::real,
			${multiplierHundredths}::smallint, ${correct}::boolean, ${s.deltaCents}::integer,
			${s.balanceAfterCents}::integer
		from advanced
		returning step`);
	if (rows.length === 0) error(409, ALREADY_MADE);

	const view = await viewOf(day, today, user, {
		...game,
		step,
		balanceCents: s.balanceAfterCents,
		finishedAt
	});
	return { view, result: view.results.find((r) => r.step === step)! };
}

interface NameInput {
	puzzleNumber: number;
	archive?: boolean;
	/** An option index, or null to skip. */
	choice: number | null;
}

/**
 * Store the player's "Name it" guess, then send the view with the reveal. Only once per game:
 * a second answer just returns the stored one.
 */
export async function nameMoment(
	user: Player,
	input: NameInput,
	now = new Date()
): Promise<GameView> {
	const { today, day } = await dayFor(input.puzzleNumber, !!input.archive, now);
	const { choice } = input;
	const options = await optionsFor(day.puzzle);
	if (choice != null && choice >= options.length) error(400, 'Pick one of the options');
	const where = and(eq(games.userId, user.id), eq(games.puzzleNumber, day.number));
	const [updated] = await db
		.update(games)
		.set({ nameGuess: choice == null ? '' : options[choice].slug })
		.where(and(where, isNotNull(games.finishedAt), isNull(games.nameGuess)))
		.returning();
	const game = updated ?? (await db.select().from(games).where(where))[0];
	if (!game || game.finishedAt == null) error(409, 'Finish the game first');
	return viewOf(day, today, user, game, options);
}

/** Every past day that happened, newest first, with how this player did on each. */
export async function archiveFor(user: Player | null, now = new Date()) {
	const today = todayNumber(now);
	const [days, mine] = await Promise.all([
		db
			.select({ number: schedule.number })
			.from(schedule)
			.where(lt(schedule.number, today))
			.orderBy(desc(schedule.number)),
		user
			? db
					.select({
						number: games.puzzleNumber,
						step: games.step,
						finishedAt: games.finishedAt,
						balanceCents: games.balanceCents,
						right: sql<number>`count(*) filter (where ${guesses.correct})`.mapWith(Number)
					})
					.from(games)
					.leftJoin(guesses, eq(guesses.gameId, games.id))
					.where(and(eq(games.userId, user.id), lt(games.puzzleNumber, today)))
					.groupBy(games.id)
			: []
	]);
	const byNumber = new Map(mine.map((g) => [g.number, g]));
	return {
		today,
		days: days.map(({ number }) => {
			const g = byNumber.get(number);
			return {
				number,
				date: dateForNumber(number),
				played: g
					? {
							step: g.step,
							finished: g.finishedAt != null,
							balanceCents: g.balanceCents,
							right: g.right
						}
					: null
			};
		})
	};
}
