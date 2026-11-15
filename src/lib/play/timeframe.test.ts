import { describe, expect, it } from 'vitest';
import { callSpan, chartTimeframe, contextSpan } from './timeframe.ts';

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
