import { describe, expect, it } from 'vitest';
import {
	callSpan,
	chartTimeframe,
	contextSpan,
	dollars,
	formatDate,
	formatMove,
	formatPrice,
	paidByCall,
	wholeDollarCents
} from './format.ts';

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

describe('formatMove', () => {
	it('keeps one decimal under 10% and rounds above', () => {
		expect(formatMove(-6.5)).toBe('−6.5%');
		expect(formatMove(0)).toBe('+0.0%');
		expect(formatMove(12.4)).toBe('+12%');
		expect(formatMove(-353.2)).toBe('−353%');
	});

	it('rounds away float noise first', () => {
		expect(formatMove((1.785 - 1) * 100)).toBe('+79%'); // 78.49999999999999
	});
});

describe('formatPrice', () => {
	it('shows fewer decimals as the price grows', () => {
		expect(formatPrice(347.51)).toBe('$348');
		expect(formatPrice(86.88)).toBe('$86.9');
		expect(formatPrice(4.123)).toBe('$4.12');
	});
});

describe('formatDate', () => {
	it('never shifts the day', () => {
		expect(formatDate('2021-01-27', { month: 'short', day: 'numeric', year: 'numeric' })).toBe(
			'Jan 27, 2021'
		);
	});
});

describe('callSpan', () => {
	it('names the common lengths', () => {
		expect(callSpan(1)).toBe('day');
		expect(callSpan(5)).toBe('week');
		expect(callSpan(10)).toBe('two weeks');
		expect(callSpan(15)).toBe('three weeks');
		expect(callSpan(21)).toBe('month');
	});

	it('falls back to trading days', () => {
		expect(callSpan(2)).toBe('2 trading days');
		expect(callSpan(4)).toBe('4 trading days');
	});
});

describe('contextSpan', () => {
	it('rounds long histories to months', () => {
		expect(contextSpan(60)).toBe('3 months');
		expect(contextSpan(40)).toBe('2 months');
		expect(contextSpan(21)).toBe('a month');
	});

	it('falls back to trading days', () => {
		expect(contextSpan(30)).toBe('30 trading days');
	});
});

describe('chartTimeframe', () => {
	it('reads as one sentence', () => {
		expect(chartTimeframe({ contextBars: 60, stepBars: 5, calls: 5 })).toBe(
			'3 months of daily prices, then 5 calls of a week each.'
		);
		expect(chartTimeframe({ contextBars: 60, stepBars: 2, calls: 5 })).toBe(
			'3 months of daily prices, then 5 calls of 2 trading days each.'
		);
		expect(chartTimeframe({ contextBars: 60, stepBars: 10, calls: 5 })).toBe(
			'3 months of daily prices, then 5 calls of two weeks each.'
		);
	});
});
