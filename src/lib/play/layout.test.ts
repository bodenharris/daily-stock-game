import { describe, expect, it } from 'vitest';
import { barFor, xFor, type ChartShape, type Frame } from './layout.ts';

const shape: ChartShape = { contextBars: 61, stepBars: 5, calls: 5 };
const frame: Frame = {
	width: 400,
	height: 300,
	padLeft: 4,
	padRight: 4,
	padTop: 46,
	padBottom: 14,
	contextShare: 0.5
};

describe('barFor', () => {
	it('undoes xFor across the context and every call slot', () => {
		for (const i of [0, 0.5, 17.25, 60, 61, 62.5, 70, 85]) {
			expect(barFor(xFor(i, shape, frame), shape, frame)).toBeCloseTo(i, 9);
		}
	});

	it('carries on past both edges of the plot', () => {
		expect(barFor(0, shape, frame)).toBeLessThan(0);
		expect(barFor(400, shape, frame)).toBeGreaterThan(85);
		expect(xFor(barFor(0, shape, frame), shape, frame)).toBeCloseTo(0, 9);
	});

	it('handles a one-bar context', () => {
		const one = { ...shape, contextBars: 1 };
		for (const x of [210, 300]) expect(xFor(barFor(x, one, frame), one, frame)).toBeCloseTo(x, 9);
	});
});
