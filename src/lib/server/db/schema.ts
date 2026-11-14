import {
	bigint,
	boolean,
	date,
	doublePrecision,
	index,
	integer,
	pgTable,
	primaryKey,
	real,
	smallint,
	text,
	timestamp,
	unique,
	uuid
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

/** Every ticker we hold price history for. Ordinary table. */
export const tickers = pgTable('tickers', {
	symbol: text('symbol').primaryKey(),
	name: text('name').notNull(),
	firstDate: date('first_date'),
	lastDate: date('last_date'),
	bars: integer('bars').notNull().default(0)
});

/**
 * Daily bars, split-adjusted (not dividend-adjusted).
 * TimescaleDB hypertable partitioned on `ts`, compressed (columnstore) segmented by ticker.
 * The hypertable, compression and policies live in a hand-written migration.
 */
export const prices = pgTable(
	'prices',
	{
		ticker: text('ticker').notNull(),
		ts: date('ts').notNull(),
		open: doublePrecision('open').notNull(),
		high: doublePrecision('high').notNull(),
		low: doublePrecision('low').notNull(),
		close: doublePrecision('close').notNull(),
		volume: bigint('volume', { mode: 'number' }).notNull()
	},
	(t) => [primaryKey({ columns: [t.ticker, t.ts] })]
);

/**
 * Stock splits from Tiingo. Prices are stored split-adjusted; this lets the reveal show the
 * quotes people actually saw at the time (GameStop's $347, not $87).
 */
export const splits = pgTable(
	'splits',
	{
		ticker: text('ticker').notNull(),
		ts: date('ts').notNull(),
		factor: doublePrecision('factor').notNull()
	},
	(t) => [primaryKey({ columns: [t.ticker, t.ts] })]
);

/** Hand-picked famous market moments. Ordinary table, seeded from the catalog in code. */
export const puzzles = pgTable('puzzles', {
	slug: text('slug').primaryKey(),
	position: integer('position').notNull().unique(),
	ticker: text('ticker')
		.notNull()
		.references(() => tickers.symbol),
	company: text('company').notNull(),
	headline: text('headline').notNull(),
	story: text('story').notNull(),
	lastContextDate: date('last_context_date').notNull(),
	contextBars: integer('context_bars').notNull(),
	stepBars: integer('step_bars').notNull(),
	calls: smallint('calls').notNull()
});

/**
 * Which puzzle each daily number shows. Written once, the first time a number is played, so a
 * day's puzzle never changes afterwards (even if the catalog is edited) and the order is not
 * readable from the public repo (it comes from a server secret).
 */
export const schedule = pgTable('schedule', {
	number: integer('number').primaryKey(),
	slug: text('slug')
		.notNull()
		.references(() => puzzles.slug),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

/** One row per player per daily puzzle. Ordinary table; holds the game state. */
export const games = pgTable(
	'games',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		puzzleNumber: integer('puzzle_number').notNull(),
		puzzleSlug: text('puzzle_slug')
			.notNull()
			.references(() => puzzles.slug),
		step: smallint('step').notNull().default(0),
		balanceCents: integer('balance_cents').notNull(),
		archetype: text('archetype'),
		bonusCorrect: smallint('bonus_correct'),
		/** Real-or-random guesses in order, stored before each answer is revealed. */
		bonusGuesses: boolean('bonus_guesses').array(),
		bonusTotal: smallint('bonus_total'),
		source: text('source').notNull().default('real'),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
		finishedAt: timestamp('finished_at', { withTimezone: true })
	},
	(t) => [
		unique('games_user_puzzle_unique').on(t.userId, t.puzzleNumber),
		index('games_puzzle_finished_idx').on(t.puzzleNumber, t.finishedAt)
	]
);

/**
 * One row per call. TimescaleDB hypertable on `ts` (hand-written migration).
 * Feeds the crowd-split continuous aggregate, which feeds the payout and the stats page.
 */
export const guesses = pgTable(
	'guesses',
	{
		ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
		gameId: uuid('game_id')
			.notNull()
			.references(() => games.id, { onDelete: 'cascade' }),
		puzzleNumber: integer('puzzle_number').notNull(),
		step: smallint('step').notNull(),
		up: boolean('up').notNull(),
		stakeBp: smallint('stake_bp').notNull(),
		stakeCents: integer('stake_cents').notNull(),
		crowdUpShare: real('crowd_up_share').notNull(),
		multiplier: real('multiplier').notNull(),
		correct: boolean('correct').notNull(),
		deltaCents: integer('delta_cents').notNull(),
		balanceAfterCents: integer('balance_after_cents').notNull(),
		source: text('source').notNull().default('real')
	},
	(t) => [
		primaryKey({ columns: [t.gameId, t.step, t.ts] }),
		index('guesses_puzzle_step_ts_idx').on(t.puzzleNumber, t.step, t.ts.desc())
	]
);

export const sources = ['real', 'dev', 'sim'] as const;
export type Source = (typeof sources)[number];

export * from './auth.schema';
