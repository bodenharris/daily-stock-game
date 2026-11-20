import { describe, expect, it, vi } from 'vitest';
import { lastVisibleIndex, outcomesFor, visibleBars } from './puzzle-data.ts';

// Only the pure helpers are tested here: no database, and no secrets needed (as in CI).
vi.mock('$app/env/private', () => ({ PUZZLE_SECRET: 'test' }));
vi.mock('#lib/server/db/index.ts', () => ({ db: {} }));

describe('puzzle outcomes', () => {
  const closes = [10, 11, 12, /* context ends */ 13, 12, 14, 15, 15.5, 15, 16, 10];
  // contextBars 3 (index 2 = 12), stepBars 2, 4 calls
  it('compares the end of each stretch with the end of the previous one', () => {
    const { outcomes, moves } = outcomesFor(closes, { contextBars: 3, stepBars: 2, calls: 4 });
    expect(outcomes).toEqual(['down', 'up', 'down', 'down']);
    expect(moves[0]).toBe(0);
    expect(moves[1]).toBeCloseTo(25, 5);
  });

  it('knows which bar is the last one visible before each call', () => {
    const p = { contextBars: 3, stepBars: 2, calls: 4 };
    expect(lastVisibleIndex(p, 1)).toBe(2);
    expect(lastVisibleIndex(p, 2)).toBe(4);
  });

  it('only sends the visible bars, normalised to the last context close', () => {
    const p = { contextBars: 3, stepBars: 2, calls: 4, closes };
    expect(visibleBars(p, 0)).toEqual([83.3, 91.7, 100]);
    expect(visibleBars(p, 1)).toHaveLength(5);
    expect(visibleBars(p, 4)).toHaveLength(closes.length);
  });
});
