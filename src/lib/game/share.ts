/**
 * The share text. Example (5 calls, chips 10/25/50%):
 *
 *   Hindsight #12 · $100 → $153.48
 *   ⬛⬛🟨⬛⬛
 *   ⬛🟨🟨⬛🟥
 *   🟩🟨🟨🟥🟥
 *   🙃 The Contrarian
 *   https://hindsight.example
 *
 * Each column is one call. Its height is the stake (1 row = smallest chip, 3 = biggest), its colour
 * the result: 🟩 right, 🟥 wrong, 🟨 right while most players called it the other way.
 *
 * Spoiler rule: nothing here depends on whether a call was up or down, so the text reveals
 * neither the chart's direction nor its shape. Only right/wrong, stake size and crowd position.
 *
 * Rendering: the first line is what lock-screen previews show, so it carries the result. Only
 * Unicode 6-12 colour squares and old emoji (all fixed width) are used, so columns line up on
 * iOS, Android, Windows, Discord and Slack, with no variation selectors to garble. The URL goes
 * last on its own line so iMessage, WhatsApp and Slack unfurl it as a preview card.
 */
import {
	CALLS_PER_GAME,
	GAME_NAME,
	PAYOUT_RULES,
	SITE_URL,
	START_BALANCE_CENTS
} from './config.ts';
import { classifyArchetype, type Archetype, type CallRecord } from './archetype.ts';
import { formatCents } from './economy.ts';

export const SHARE_CELLS = {
	right: '🟩',
	wrong: '🟥',
	beatCrowd: '🟨',
	emptyDark: '⬛',
	emptyLight: '⬜'
} as const;

export interface BonusResult {
	/** e.g. "Real or Random" */
	readonly label: string;
	readonly correct: number;
	readonly total: number;
}

export interface ShareInput {
	readonly puzzleNumber: number;
	readonly calls: readonly CallRecord[];
	/** Defaults to the classification of `calls`. */
	readonly archetype?: Archetype;
	readonly bonus?: BonusResult;
	/** Defaults to SITE_URL. */
	readonly url?: string;
	/** Empty-cell colour: ⬛ reads best on dark chat themes, ⬜ on light ones. Default dark. */
	readonly theme?: 'dark' | 'light';
	readonly gameName?: string;
	readonly startBalanceCents?: number;
}

function cellFor(call: CallRecord): string {
	if (!call.correct) return SHARE_CELLS.wrong;
	return call.crowdShareOwn < 0.5 ? SHARE_CELLS.beatCrowd : SHARE_CELLS.right;
}

/** The stake bars, top row first. Exported for the results screen. */
export function shareGrid(
	calls: readonly CallRecord[],
	theme: 'dark' | 'light' = 'dark'
): string[] {
	const chips = PAYOUT_RULES.stakeOptions.map((o) => o.percent).sort((a, b) => a - b);
	const empty = theme === 'light' ? SHARE_CELLS.emptyLight : SHARE_CELLS.emptyDark;
	const heights = calls.map((call) => {
		const level = chips.indexOf(call.stakePercent);
		if (level < 0) throw new RangeError(`unknown stake ${call.stakePercent}%`);
		return level + 1;
	});
	const rows: string[] = [];
	for (let row = chips.length; row >= 1; row--) {
		rows.push(calls.map((call, i) => (heights[i] >= row ? cellFor(call) : empty)).join(''));
	}
	return rows;
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
		`${name} #${puzzleNumber.toLocaleString('en-US')} · ${formatDollars(start)} → ${formatDollars(final)}`,
		...shareGrid(calls, input.theme),
		`${archetype.emoji} ${archetype.label}`
	];
	if (input.bonus) {
		const { label, correct, total } = input.bonus;
		lines.push(`🎲 ${label} ${correct}/${total}`);
	}
	lines.push(input.url ?? SITE_URL);
	return lines.join('\n');
}

/** "$100" for whole dollars, "$142.50" otherwise: short where it can be, exact always. */
function formatDollars(cents: number): string {
	const text = formatCents(cents);
	return text.endsWith('.00') ? text.slice(0, -3) : text;
}
