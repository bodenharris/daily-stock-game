/** Test helpers: build realistic finished games through the real settlement code. */
import { PAYOUT_RULES, START_BALANCE_CENTS } from './config.ts';
import type { CallRecord } from './archetype.ts';
import { settleCall, type Direction } from './economy.ts';

/** [stake percent, right?, crowd share on own side (0..1), direction] */
export type CallSpec = readonly [number, boolean, number, Direction?];

/** Plays the calls in order from the start balance. Multiplier = 2 x (1 - own share), clamped. */
export function playGame(specs: readonly CallSpec[]): CallRecord[] {
	const { minMultiplierHundredths: min, maxMultiplierHundredths: max } = PAYOUT_RULES.crowd;
	let balance = START_BALANCE_CENTS;
	return specs.map(([stakePercent, correct, crowdShareOwn, direction = 'up']) => {
		const multiplierHundredths = Math.min(
			max,
			Math.max(min, Math.round(PAYOUT_RULES.crowd.scaleHundredths * (1 - crowdShareOwn)))
		);
		const s = settleCall({ balanceCents: balance, stakePercent, multiplierHundredths, correct });
		balance = s.balanceAfterCents;
		return {
			direction,
			stakePercent,
			correct,
			crowdShareOwn,
			multiplierHundredths,
			balanceAfterCents: balance
		};
	});
}
