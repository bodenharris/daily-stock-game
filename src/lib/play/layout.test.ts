import { describe, expect, it } from 'vitest';
import { barFor, domainFor, pointsFor, xFor, type ChartShape, type Frame } from './layout.ts';

const shape: ChartShape = { contextBars: 61, stepBars: 5, calls: 5 };
const frame: Frame = {
  width: 400,
  height: 300,
  padLeft: 4,
  padRight: 4,
  padTop: 46,
  padBottom: 14,
  contextShare: 0.5,
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

describe('domainFor', () => {
  it('only grows as bars are added, so a reveal never re-zooms the history', () => {
    const bars = [100, 104, 98, 101, 140, 90, 95].map(Math.log);
    for (let n = 2; n < bars.length; n++) {
      const [lo, hi] = domainFor(bars.slice(0, n), 0.1);
      const [lo2, hi2] = domainFor(bars.slice(0, n + 1), 0.1);
      expect(lo2).toBeLessThanOrEqual(lo);
      expect(hi2).toBeGreaterThanOrEqual(hi);
    }
  });
});

describe('pointsFor', () => {
  it('ends partway between two bars', () => {
    expect(pointsFor([1, 2, 4], 0, 2, 1.5)).toEqual([
      [0, 1],
      [1, 2],
      [1.5, 3],
    ]);
  });
});
