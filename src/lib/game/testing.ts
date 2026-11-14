/** Test helpers: build realistic finished games through the real settlement code. */
import { CALLS_PER_GAME, PAYOUT_RULES, START_BALANCE_CENTS } from './config.ts';
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

/**
 * Deterministic random full games (seeded Park-Miller): any chip, right or wrong at even odds,
 * any crowd split, any direction.
 */
export function randomGames(count: number, seed = 99): CallSpec[][] {
	let state = seed;
	const rand = () => {
		state = (state * 16807) % 2147483647;
		return state / 2147483647;
	};
	const chips = PAYOUT_RULES.stakeOptions.map((o) => o.percent);
	return Array.from({ length: count }, () =>
		Array.from({ length: CALLS_PER_GAME }, (): CallSpec => {
			const direction: Direction = rand() < 0.5 ? 'up' : 'down';
			return [chips[Math.floor(rand() * chips.length)], rand() < 0.5, rand(), direction];
		})
	);
}

/** The same game with every call made the other way (same stakes, results and crowd side). */
export function flipDirections(specs: readonly CallSpec[]): CallSpec[] {
	return specs.map(([s, c, share, d = 'up']) => [s, c, share, d === 'up' ? 'down' : 'up']);
}
