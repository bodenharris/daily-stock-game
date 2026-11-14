/**
 * The share text. Wordle is the benchmark: one row a stranger reads at a glance.
 *
 *   The Wolf #12 · $100 → $146
 *   🟩⭐⭐🟥🟥
 *   🙃 The Contrarian
 *   https://thewolf.example
 *
 * One square per call: 🟩 right, 🟥 wrong, ⭐ right while most players called it the other way.
 * Green and red need no legend, and a star reads as "a standout right call" without one (unlike
 * 🟨, which Wordle players read as "half right"). Stake size is left out: it is already in the
 * dollar result, and drawing it took three rows that nobody could decode.
 *
 * Money is whole dollars, rounded the same way the app's balance is, so the text never says
 * $29.30 while the screen says $29.
 *
 * Spoiler rule: nothing here depends on whether a call was up or down, so the text reveals
 * neither the chart's direction nor its shape. Only right/wrong, crowd position and the balance.
 *
 * Rendering: the first line is what lock-screen previews show, so it carries the result. Only
 * single-code-point emoji every major platform has rendered for years, with no variation
 * selectors to garble. The URL goes last on its own line so iMessage, WhatsApp and Slack unfurl
 * it as a preview card. At most 5 lines.
 */
import { CALLS_PER_GAME, GAME_NAME, SITE_URL, START_BALANCE_CENTS } from './config.ts';
import { classifyArchetype, type Archetype, type CallRecord } from './archetype.ts';

export const SHARE_CELLS = {
	right: '🟩',
	wrong: '🟥',
	beatCrowd: '⭐'
} as const;

export interface ShareInput {
	readonly puzzleNumber: number;
	readonly calls: readonly CallRecord[];
	/** Defaults to the classification of `calls`. */
	readonly archetype?: Archetype;
	/** Defaults to SITE_URL. */
	readonly url?: string;
	/** @deprecated Ignored: the one-row text has no empty cells to colour. Still accepted. */
	readonly theme?: 'dark' | 'light';
	readonly gameName?: string;
	/** Optional standing, e.g. "2nd of 5 today", added to the archetype line. Spoils nothing. */
	readonly standing?: string | null;
	/** Named the moment before the reveal: adds a 🎯 after the row. Spoils nothing. */
	readonly named?: boolean;
	readonly startBalanceCents?: number;
}

function cellFor(call: CallRecord): string {
	if (!call.correct) return SHARE_CELLS.wrong;
	return call.crowdShareOwn < 0.5 ? SHARE_CELLS.beatCrowd : SHARE_CELLS.right;
}

/** One cell per call, in order. Exported for the results screen. */
export function shareRow(calls: readonly CallRecord[]): string {
	return calls.map(cellFor).join('');
}

/**
 * "$1,049": whole dollars, half rounded up, like the in-game balance
 * (`dollars(cents, { cents: false })` in src/lib/play/money.ts).
 */
export function formatWholeDollars(cents: number): string {
	if (!Number.isSafeInteger(cents) || cents < 0) {
		throw new RangeError(`cents must be a non-negative integer, got ${cents}`);
	}
	return `$${Math.floor((cents + 50) / 100).toLocaleString('en-US')}`;
}

/** The full share text, lines joined with "\n". */
export function buildShareText(input: ShareInput): string {
	const { calls, puzzleNumber } = input;
	if (calls.length === 0) throw new RangeError('cannot share a game with no calls');
	if (calls.length > CALLS_PER_GAME) {
		throw new RangeError(`a game has at most ${CALLS_PER_GAME} calls, got ${calls.length}`);
	}
	if (!Number.isSafeInteger(puzzleNumber) || puzzleNumber < 1) {
		throw new RangeError(`puzzle number must be a positive integer, got ${puzzleNumber}`);
	}
	const start = input.startBalanceCents ?? START_BALANCE_CENTS;
	const final = calls[calls.length - 1].balanceAfterCents;
	const archetype = input.archetype ?? classifyArchetype(calls, { startBalanceCents: start });
	const name = input.gameName ?? GAME_NAME;

	const lines = [
		`${name} #${puzzleNumber.toLocaleString('en-US')} · ${formatWholeDollars(start)} → ${formatWholeDollars(final)}`,
		shareRow(calls) + (input.named ? ' 🎯' : ''),
		`${archetype.emoji} ${archetype.label}${input.standing ? ` · ${input.standing}` : ''}`
	];
	lines.push(input.url ?? SITE_URL);
	return lines.join('\n');
}
