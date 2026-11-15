import { describe, expect, it } from 'vitest';
import { exactStanding, standingText } from './standing.ts';

describe('standingText', () => {
	it('says nothing until someone else has finished', () => {
		expect(standingText(null)).toBeNull();
		expect(standingText({ betterThan: null, finished: 1 })).toBeNull();
	});

	it('uses a place for small crowds', () => {
		expect(standingText({ betterThan: 1, finished: 5 })).toBe('1st of 5 today');
		expect(standingText({ betterThan: 0.75, finished: 5 })).toBe('2nd of 5 today');
		expect(standingText({ betterThan: 0, finished: 5 })).toBe('5th of 5 today');
		expect(standingText({ betterThan: 0.5, finished: 13 })).toBe('7th of 13 today');
	});

	it('uses a percentage for big crowds', () => {
		expect(standingText({ betterThan: 0.64, finished: 500 })).toBe('Beat 64% of players today');
		expect(standingText({ betterThan: 0.64, finished: 500 }, 'players')).toBe(
			'Beat 64% of players'
		);
		expect(standingText({ betterThan: 0.75, finished: 5 }, 'players')).toBe('2nd of 5 players');
	});
});

describe('exactStanding', () => {
	it('has no standing until someone else has finished', () => {
		expect(exactStanding(1, 1)).toEqual({ betterThan: null, finished: 1 });
	});

	it('round-trips through standingText to the same place', () => {
		for (const finished of [2, 5, 13, 20]) {
			for (let place = 1; place <= finished; place++) {
				expect(standingText(exactStanding(place, finished))).toBe(
					standingText({ betterThan: (finished - place) / (finished - 1), finished })
				);
				expect(standingText(exactStanding(place, finished))?.startsWith(`${place}`)).toBe(true);
			}
		}
	});

	it('reads first and last place in words', () => {
		expect(standingText(exactStanding(1, 4))).toBe('1st of 4 today');
		expect(standingText(exactStanding(4, 4))).toBe('4th of 4 today');
		expect(standingText(exactStanding(30, 40))).toBe('Beat 26% of players today');
	});
});
