import { describe, expect, it } from 'vitest';
import { dollars, paidByCall, wholeDollarCents } from './money.ts';

describe('dollars', () => {
	it('shows whole dollars, halves rounded up', () => {
		expect(dollars(14_249)).toBe('$142');
		expect(dollars(14_250)).toBe('$143');
		expect(dollars(250)).toBe('$3');
		expect(dollars(49)).toBe('$0');
		expect(dollars(123_456_789)).toBe('$1,234,568');
	});

	it('signs losses always and gains on request, never zero', () => {
		expect(dollars(-1_250)).toBe('−$13');
		expect(dollars(600, { sign: true })).toBe('+$6');
		expect(dollars(600)).toBe('$6');
		expect(dollars(40, { sign: true })).toBe('$0');
		expect(dollars(-40, { sign: true })).toBe('$0');
	});
});

describe('wholeDollarCents', () => {
	it('rounds halves away from zero', () => {
		expect(wholeDollarCents(250)).toBe(300);
		expect(wholeDollarCents(-250)).toBe(-300);
		expect(wholeDollarCents(249)).toBe(200);
		expect(wholeDollarCents(0)).toBe(0);
	});
});

describe('paidByCall', () => {
	it('adds up to the rounded balance, even when every call has cents', () => {
		const balances = [10_250, 9_225, 11_530, 11_530, 5_765];
		const paid = paidByCall(
			balances.map((b) => ({ balanceAfterCents: b })),
			10_000
		);
		expect(paid).toEqual([300, -1_100, 2_300, 0, -5_700]);
		expect(10_000 + paid.reduce((a, b) => a + b, 0)).toBe(wholeDollarCents(5_765));
	});
});
