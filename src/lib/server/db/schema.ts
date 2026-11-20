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
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema.ts';

/** Every ticker we hold price history for. `bars` is its row count in `prices`. */
export const tickers = pgTable('tickers', {
  symbol: text('symbol').primaryKey(),
  name: text('name').notNull(),
  firstDate: date('first_date'),
  lastDate: date('last_date'),
  bars: integer('bars').notNull().default(0),
});

/** Daily bars, split-adjusted but not dividend-adjusted, so prices match the quotes people remember. */
export const prices = pgTable(
  'prices',
  {
    ticker: text('ticker').notNull(),
    ts: date('ts').notNull(),
    open: doublePrecision('open').notNull(),
    high: doublePrecision('high').notNull(),
    low: doublePrecision('low').notNull(),
    close: doublePrecision('close').notNull(),
    volume: bigint('volume', { mode: 'number' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.ticker, t.ts] })],
);

/** Stock splits. The reveal undoes later ones to show the quotes of the day (GameStop's $347, not $87). */
export const splits = pgTable(
  'splits',
  {
    ticker: text('ticker').notNull(),
    ts: date('ts').notNull(),
    factor: doublePrecision('factor').notNull(),
  },
  (t) => [primaryKey({ columns: [t.ticker, t.ts] })],
);

/** The private catalog of famous market moments. A negative position retires a puzzle. */
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
  calls: smallint('calls').notNull(),
});

/**
 * Which puzzle each daily number shows. Written the first time the number is loaded, so a day's
 * puzzle never changes afterwards, even if the catalog is edited.
 */
export const schedule = pgTable('schedule', {
  number: integer('number').primaryKey(),
  slug: text('slug')
    .notNull()
    .references(() => puzzles.slug),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** One row per player per daily puzzle. */
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
    /** Calls made so far. */
    step: smallint('step').notNull().default(0),
    balanceCents: integer('balance_cents').notNull(),
    /** "Name it": the slug picked, '' when skipped, null until answered. The reveal waits for it. */
    nameGuess: text('name_guess'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    unique('games_user_puzzle_unique').on(t.userId, t.puzzleNumber),
    index('games_puzzle_finished_idx').on(t.puzzleNumber, t.finishedAt),
  ],
);

/** One row per call. The primary key is what makes a call count once, however often it is sent. */
export const guesses = pgTable(
  'guesses',
  {
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    /** 1-based call number. */
    step: smallint('step').notNull(),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
    up: boolean('up').notNull(),
    stakePercent: smallint('stake_percent').notNull(),
    stakeCents: integer('stake_cents').notNull(),
    /** Share of earlier players (prior blended in) who had called up when this call was made. */
    crowdUpShare: real('crowd_up_share').notNull(),
    /** The crowd multiplier locked at the call. */
    multiplierHundredths: smallint('multiplier_hundredths').notNull(),
    correct: boolean('correct').notNull(),
    deltaCents: integer('delta_cents').notNull(),
    balanceAfterCents: integer('balance_after_cents').notNull(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.step] }), index('guesses_ts_idx').on(t.ts)],
);

export * from './auth.schema.ts';
