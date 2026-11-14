import { describe, expect, it } from 'vitest';
import { slugForNumber } from './schedule-order.ts';

const catalog = Array.from({ length: 30 }, (_, i) => `p${i}`);

describe('slugForNumber', () => {
	it('opens with the first catalog entry', () => {
		expect(slugForNumber(1, catalog, 's')).toBe('p0');
	});

	it('plays every puzzle exactly once per pass', () => {
		for (const cycle of [0, 1, 2]) {
			const seen = new Set(
				Array.from({ length: 30 }, (_, i) => slugForNumber(cycle * 30 + i + 1, catalog, 's'))
			);
			expect(seen.size).toBe(30);
		}
	});

	it('depends on the secret, so the repo alone does not give the order', () => {
		const a = Array.from({ length: 30 }, (_, i) => slugForNumber(i + 1, catalog, 'one'));
		const b = Array.from({ length: 30 }, (_, i) => slugForNumber(i + 1, catalog, 'two'));
		expect(a).not.toEqual(b);
		expect(a[0]).toBe(b[0]);
	});

	it('is stable for the same inputs and differs between passes', () => {
		expect(slugForNumber(7, catalog, 's')).toBe(slugForNumber(7, catalog, 's'));
		const pass1 = Array.from({ length: 30 }, (_, i) => slugForNumber(i + 1, catalog, 's'));
		const pass2 = Array.from({ length: 30 }, (_, i) => slugForNumber(i + 31, catalog, 's'));
		expect(pass1).not.toEqual(pass2);
	});
});
