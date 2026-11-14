/** Shapes sent from the server to the game screen. Shared by client and server. */

export type Direction = 'up' | 'down';

export interface CallResult {
	/** 1-based call number. */
	step: number;
	direction: Direction;
	stakePercent: number;
	stakeCents: number;
	/** Crowd multiplier locked when the call was made, in hundredths. */
	multiplierHundredths: number;
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
	company: string;
	headline: string;
	story: string;
	/** ISO dates for every bar in `closes`. */
	dates: string[];
	/** Closes as quoted on each day (later splits undone), for every bar. */
	closes: number[];
	/** Percent move of each stretch, e.g. -12.3. */
	moves: number[];
	/** A year after the puzzle ended, if the stock still traded. */
	hindsight: { date: string; close: number; change: number } | null;
}

export interface GameView {
	/** 1-based puzzle number, the same for everyone on a given Eastern calendar day. */
	number: number;
	/** Eastern calendar date (YYYY-MM-DD) this puzzle belongs to. */
	date: string;
	calls: number;
	contextBars: number;
	stepBars: number;
	totalBars: number;
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
	standing: { betterThan: number | null; finished: number } | null;
	/** Real or Random score, once played. */
	bonus: { correct: number; total: number } | null;
}

export interface CallResponse {
	view: GameView;
	result: CallResult;
}
