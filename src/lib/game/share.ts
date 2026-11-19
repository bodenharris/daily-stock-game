/**
 * The share text. Wordle is the benchmark: one row a stranger reads at a glance.
 *
 *   The Wolf #12 · $100 → $146
 *   🟩⭐⭐🟥🟥
 *   🐺 Hunter · 3rd of 6 today
 *   https://thewolfof.nyc
 *
 * One square per call: 🟩 right, 🟥 wrong, ⭐ right while most players called it the other way.
 * Green and red need no legend, and a star reads as "a standout right call" without one (unlike
 * 🟨, which Wordle players read as "half right"). Stake size is left out: it is already in the
 * dollar result. Money is whole dollars, rounded like the in-game balance.
 *
 * Spoiler rule: a call record holds no direction, so the text can reveal neither the chart's
 * direction nor its shape. Only right/wrong, crowd position, the balance and the rank.
 *
 * Rendering: the first line is what lock-screen previews show, so it carries the result. Only
 * single-code-point emoji every major platform has rendered for years, with no variation
 * selectors to garble. The URL goes last on its own line so iMessage, WhatsApp and Slack unfurl
 * it as a preview card.
 */
import { dollars } from '#lib/play/format.ts';
import { GAME_NAME, SITE_URL, START_BALANCE_CENTS } from './config.ts';
import { PACK_EMOJI, rankLine, type PackRank } from './rank.ts';

/** One settled call, as the share text reads it. */
export interface CallRecord {
	readonly correct: boolean;
	/**
	 * Share (0..1) of the crowd on the player's side when the call was locked, prior included,
	 * player excluded. Below 0.5 = minority side.
	 */
	readonly crowdShareOwn: number;
	readonly balanceAfterCents: number;
}

export interface ShareInput {
	readonly puzzleNumber: number;
	readonly calls: readonly CallRecord[];
	/** The player's Wolf Pack Rank. Without one (the day's finishes couldn't be read), no rank line. */
	readonly rank?: PackRank | null;
	/** Optional standing, e.g. "2nd of 5 today", added to the rank line. */
	readonly standing?: string | null;
	/** Named the moment before the reveal: adds a 🎯 after the row. */
	readonly named?: boolean;
	/** Defaults to SITE_URL. */
	readonly url?: string;
}

/** One cell per call, in order. */
export function shareRow(calls: readonly CallRecord[]): string {
	return calls.map((c) => (!c.correct ? '🟥' : c.crowdShareOwn < 0.5 ? '⭐' : '🟩')).join('');
}

/** The full share text, lines joined with "\n". */
export function buildShareText(input: ShareInput): string {
	const final = input.calls.at(-1)?.balanceAfterCents ?? START_BALANCE_CENTS;
	const lines = [
		`${GAME_NAME} #${input.puzzleNumber.toLocaleString('en-US')} · ${dollars(START_BALANCE_CENTS)} → ${dollars(final)}`,
		shareRow(input.calls) + (input.named ? ' 🎯' : '')
	];
	if (input.rank) lines.push(`${PACK_EMOJI} ${rankLine(input.rank, input.standing ?? null)}`);
	lines.push(input.url ?? SITE_URL);
	return lines.join('\n');
}
