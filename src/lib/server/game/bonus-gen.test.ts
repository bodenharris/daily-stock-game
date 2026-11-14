import { describe, expect, it } from 'vitest';
import { dailyVolatility, normalise, rng, syntheticPath } from './bonus-gen.ts';

describe('bonus chart generation', () => {
	it('is deterministic for a seed, so everyone gets the same charts', () => {
		const a = rng(42);
		const b = rng(42);
		const xs = Array.from({ length: 5 }, () => a());
		expect(Array.from({ length: 5 }, () => b())).toEqual(xs);
		expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
	});

	it('makes a positive price path of the requested length near the target volatility', () => {
		const path = syntheticPath(rng(7), 2000, 0.02);
		expect(path).toHaveLength(2000);
		expect(path.every((p) => p > 0 && Number.isFinite(p))).toBe(true);
		const vol = dailyVolatility(path);
		expect(vol).toBeGreaterThan(0.012);
		expect(vol).toBeLessThan(0.035);
	});

	it('normalises to start at 100 with one decimal, the same for real and random charts', () => {
		expect(normalise([20, 21, 19.987])).toEqual([100, 105, 99.9]);
	});
});
