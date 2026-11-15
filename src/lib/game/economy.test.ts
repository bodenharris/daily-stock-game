import { describe, expect, it } from 'vitest';
import { PAYOUT_RULES, START_BALANCE_CENTS, type PayoutRules } from './config.ts';
import {
	blendedShare,
	formatCents,
	formatMultiplier,
	lockMultiplier,
	paidMultiplierFor,
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

	it('is 1.60x for beating a large 80/20 crowd', () => {
		expect(lockMultiplier({ up: 8000, down: 2000 }, 'down')).toBe(160);
	});

	it('never drops below 1.00x, however lopsided the crowd you join', () => {
		expect(lockMultiplier({ up: 8000, down: 2000 }, 'up')).toBe(100);
		expect(lockMultiplier({ up: 10_000, down: 0 }, 'up')).toBe(100);
		for (let up = 0; up <= 60; up++) {
			for (const direction of ['up', 'down'] as const) {
				expect(lockMultiplier({ up, down: 60 - up }, direction)).toBeGreaterThanOrEqual(100);
			}
		}
	});

	it('never exceeds the cap, even against a unanimous crowd', () => {
		expect(lockMultiplier({ up: 1_000_000, down: 0 }, 'down')).toBe(200);
		const steep: PayoutRules['crowd'] = {
			...PAYOUT_RULES.crowd,
			slopeHundredths: 400,
			maxMultiplierHundredths: 250
		};
		expect(lockMultiplier({ up: 1_000_000, down: 0 }, 'down', steep)).toBe(250);
	});

	it('blends a 50/50 prior worth 10 players so early players barely move it', () => {
		// One player called up: share up = (1 + 5) / (1 + 10).
		expect(lockMultiplier({ up: 1, down: 0 }, 'down')).toBe(109);
		expect(lockMultiplier({ up: 1, down: 0 }, 'up')).toBe(100);
		// Ten players all up: (10 + 5) / 20 = 75% up.
		expect(lockMultiplier({ up: 10, down: 0 }, 'down')).toBe(150);
	});

	it('the prior fades as the crowd grows', () => {
		const small = lockMultiplier({ up: 8, down: 2 }, 'down');
		const large = lockMultiplier({ up: 800, down: 200 }, 'down');
		expect(small).toBe(130);
		expect(large).toBe(159);
	});

	it('rounds half up, deterministically', () => {
		// 1 + 2 x (205/400 - 1/2) = 1.025 -> 1.03
		expect(lockMultiplier({ up: 190, down: 200 }, 'up')).toBe(103);
		// 1 + 2 x (20/30 - 1/2) = 1.333 -> 1.33
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

	it('rounds the stake down to whole dollars', () => {
		expect(stakeCentsFor(10_000, 25)).toBe(2500);
		expect(stakeCentsFor(11_600, 10)).toBe(1100);
		expect(stakeCentsFor(333, 25)).toBe(0);
		expect(stakeCentsFor(500, 50)).toBe(200);
		expect(stakeCentsFor(1, 50)).toBe(0);
	});
});

describe('settleCall', () => {
	const base = { balanceCents: START_BALANCE_CENTS, multiplierHundredths: 160 };

	it('a wrong call loses exactly the stake', () => {
		for (const stakePercent of [10, 25, 50]) {
			const s = settleCall({ ...base, stakePercent, correct: false });
			expect(s.deltaCents).toBe(-s.stakeCents);
			expect(s.bonusCents).toBe(0);
			expect(s.balanceAfterCents).toBe(10_000 - stakePercent * 100);
		}
	});

	it('a right call wins the stake plus the same crowd bonus in dollars on every chip', () => {
		// 1.60x -> bonus = 0.60 x 10% of the balance = $6, whichever chip.
		expect(settleCall({ ...base, stakePercent: 10, correct: true })).toEqual({
			stakeCents: 1000,
			multiplierHundredths: 160,
			paidMultiplierHundredths: 160,
			bonusCents: 600,
			deltaCents: 1600,
			balanceAfterCents: 11_600,
			correct: true
		});
		const mid = settleCall({ ...base, stakePercent: 25, correct: true });
		expect([mid.bonusCents, mid.deltaCents, mid.paidMultiplierHundredths]).toEqual([
			600, 3100, 124
		]);
		const max = settleCall({ ...base, stakePercent: 50, correct: true });
		expect([max.bonusCents, max.deltaCents, max.paidMultiplierHundredths]).toEqual([
			600, 5600, 112
		]);
	});

	it('pays exactly even money with the majority', () => {
		for (const stakePercent of [10, 25, 50]) {
			const s = settleCall({
				balanceCents: 10_000,
				stakePercent,
				multiplierHundredths: 100,
				correct: true
			});
			expect(s.deltaCents).toBe(s.stakeCents);
			expect(s.paidMultiplierHundredths).toBe(100);
		}
	});

	it('a right call never pays less than the stake', () => {
		for (const stakePercent of [10, 25, 50]) {
			for (let m = 100; m <= 200; m++) {
				for (const balanceCents of [1, 7, 333, 10_000, 123_457]) {
					const s = settleCall({
						balanceCents,
						stakePercent,
						multiplierHundredths: m,
						correct: true
					});
					expect(s.deltaCents).toBeGreaterThanOrEqual(s.stakeCents);
					expect(paidMultiplierFor(m, stakePercent)).toBeGreaterThanOrEqual(100);
				}
			}
		}
	});

	it('refuses rules that could pay a right call below 1.00x', () => {
		const rules: PayoutRules = {
			...PAYOUT_RULES,
			crowd: { ...PAYOUT_RULES.crowd, minMultiplierHundredths: 50 }
		};
		expect(() =>
			settleCall(
				{ balanceCents: 100, stakePercent: 10, multiplierHundredths: 50, correct: true },
				rules
			)
		).toThrow(RangeError);
	});

	it('rounds the bonus down to whole dollars', () => {
		// stake $33; bonus 33 x 0.55 x 40% = $7.26 -> $7
		const s = settleCall({
			balanceCents: 13_300,
			stakePercent: 25,
			multiplierHundredths: 155,
			correct: true
		});
		expect(s.stakeCents).toBe(3300);
		expect(s.bonusCents).toBe(700);
		expect(s.deltaCents).toBe(4000);
		expect(s.balanceAfterCents).toBe(17_300);
		// stake $5; bonus 5 x 0.53 x 20% = $0.53 -> $0
		const t = settleCall({
			balanceCents: 1_000,
			stakePercent: 50,
			multiplierHundredths: 153,
			correct: true
		});
		expect(t.bonusCents).toBe(0);
		expect(t.deltaCents).toBe(500);
	});

	it('keeps a whole-dollar balance in whole dollars', () => {
		let balance = START_BALANCE_CENTS;
		for (let i = 0; i < 200; i++) {
			const s = settleCall({
				balanceCents: balance,
				stakePercent: [10, 25, 50][i % 3],
				multiplierHundredths: 100 + ((i * 37) % 101),
				correct: i % 4 !== 1
			});
			expect(s.stakeCents % 100).toBe(0);
			expect(Math.abs(s.deltaCents % 100)).toBe(0);
			balance = s.balanceAfterCents;
		}
	});

	it('never goes below zero and always stays in whole cents', () => {
		let seed = 12345;
		const rand = () => {
			seed = (seed * 16807) % 2147483647;
			return seed / 2147483647;
		};
		for (let game = 0; game < 2000; game++) {
			let balance = Math.floor(rand() * 20_000);
			for (let call = 0; call < 20; call++) {
				const stakePercent = [10, 25, 50][Math.floor(rand() * 3)];
				const multiplierHundredths = 100 + Math.floor(rand() * 101);
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
		expect(() => settleCall({ ...ok, multiplierHundredths: 99 })).toThrow(RangeError);
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
		// about x1.6 per call (stake 50% + bonus 10%), less the cents each bonus rounds away
		expect(balance).toBe(104_400);
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
		expect(formatMultiplier(100)).toBe('1.00×');
	});
});
