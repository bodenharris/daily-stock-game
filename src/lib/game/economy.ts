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
	/**
	 * What a right call pays per dollar staked, for display (see paidMultiplierFor). Never below
	 * 100. The exact cents are in deltaCents.
	 */
	readonly paidMultiplierHundredths: number;
	/** The crowd-bonus part of a right call's winnings (0 on a wrong call or at 1.00x). */
	readonly bonusCents: number;
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

/** Integer division rounding half up (toward +infinity on ties), for a positive denominator. */
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
 * m = 1 + slope x (blended share who called the other way - 1/2), rounded half up to hundredths,
 * then clamped. With the default slope of 2 that is simply 2 x the other side's share, never
 * below 1.00x: joining the majority pays even money, beating an 80/20 crowd pays 1.60x.
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
	// other share - 1/2 = (2 x other - total) / (2 x (total + prior)), kept in integers.
	const denominator = 2 * (total + crowd.priorPlayers);
	const numerator = 100 * denominator + crowd.slopeHundredths * (2 * other - total);
	const raw = divideRoundHalfUp(numerator, denominator);
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
 * What a right call pays per dollar staked on this chip, in hundredths, for display:
 * 1 + (crowd multiplier - 1) x the chip's share of the crowd bonus. Never below 1.00x.
 */
export function paidMultiplierFor(
	multiplierHundredths: number,
	stakePercent: number,
	rules: PayoutRules = PAYOUT_RULES
): number {
	const option = stakeOptionFor(stakePercent, rules);
	return 100 + Math.floor(((multiplierHundredths - 100) * option.payoutPercent) / 100);
}

/**
 * Settle one call. A wrong call loses the stake. A right call wins the stake back as profit
 * (even money) plus the crowd bonus: floor(stake x (multiplier - 1) x chip bonus share). So a
 * right call never pays less than the stake, and the balance can never go below zero because
 * no chip risks more than the balance.
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
	if (crowd.minMultiplierHundredths < 100) {
		throw new RangeError('a right call must never pay less than the stake: min multiplier < 1');
	}
	const option = stakeOptionFor(stakePercent, rules);
	if (option.percent <= 0 || option.percent > 100) {
		throw new RangeError('stake percent must be in (0, 100]');
	}
	const stakeCents = Math.floor((balanceCents * option.percent) / 100);
	const bonusCents = Math.floor(
		(stakeCents * (multiplierHundredths - 100) * option.payoutPercent) / 10_000
	);
	const deltaCents = correct ? stakeCents + bonusCents : -stakeCents;
	return {
		stakeCents,
		multiplierHundredths,
		paidMultiplierHundredths: paidMultiplierFor(multiplierHundredths, stakePercent, rules),
		bonusCents: correct ? bonusCents : 0,
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
