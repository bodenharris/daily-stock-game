import { describe, expect, it } from 'vitest';
import { LAUNCH_DATE, PUZZLE_TIME_ZONE } from './config.ts';
import {
	daysSinceLaunch,
	easternDateString,
	midnightIn,
	msUntilNextPuzzle,
	puzzleIndexFor,
	puzzleNumberFor,
	todayPuzzle
} from './daily.ts';

const at = (iso: string) => new Date(iso);
const HOUR = 3_600_000;

describe('config', () => {
	it('launches on 2026-11-14 in New York time', () => {
		expect(LAUNCH_DATE).toBe('2026-11-14');
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
		expect(puzzleNumberFor(at('2026-11-14T05:00:00Z'))).toBe(1);
		expect(puzzleNumberFor(at('2026-11-14T17:00:00Z'))).toBe(1);
		expect(puzzleNumberFor(at('2026-11-15T04:59:59.999Z'))).toBe(1);
	});

	it('rolls over at midnight Eastern, not midnight UTC', () => {
		expect(puzzleNumberFor(at('2026-11-15T00:00:00Z'))).toBe(1);
		expect(puzzleNumberFor(at('2026-11-15T05:00:00Z'))).toBe(2);
	});

	it('serves #1 before launch and reports how far before', () => {
		expect(puzzleNumberFor(at('2026-11-14T04:59:59.999Z'))).toBe(1);
		expect(daysSinceLaunch(at('2026-11-14T04:59:59.999Z'))).toBe(-1);
		expect(puzzleNumberFor(at('2026-01-01T12:00:00Z'))).toBe(1);
		expect(daysSinceLaunch(at('2026-11-14T05:00:00Z'))).toBe(0);
	});

	it('counts calendar days across the spring-forward change', () => {
		// 2027-03-14 is the spring-forward Sunday; that day is 23 hours long.
		expect(puzzleNumberFor(at('2027-03-14T05:00:00Z'))).toBe(121);
		expect(puzzleNumberFor(at('2027-03-15T03:59:59Z'))).toBe(121);
		expect(puzzleNumberFor(at('2027-03-15T04:00:00Z'))).toBe(122);
	});

	it('counts calendar days across the fall-back change', () => {
		// 2027-11-07 is the fall-back Sunday; that day is 25 hours long.
		const start = puzzleNumberFor(at('2027-11-07T04:00:00Z'));
		expect(puzzleNumberFor(at('2027-11-07T03:59:59Z'))).toBe(start - 1);
		expect(puzzleNumberFor(at('2027-11-08T04:59:59Z'))).toBe(start);
		expect(puzzleNumberFor(at('2027-11-08T05:00:00Z'))).toBe(start + 1);
	});

	it('is one puzzle per day for a year', () => {
		expect(puzzleNumberFor(at('2027-11-14T05:00:00Z'))).toBe(366);
		let previous = puzzleNumberFor(at('2026-11-14T05:00:00Z'));
		for (let hours = 1; hours < 24 * 400; hours++) {
			const n = puzzleNumberFor(new Date(Date.UTC(2026, 10, 14, 5) + hours * HOUR));
			expect(n - previous).toBeGreaterThanOrEqual(0);
			expect(n - previous).toBeLessThanOrEqual(1);
			previous = n;
		}
		expect(previous).toBe(400);
	});
});

describe('puzzleIndexFor', () => {
	it('plays the catalog in order and cycles', () => {
		expect(puzzleIndexFor(1, 30)).toBe(0);
		expect(puzzleIndexFor(30, 30)).toBe(29);
		expect(puzzleIndexFor(31, 30)).toBe(0);
		expect(puzzleIndexFor(65, 30)).toBe(4);
		expect(puzzleIndexFor(7, 1)).toBe(0);
	});

	it('rejects impossible input', () => {
		expect(() => puzzleIndexFor(0, 30)).toThrow(RangeError);
		expect(() => puzzleIndexFor(1.5, 30)).toThrow(RangeError);
		expect(() => puzzleIndexFor(1, 0)).toThrow(RangeError);
	});
});

describe('midnightIn and msUntilNextPuzzle', () => {
	it('finds Eastern midnight in both offsets', () => {
		expect(midnightIn('2026-11-14').toISOString()).toBe('2026-11-14T05:00:00.000Z');
		expect(midnightIn('2027-07-04').toISOString()).toBe('2027-07-04T04:00:00.000Z');
		expect(midnightIn('2027-03-14').toISOString()).toBe('2027-03-14T05:00:00.000Z');
		expect(midnightIn('2027-03-15').toISOString()).toBe('2027-03-15T04:00:00.000Z');
	});

	it('is a full day at midnight and one second just before it', () => {
		expect(msUntilNextPuzzle(at('2026-11-14T05:00:00Z'))).toBe(24 * HOUR);
		expect(msUntilNextPuzzle(at('2026-11-15T04:59:59Z'))).toBe(1000);
	});

	it('is 23 hours on spring-forward day and 25 on fall-back day', () => {
		expect(msUntilNextPuzzle(at('2027-03-14T05:00:00Z'))).toBe(23 * HOUR);
		expect(msUntilNextPuzzle(at('2027-11-07T04:00:00Z'))).toBe(25 * HOUR);
	});

	it('lands exactly on the next puzzle', () => {
		for (const iso of ['2026-11-14T12:34:56Z', '2027-03-14T06:30:00Z', '2027-11-07T05:30:00Z']) {
			const now = at(iso);
			const next = new Date(now.getTime() + msUntilNextPuzzle(now));
			expect(puzzleNumberFor(next)).toBe(puzzleNumberFor(now) + 1);
			expect(puzzleNumberFor(new Date(next.getTime() - 1))).toBe(puzzleNumberFor(now));
		}
	});
});

describe('todayPuzzle', () => {
	it('bundles number, Eastern date, catalog position and next unlock', () => {
		expect(todayPuzzle(at('2026-11-15T04:30:00Z'), 30)).toEqual({
			number: 1,
			date: '2026-11-14',
			position: 0,
			nextPuzzleAt: Date.parse('2026-11-15T05:00:00Z')
		});
		const later = todayPuzzle(at('2026-12-15T15:00:00Z'), 30);
		expect(later).toMatchObject({ number: 32, date: '2026-12-15', position: 1 });
		expect(later.nextPuzzleAt).toBe(Date.parse('2026-12-16T05:00:00Z'));
	});

	it('before launch serves #1 on the real Eastern date', () => {
		expect(todayPuzzle(at('2026-11-13T12:00:00Z'), 30)).toMatchObject({
			number: 1,
			date: '2026-11-13',
			position: 0
		});
	});
});
