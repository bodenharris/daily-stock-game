/**
 * Money rules. Pure functions, integer arithmetic only.
 *
 * - Balances and stakes are integer cents.
 * - Stakes and crowd bonuses are whole dollars, rounded down, so a balance that starts in whole
 *   dollars stays in whole dollars and the bet, the payout and the balance on screen always agree.
 * - Multipliers are integer hundredths (160 = 1.60x).
 * - Every division rounds down (toward zero for non-negative values), so results are the same on
 *   every device and the player never receives a fraction of a cent the rules did not award.
 */
import { CROWD_RULES, STAKE_OPTIONS } from './config.ts';

export type Direction = 'up' | 'down';

/** How many players called each way before this player, this player excluded. */
export interface CrowdCounts {
	readonly up: number;
	readonly down: number;
}

export interface SettleInput {
	readonly balanceCents: number;
	readonly stakePercent: number;
	/** The multiplier locked when the call was made (see lockMultiplier). */
	readonly multiplierHundredths: number;
	readonly correct: boolean;
}

function assertCount(value: number, name: string): void {
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new RangeError(`${name} must be a non-negative integer, got ${value}`);
	}
}

/**
 * Share of players (0..1) who called `direction`, with the 50/50 prior blended in:
 * (count + prior / 2) / (total + prior). Stored with each call; the share text reads it.
 */
export function blendedShare(counts: CrowdCounts, direction: Direction): number {
	const { priorPlayers } = CROWD_RULES;
	const own = direction === 'up' ? counts.up : counts.down;
	return (own + priorPlayers / 2) / (counts.up + counts.down + priorPlayers);
}

/**
 * The crowd multiplier for calling `direction`, given the split of everyone who called before.
 * m = 1 + slope x (blended share who called the other way - 1/2), rounded half up to hundredths,
 * then clamped. With the default slope of 2 that is simply 2 x the other side's share, never
 * below 1.00x: joining the majority pays even money, beating an 80/20 crowd pays 1.60x.
 * Lock this value at the moment of the call; later players do not change it.
 */
export function lockMultiplier(counts: CrowdCounts, direction: Direction): number {
	const crowd = CROWD_RULES;
	assertCount(counts.up, 'up');
	assertCount(counts.down, 'down');
	const other = direction === 'up' ? counts.down : counts.up;
	const total = counts.up + counts.down;
	// other share - 1/2 = (2 x other - total) / (2 x (total + prior)), kept in integers and
	// rounded half up: floor((2n + d) / 2d).
	const denominator = 2 * (total + crowd.priorPlayers);
	const numerator = 100 * denominator + crowd.slopeHundredths * (2 * other - total);
	const raw = Math.floor((2 * numerator + denominator) / (2 * denominator));
	return Math.min(crowd.maxMultiplierHundredths, Math.max(crowd.minMultiplierHundredths, raw));
}

function stakeOptionFor(stakePercent: number) {
	const option = STAKE_OPTIONS.find((o) => o.percent === stakePercent);
	if (!option) {
		const allowed = STAKE_OPTIONS.map((o) => o.percent).join(', ');
		throw new RangeError(`stake must be one of ${allowed}%, got ${stakePercent}%`);
	}
	return option;
}

/** Cents rounded down to whole dollars. */
function wholeDollarsDown(cents: number): number {
	return Math.floor(cents / 100) * 100;
}

/**
 * Cents at risk for a chip: balance x percent / 100, rounded down to whole dollars. Under $10 the
 * small chip can come to $0, which risks and wins nothing.
 */
export function stakeCentsFor(balanceCents: number, stakePercent: number): number {
	assertCount(balanceCents, 'balanceCents');
	const { percent } = stakeOptionFor(stakePercent);
	return wholeDollarsDown(Math.floor((balanceCents * percent) / 100));
}

/**
 * Settle one call. A wrong call loses the stake. A right call wins the stake back as profit
 * (even money) plus the crowd bonus: balance x chip percent x (multiplier - 1) x chip bonus share,
 * rounded down to whole dollars. It's worked out from the balance, not the rounded stake, so it is
 * the same on every chip (percent x bonus share is 1,000 on each). So a right call never pays
 * less than the stake, and the balance can never go below zero because no chip risks more than
 * the balance.
 */
export function settleCall({
	balanceCents,
	stakePercent,
	multiplierHundredths,
	correct
}: SettleInput) {
	const { minMultiplierHundredths: min, maxMultiplierHundredths: max } = CROWD_RULES;
	if (
		!Number.isSafeInteger(multiplierHundredths) ||
		multiplierHundredths < min ||
		multiplierHundredths > max
	) {
		throw new RangeError(
			`multiplier must be an integer in [${min}, ${max}] hundredths, got ${multiplierHundredths}`
		);
	}
	const stakeCents = stakeCentsFor(balanceCents, stakePercent);
	const { percent, payoutPercent } = stakeOptionFor(stakePercent);
	const bonusCents = wholeDollarsDown(
		Math.floor((balanceCents * percent * (multiplierHundredths - 100) * payoutPercent) / 1_000_000)
	);
	const deltaCents = correct ? stakeCents + bonusCents : -stakeCents;
	return { stakeCents, deltaCents, balanceAfterCents: balanceCents + deltaCents };
}
