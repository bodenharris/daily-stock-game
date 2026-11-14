/**
 * Money rules. Pure functions, integer arithmetic only.
 *
 * - Balances and stakes are integer cents.
 * - Multipliers are integer hundredths (160 = 1.60x).
 * - Every division rounds down (toward zero for non-negative values), so results are the same on
 *   every device and the player never receives a fraction of a cent the rules did not award.
 */
import { PAYOUT_RULES, type CrowdRules, type PayoutRules, type StakeOption } from './config.ts';

export type Direction = 'up' | 'down';

export interface CrowdCounts {
	/** Players who called up before this player, excluding this player. */
	readonly up: number;
	/** Players who called down before this player, excluding this player. */
	readonly down: number;
}

export interface SettleInput {
	readonly balanceCents: number;
	readonly stakePercent: number;
	/** The multiplier locked when the call was made (see lockMultiplier). */
	readonly multiplierHundredths: number;
	readonly correct: boolean;
}

export interface Settlement {
	readonly stakeCents: number;
	/** The locked crowd multiplier. */
	readonly multiplierHundredths: number;
	/** The multiplier actually paid on a right call: crowd multiplier x the chip's payout share. */
	readonly paidMultiplierHundredths: number;
	/** Change in balance: -stakeCents on a wrong call, the winnings on a right call. */
	readonly deltaCents: number;
	readonly balanceAfterCents: number;
	readonly correct: boolean;
}

function assertCount(value: number, name: string): void {
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new RangeError(`${name} must be a non-negative integer, got ${value}`);
	}
}

/** Integer division rounding half up, for non-negative numerator and positive denominator. */
function divideRoundHalfUp(numerator: number, denominator: number): number {
	return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

/**
 * Share of players (0..1) who called `direction`, with the 50/50 prior blended in:
 * (count + prior / 2) / (total + prior). For display and for the archetype.
 */
export function blendedShare(
	counts: CrowdCounts,
	direction: Direction,
	crowd: CrowdRules = PAYOUT_RULES.crowd
): number {
	assertCount(counts.up, 'up');
	assertCount(counts.down, 'down');
	const own = direction === 'up' ? counts.up : counts.down;
	const total = counts.up + counts.down;
	return (own + crowd.priorPlayers / 2) / (total + crowd.priorPlayers);
}

/**
 * The crowd multiplier for calling `direction`, given the split of everyone who called before.
 * m = scale x (blended share who called the other way), rounded half up to hundredths, clamped.
 * Lock this value at the moment of the call; later players do not change it.
 */
export function lockMultiplier(
	counts: CrowdCounts,
	direction: Direction,
	crowd: CrowdRules = PAYOUT_RULES.crowd
): number {
	assertCount(counts.up, 'up');
	assertCount(counts.down, 'down');
	if (crowd.priorPlayers <= 0 || crowd.priorPlayers % 2 !== 0) {
		throw new RangeError('priorPlayers must be a positive even number');
	}
	const other = direction === 'up' ? counts.down : counts.up;
	const total = counts.up + counts.down;
	// scale x (other + prior/2) / (total + prior), kept in integers by doubling both sides.
	const raw = divideRoundHalfUp(
		crowd.scaleHundredths * (2 * other + crowd.priorPlayers),
		2 * (total + crowd.priorPlayers)
	);
	return Math.min(crowd.maxMultiplierHundredths, Math.max(crowd.minMultiplierHundredths, raw));
}

export function stakeOptionFor(
	stakePercent: number,
	rules: PayoutRules = PAYOUT_RULES
): StakeOption {
	const option = rules.stakeOptions.find((o) => o.percent === stakePercent);
	if (!option) {
		const allowed = rules.stakeOptions.map((o) => o.percent).join(', ');
		throw new RangeError(`stake must be one of ${allowed}%, got ${stakePercent}%`);
	}
	return option;
}

/** Cents at risk for a chip: floor(balance x percent / 100). */
export function stakeCentsFor(
	balanceCents: number,
	stakePercent: number,
	rules: PayoutRules = PAYOUT_RULES
): number {
	assertCount(balanceCents, 'balanceCents');
	const option = stakeOptionFor(stakePercent, rules);
	return Math.floor((balanceCents * option.percent) / 100);
}

/**
 * Settle one call. A wrong call loses the stake. A right call wins
 * floor(stake x crowd multiplier x chip payout share). The balance can never go below zero
 * because no chip risks more than the balance.
 */
export function settleCall(input: SettleInput, rules: PayoutRules = PAYOUT_RULES): Settlement {
	const { balanceCents, stakePercent, multiplierHundredths, correct } = input;
	assertCount(balanceCents, 'balanceCents');
	const { crowd } = rules;
	if (
		!Number.isSafeInteger(multiplierHundredths) ||
		multiplierHundredths < crowd.minMultiplierHundredths ||
		multiplierHundredths > crowd.maxMultiplierHundredths
	) {
		throw new RangeError(
			`multiplier must be an integer in [${crowd.minMultiplierHundredths}, ${crowd.maxMultiplierHundredths}] hundredths, got ${multiplierHundredths}`
		);
	}
	const option = stakeOptionFor(stakePercent, rules);
	if (option.percent <= 0 || option.percent > 100) {
		throw new RangeError('stake percent must be in (0, 100]');
	}
	const stakeCents = Math.floor((balanceCents * option.percent) / 100);
	const paidMultiplierHundredths = Math.floor((multiplierHundredths * option.payoutPercent) / 100);
	const deltaCents = correct
		? Math.floor((stakeCents * paidMultiplierHundredths) / 100)
		: -stakeCents;
	return {
		stakeCents,
		multiplierHundredths,
		paidMultiplierHundredths,
		deltaCents,
		balanceAfterCents: balanceCents + deltaCents,
		correct
	};
}

/** "$1,234.56". Negative values get a leading minus: "-$5.00". */
export function formatCents(cents: number): string {
	if (!Number.isSafeInteger(cents)) throw new RangeError(`cents must be an integer, got ${cents}`);
	const sign = cents < 0 ? '-' : '';
	const abs = Math.abs(cents);
	const dollars = Math.floor(abs / 100).toLocaleString('en-US');
	const rest = String(abs % 100).padStart(2, '0');
	return `${sign}$${dollars}.${rest}`;
}

/** "1.60×" */
export function formatMultiplier(hundredths: number): string {
	return `${(hundredths / 100).toFixed(2)}×`;
}
