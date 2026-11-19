/** Shapes sent from the server to the game screen. Shared by client and server. */
import type { Direction } from '#lib/game/economy.ts';
import type { Standing } from './standing.ts';

export type { Direction };

export interface CallResult {
	/** 1-based call number. */
	step: number;
	direction: Direction;
	stakeCents: number;
	correct: boolean;
	deltaCents: number;
	balanceAfterCents: number;
	/** Share of other players (blended with the prior) who called up when this call was placed. */
	crowdUpShareAtCall: number;
	/** How much the price moved over this call's stretch, in percent (e.g. -6.5). */
	move: number;
	/** Live crowd for this step, including this player. */
	crowd: { up: number; down: number };
}

export interface Reveal {
	ticker: string;
	headline: string;
	story: string;
	/** ISO dates for every bar in `closes`. */
	dates: string[];
	/** Closes as quoted on each day (later splits undone), for every bar. */
	closes: number[];
	/** A year after the puzzle ended, if the stock still traded. */
	hindsight: { date: string; close: number; change: number } | null;
}

/** The "Name it" step between the last call and the reveal. */
export interface NameIt {
	/** The four moments offered, in the order shown. The same for every player. */
	options: string[];
	/** Answered or skipped. The reveal is withheld until it is. */
	answered: boolean;
	/** Index picked; null when skipped or not answered yet. */
	guess: number | null;
	/** Index of the right moment, only once answered. */
	answer: number | null;
	/**
	 * ISO dates of the chart's first and last bars, shown on its axis while the player names
	 * the moment. Nothing else identifying (ticker, prices, headline) goes out before the reveal.
	 */
	span: [string, string];
}

export interface GameView {
	/** 1-based puzzle number, the same for everyone on a given Eastern calendar day. */
	number: number;
	/** Eastern calendar date (YYYY-MM-DD) this puzzle belongs to. */
	date: string;
	calls: number;
	contextBars: number;
	stepBars: number;
	/**
	 * Visible bars only, normalised so the last context close is 100.
	 * Raw prices and dates stay on the server until the reveal.
	 */
	bars: number[];
	balanceCents: number;
	results: CallResult[];
	finished: boolean;
	reveal: Reveal | null;
	/** Epoch ms when the next puzzle unlocks. */
	nextPuzzleAt: number;
	signedIn: boolean;
	/** Email of a signed-in (non-anonymous) player. */
	email: string | null;
	streak: number;
	/** Where this finish stands among today's players (finished games only). */
	standing: Standing | null;
	/** "Name it" for a finished game; null before the last call. */
	nameIt: NameIt | null;
	/** Where everyone finished that day, sent with the reveal only. */
	finishes: Finishes | null;
}

/** Finishes in one bucket: `cents` is its lower edge; the FINISH_CAP_CENTS bucket is open-ended. */
export interface FinishBucket {
	cents: number;
	count: number;
}

/** The day's final balances, for the end screen's curve. Nobody is named. */
export interface Finishes {
	/** Finished games per $10 bucket, lowest first; only non-empty buckets. */
	buckets: FinishBucket[];
	/** The viewer's exact place by final balance (1-based; ties share the better place). */
	place: number;
	/** Finished games on this day, the viewer's included. */
	finished: number;
	/** The day's best final balance (the pack leader's), exact. Never who it belongs to. */
	leaderCents: number;
}
