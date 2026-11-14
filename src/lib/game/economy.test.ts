import { describe, expect, it } from 'vitest';
import { PAYOUT_RULES, START_BALANCE_CENTS, type PayoutRules } from './config.ts';
import {
	blendedShare,
	formatCents,
	formatMultiplier,
	lockMultiplier,
	settleCall,
	stakeCentsFor,
	stakeOptionFor
} from './economy.ts';

describe('lockMultiplier', () => {
	it('pays even money before anyone has played', () => {
		expect(lockMultiplier({ up: 0, down: 0 }, 'up')).toBe(100);
		expect(lockMultiplier({ up: 0, down: 0 }, 'down')).toBe(100);
	});

	it('pays even money for a 50/50 crowd', () => {
		expect(lockMultiplier({ up: 500, down: 500 }, 'up')).toBe(100);
	});

	it('pays 1.60x for beating a large 80/20 crowd', () => {
		expect(lockMultiplier({ up: 8000, down: 2000 }, 'down')).toBe(160);
	});

	it('floors at 0.50x for joining a lopsided crowd', () => {
		expect(lockMultiplier({ up: 8000, down: 2000 }, 'up')).toBe(50);
		expect(lockMultiplier({ up: 10_000, down: 0 }, 'up')).toBe(50);
	});

	it('never exceeds the cap, even against a unanimous crowd', () => {
		expect(lockMultiplier({ up: 1_000_000, down: 0 }, 'down')).toBe(200);
		const steep: PayoutRules['crowd'] = { ...PAYOUT_RULES.crowd, scaleHundredths: 300 };
		expect(
			lockMultiplier({ up: 1000, down: 0 }, 'down', { ...steep, maxMultiplierHundredths: 250 })
		).toBe(250);
	});

	it('blends a 50/50 prior worth 10 players so early players barely move it', () => {
		// One player called up: share up = (1 + 5) / (1 + 10).
		expect(lockMultiplier({ up: 1, down: 0 }, 'down')).toBe(109);
		expect(lockMultiplier({ up: 1, down: 0 }, 'up')).toBe(91);
		// Ten players all up: (10 + 5) / 20 = 75% up.
		expect(lockMultiplier({ up: 10, down: 0 }, 'down')).toBe(150);
		expect(lockMultiplier({ up: 10, down: 0 }, 'up')).toBe(50);
	});

	it('the prior fades as the crowd grows', () => {
		const small = lockMultiplier({ up: 8, down: 2 }, 'down');
		const large = lockMultiplier({ up: 800, down: 200 }, 'down');
		expect(small).toBeLessThan(large);
		expect(large).toBe(159);
	});

	it('rounds half up, deterministically', () => {
		// 100 x (2 x 100 + 10) / (390 + 10) = 52.5 -> 53
		expect(lockMultiplier({ up: 290, down: 100 }, 'up')).toBe(53);
		// 200 x 1/3 = 66.67 -> 67 ; 200 x 2/3 = 133.33 -> 133
		expect(lockMultiplier({ up: 15, down: 5 }, 'up')).toBe(67);
		expect(lockMultiplier({ up: 15, down: 5 }, 'down')).toBe(133);
	});

	it('is symmetric between up and down', () => {
		for (const [up, down] of [
			[3, 9],
			[120, 45],
			[0, 7]
		]) {
			expect(lockMultiplier({ up, down }, 'up')).toBe(
				lockMultiplier({ up: down, down: up }, 'down')
			);
		}
	});

	it('rejects bad counts and a bad prior', () => {
		expect(() => lockMultiplier({ up: -1, down: 0 }, 'up')).toThrow(RangeError);
		expect(() => lockMultiplier({ up: 1.5, down: 0 }, 'up')).toThrow(RangeError);
		expect(() => lockMultiplier({ up: 0, down: Number.NaN }, 'up')).toThrow(RangeError);
		expect(() =>
			lockMultiplier({ up: 0, down: 0 }, 'up', { ...PAYOUT_RULES.crowd, priorPlayers: 7 })
		).toThrow(RangeError);
	});
});

describe('blendedShare', () => {
	it('is 50% with nobody, and blends the prior', () => {
		expect(blendedShare({ up: 0, down: 0 }, 'up')).toBe(0.5);
		expect(blendedShare({ up: 10, down: 0 }, 'up')).toBe(0.75);
		expect(blendedShare({ up: 10, down: 0 }, 'down')).toBe(0.25);
	});
});

describe('stakes', () => {
	it('offers exactly 10%, 25% and 50%', () => {
		expect(PAYOUT_RULES.stakeOptions.map((o) => o.percent)).toEqual([10, 25, 50]);
	});

	it('rejects any other stake, including more than 50%', () => {
		for (const bad of [0, 5, 30, 51, 75, 100, -10, 12.5]) {
			expect(() => stakeOptionFor(bad)).toThrow(RangeError);
			expect(() =>
				settleCall({
					balanceCents: 10_000,
					stakePercent: bad,
					multiplierHundredths: 100,
					correct: true
				})
			).toThrow(RangeError);
		}
	});

	it('rounds the stake down to whole cents', () => {
		expect(stakeCentsFor(10_000, 25)).toBe(2500);
		expect(stakeCentsFor(333, 25)).toBe(83);
		expect(stakeCentsFor(1, 50)).toBe(0);
		expect(stakeCentsFor(19, 10)).toBe(1);
	});
});

describe('settleCall', () => {
	const base = { balanceCents: START_BALANCE_CENTS, multiplierHundredths: 160 };

	it('a wrong call loses exactly the stake', () => {
		for (const stakePercent of [10, 25, 50]) {
			const s = settleCall({ ...base, stakePercent, correct: false });
			expect(s.deltaCents).toBe(-s.stakeCents);
			expect(s.balanceAfterCents).toBe(10_000 - stakePercent * 100);
		}
	});

	it('a right call wins stake x multiplier on the 10% and 25% chips', () => {
		expect(settleCall({ ...base, stakePercent: 10, correct: true })).toEqual({
			stakeCents: 1000,
			multiplierHundredths: 160,
			paidMultiplierHundredths: 160,
			deltaCents: 1600,
			balanceAfterCents: 11_600,
			correct: true
		});
		expect(settleCall({ ...base, stakePercent: 25, correct: true }).deltaCents).toBe(4000);
	});

	it('the 50% chip earns 80% of the multiplier', () => {
		const s = settleCall({ ...base, stakePercent: 50, correct: true });
		expect(s.paidMultiplierHundredths).toBe(128);
		expect(s.deltaCents).toBe(6400);
		expect(s.balanceAfterCents).toBe(16_400);
	});

	it('rounds winnings down to whole cents', () => {
		// stake 83, x 1.55 = 128.65 -> 128
		const s = settleCall({
			balanceCents: 333,
			stakePercent: 25,
			multiplierHundredths: 155,
			correct: true
		});
		expect(s.stakeCents).toBe(83);
		expect(s.deltaCents).toBe(128);
		expect(s.balanceAfterCents).toBe(461);
		// 50% chip: 0.53 x 80% = 0.424 -> 0.42; stake 50 x 0.42 = 21
		const t = settleCall({
			balanceCents: 101,
			stakePercent: 50,
			multiplierHundredths: 53,
			correct: true
		});
		expect(t.paidMultiplierHundredths).toBe(42);
		expect(t.deltaCents).toBe(21);
	});

	it('never goes below zero and always stays in whole cents', () => {
		let seed = 12345;
		const rand = () => {
			seed = (seed * 1103515245 + 12345) % 2147483648;
			return seed / 2147483648;
		};
		for (let game = 0; game < 2000; game++) {
			let balance = Math.floor(rand() * 20_000);
			for (let call = 0; call < 20; call++) {
				const stakePercent = [10, 25, 50][Math.floor(rand() * 3)];
				const multiplierHundredths = 50 + Math.floor(rand() * 151);
				const s = settleCall({
					balanceCents: balance,
					stakePercent,
					multiplierHundredths,
					correct: rand() < 0.3
				});
				expect(Number.isSafeInteger(s.balanceAfterCents)).toBe(true);
				expect(s.balanceAfterCents).toBeGreaterThanOrEqual(0);
				expect(s.stakeCents).toBeLessThanOrEqual(balance / 2);
				balance = s.balanceAfterCents;
			}
		}
	});

	it('a balance of zero stays zero', () => {
		const s = settleCall({
			balanceCents: 0,
			stakePercent: 50,
			multiplierHundredths: 200,
			correct: true
		});
		expect(s.balanceAfterCents).toBe(0);
	});

	it('rejects bad balances and out-of-range multipliers', () => {
		const ok = { balanceCents: 100, stakePercent: 10, multiplierHundredths: 100, correct: true };
		expect(() => settleCall({ ...ok, balanceCents: -1 })).toThrow(RangeError);
		expect(() => settleCall({ ...ok, balanceCents: 10.5 })).toThrow(RangeError);
		expect(() => settleCall({ ...ok, multiplierHundredths: 49 })).toThrow(RangeError);
		expect(() => settleCall({ ...ok, multiplierHundredths: 201 })).toThrow(RangeError);
		expect(() => settleCall({ ...ok, multiplierHundredths: 1.5 })).toThrow(RangeError);
	});

	it('five max-stake wins against a unanimous crowd is the best possible day', () => {
		let balance = START_BALANCE_CENTS;
		for (let i = 0; i < 5; i++) {
			balance = settleCall({
				balanceCents: balance,
				stakePercent: 50,
				multiplierHundredths: 200,
				correct: true
			}).balanceAfterCents;
		}
		// x1.8 per call
		expect(balance).toBe(188_956);
	});
});

describe('formatting', () => {
	it('formats cents as dollars', () => {
		expect(formatCents(10_000)).toBe('$100.00');
		expect(formatCents(1_234_567)).toBe('$12,345.67');
		expect(formatCents(5)).toBe('$0.05');
		expect(formatCents(-500)).toBe('-$5.00');
		expect(() => formatCents(1.5)).toThrow(RangeError);
	});

	it('formats multipliers', () => {
		expect(formatMultiplier(160)).toBe('1.60×');
		expect(formatMultiplier(50)).toBe('0.50×');
	});
});
