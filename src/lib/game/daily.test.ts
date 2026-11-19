import { describe, expect, it } from 'vitest';
import { LAUNCH_DATE, PUZZLE_TIME_ZONE } from './config.ts';
import { daysSinceLaunch, easternDateString, midnightIn, puzzleNumberFor } from './daily.ts';

const at = (iso: string) => new Date(iso);
const HOUR = 3_600_000;

describe('config', () => {
	it('launches on 2026-11-01 in New York time', () => {
		expect(LAUNCH_DATE).toBe('2026-11-01');
		expect(PUZZLE_TIME_ZONE).toBe('America/New_York');
	});
});

describe('easternDateString', () => {
	it('uses the New York calendar date, not UTC', () => {
		// 2026-11-14 is in EST (UTC-5).
		expect(easternDateString(at('2026-11-14T04:59:59.999Z'))).toBe('2026-11-13');
		expect(easternDateString(at('2026-11-14T05:00:00.000Z'))).toBe('2026-11-14');
		expect(easternDateString(at('2026-11-15T03:00:00Z'))).toBe('2026-11-14');
	});

	it('uses EDT (UTC-4) in summer', () => {
		expect(easternDateString(at('2027-07-04T03:59:59Z'))).toBe('2027-07-03');
		expect(easternDateString(at('2027-07-04T04:00:00Z'))).toBe('2027-07-04');
	});

	it('rejects an invalid date', () => {
		expect(() => easternDateString(new Date('nope'))).toThrow(RangeError);
	});
});

describe('puzzleNumberFor', () => {
	it('is #1 from midnight Eastern on launch day', () => {
		// Launch day is the fall-back Sunday: it starts in EDT (UTC-4) and lasts 25 hours.
		expect(puzzleNumberFor(at('2026-11-01T04:00:00Z'))).toBe(1);
		expect(puzzleNumberFor(at('2026-11-01T17:00:00Z'))).toBe(1);
		expect(puzzleNumberFor(at('2026-11-02T04:59:59.999Z'))).toBe(1);
	});

	it('rolls over at midnight Eastern, not midnight UTC', () => {
		expect(puzzleNumberFor(at('2026-11-02T00:00:00Z'))).toBe(1);
		expect(puzzleNumberFor(at('2026-11-02T05:00:00Z'))).toBe(2);
	});

	it('is #14 on 2026-11-14', () => {
		expect(puzzleNumberFor(at('2026-11-14T05:00:00Z'))).toBe(14);
		expect(puzzleNumberFor(at('2026-11-15T04:59:59.999Z'))).toBe(14);
	});

	it('serves #1 before launch and reports how far before', () => {
		expect(puzzleNumberFor(at('2026-11-01T03:59:59.999Z'))).toBe(1);
		expect(daysSinceLaunch(at('2026-11-01T03:59:59.999Z'))).toBe(-1);
		expect(puzzleNumberFor(at('2026-01-01T12:00:00Z'))).toBe(1);
		expect(daysSinceLaunch(at('2026-11-01T04:00:00Z'))).toBe(0);
	});

	it('counts calendar days across the spring-forward change', () => {
		// 2027-03-14 is the spring-forward Sunday; that day is 23 hours long.
		expect(puzzleNumberFor(at('2027-03-14T05:00:00Z'))).toBe(134);
		expect(puzzleNumberFor(at('2027-03-15T03:59:59Z'))).toBe(134);
		expect(puzzleNumberFor(at('2027-03-15T04:00:00Z'))).toBe(135);
	});

	it('counts calendar days across the fall-back change', () => {
		// 2027-11-07 is the fall-back Sunday; that day is 25 hours long.
		const start = puzzleNumberFor(at('2027-11-07T04:00:00Z'));
		expect(puzzleNumberFor(at('2027-11-07T03:59:59Z'))).toBe(start - 1);
		expect(puzzleNumberFor(at('2027-11-08T04:59:59Z'))).toBe(start);
		expect(puzzleNumberFor(at('2027-11-08T05:00:00Z'))).toBe(start + 1);
	});

	it('is one puzzle per day for a year', () => {
		expect(puzzleNumberFor(at('2027-11-01T04:00:00Z'))).toBe(366);
		let previous = puzzleNumberFor(at('2026-11-01T04:00:00Z'));
		for (let hours = 1; hours < 24 * 400; hours++) {
			const n = puzzleNumberFor(new Date(Date.UTC(2026, 10, 1, 4) + hours * HOUR));
			expect(n - previous).toBeGreaterThanOrEqual(0);
			expect(n - previous).toBeLessThanOrEqual(1);
			previous = n;
		}
		expect(previous).toBe(400);
	});
});

describe('midnightIn', () => {
	it('finds Eastern midnight in both offsets', () => {
		expect(midnightIn('2026-11-14').toISOString()).toBe('2026-11-14T05:00:00.000Z');
		expect(midnightIn('2027-07-04').toISOString()).toBe('2027-07-04T04:00:00.000Z');
		expect(midnightIn('2027-03-14').toISOString()).toBe('2027-03-14T05:00:00.000Z');
		expect(midnightIn('2027-03-15').toISOString()).toBe('2027-03-15T04:00:00.000Z');
	});

	it('makes spring-forward day 23 hours and fall-back day 25', () => {
		const length = (a: string, b: string) => midnightIn(b).getTime() - midnightIn(a).getTime();
		expect(length('2026-11-14', '2026-11-15')).toBe(24 * HOUR);
		expect(length('2027-03-14', '2027-03-15')).toBe(23 * HOUR);
		expect(length('2027-11-07', '2027-11-08')).toBe(25 * HOUR);
	});

	it('lands exactly on the next puzzle', () => {
		for (const date of ['2026-11-15', '2027-03-15', '2027-11-08']) {
			const next = midnightIn(date);
			expect(puzzleNumberFor(next)).toBe(puzzleNumberFor(new Date(next.getTime() - 1)) + 1);
			expect(easternDateString(next)).toBe(date);
		}
	});
});
