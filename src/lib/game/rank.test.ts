import { describe, expect, it } from 'vitest';
import { exactStanding, standingText } from '../play/standing.ts';
import { PACK_EMOJI, PACK_RANKS, packRank } from './rank.ts';

const at = (betterThan: number, finished = 500) => packRank({ betterThan, finished })?.label;

describe('packRank', () => {
	it('follows the percentile bands', () => {
		expect(at(0)).toBe('Pup');
		expect(at(0.09)).toBe('Pup');
		expect(at(0.1)).toBe('Scout');
		expect(at(0.24)).toBe('Scout');
		expect(at(0.25)).toBe('Sentinel');
		expect(at(0.44)).toBe('Sentinel');
		expect(at(0.45)).toBe('Hunter');
		expect(at(0.79)).toBe('Hunter');
		expect(at(0.8)).toBe('Elder');
		expect(at(0.99)).toBe('Elder');
		expect(at(1)).toBe('Alpha');
	});

	it('rounds like the "Beat X%" line beside it', () => {
		expect(standingText({ betterThan: 0.096, finished: 500 })).toBe('Beat 10% of players today');
		expect(at(0.096)).toBe('Scout');
		expect(at(0.794)).toBe('Hunter');
		expect(at(0.795)).toBe('Elder');
	});

	it('keeps Alpha for first place only', () => {
		// Beat almost everyone, but not first: still an Elder.
		expect(at(0.999, 5000)).toBe('Elder');
		expect(packRank(exactStanding(2, 5000))?.label).toBe('Elder');
		expect(packRank(exactStanding(1, 5000))?.label).toBe('Alpha');
	});

	it('lets ties for first share Alpha', () => {
		// Ties share the better place, so everyone tied for first is in 1st place.
		expect(packRank(exactStanding(1, 7))?.key).toBe('alpha');
	});

	it('ranks small crowds by place', () => {
		const ranks = (finished: number) =>
			Array.from({ length: finished }, (_, i) => packRank(exactStanding(i + 1, finished))?.label);
		expect(ranks(2)).toEqual(['Alpha', 'Pup']);
		expect(ranks(3)).toEqual(['Alpha', 'Hunter', 'Pup']);
		expect(ranks(6)).toEqual(['Alpha', 'Elder', 'Hunter', 'Sentinel', 'Scout', 'Pup']);
	});

	it('makes the first player of the day the Alpha', () => {
		expect(packRank(exactStanding(1, 1))?.label).toBe('Alpha');
	});

	it('has no rank without a standing', () => {
		expect(packRank(null)).toBeNull();
		expect(packRank({ betterThan: null, finished: 0 })).toBeNull();
		expect(packRank({ betterThan: null, finished: 4 })).toBeNull();
	});

	it('never mentions direction', () => {
		const directionWords = /[↑↓📈📉]|\b(up|down|bull|bear|long|short)\b/iu;
		for (const r of PACK_RANKS) expect(`${PACK_EMOJI} ${r.label}`).not.toMatch(directionWords);
	});
});
