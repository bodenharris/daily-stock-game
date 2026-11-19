import { describe, expect, it } from 'vitest';
import { GRACE_MS } from '#lib/game/config.ts';
import { dateForNumber, midnightIn } from '#lib/game/daily.ts';
import { countStreak, playedOnItsDay } from './streak.ts';

/** Midnight Eastern that starts puzzle `n`'s day. */
const unlock = (n: number) => midnightIn(dateForNumber(n)).getTime();

describe('playedOnItsDay', () => {
	it('counts a game started and finished on its own day', () => {
		const start = new Date(unlock(5) + 3_600_000);
		expect(playedOnItsDay(5, start, new Date(start.getTime() + 600_000))).toBe(true);
	});

	it('counts a game started before midnight and finished in the grace period', () => {
		const start = new Date(unlock(6) - 60_000);
		expect(playedOnItsDay(5, start, new Date(unlock(6) + GRACE_MS - 1))).toBe(true);
		expect(playedOnItsDay(5, start, new Date(unlock(6) + GRACE_MS + 1))).toBe(false);
	});

	it('does not count a past day played from the archive', () => {
		const later = new Date(unlock(9) + 3_600_000);
		expect(playedOnItsDay(5, later, new Date(later.getTime() + 600_000))).toBe(false);
	});
});

describe('countStreak', () => {
	it('counts back from today, or from yesterday when today is not done yet', () => {
		expect(countStreak([10, 9, 8, 6], 10)).toBe(3);
		expect(countStreak([9, 8, 7], 10)).toBe(3);
		expect(countStreak([8, 7], 10)).toBe(0);
		expect(countStreak([], 10)).toBe(0);
	});
});
