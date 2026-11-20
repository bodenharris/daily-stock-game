import { describe, expect, it, vi } from 'vitest';
import type { Direction } from '#lib/game/economy.ts';
import { bigMoveOf, nameItOptions, type NameItCandidate } from './name-it.ts';

// Only the pure helpers are tested here: no database, and no secrets needed (as in CI).
vi.mock('$app/env/private', () => ({ PUZZLE_SECRET: 'test' }));
vi.mock('#lib/server/db/index.ts', () => ({ db: {} }));

const make = (i: number, bigMove: Direction, ticker = `T${i}`): NameItCandidate => ({
  slug: `p${i}`,
  ticker,
  headline: `Moment ${i}`,
  bigMove,
});

const pool: NameItCandidate[] = [
  ...Array.from({ length: 10 }, (_, i) => make(i, 'down')),
  ...Array.from({ length: 10 }, (_, i) => make(i + 10, 'up')),
];

describe('nameItOptions', () => {
  it('offers four distinct moments, one of them the answer', () => {
    for (const answer of pool) {
      const options = nameItOptions(answer, pool, 's');
      expect(options).toHaveLength(4);
      expect(options.filter((o) => o.slug === answer.slug)).toHaveLength(1);
      expect(new Set(options.map((o) => o.headline)).size).toBe(4);
    }
  });

  it('matches decoys to the shape of the answer', () => {
    for (const answer of pool) {
      for (const o of nameItOptions(answer, pool, 's')) expect(o.bigMove).toBe(answer.bigMove);
    }
  });

  it('falls back to other shapes when there are too few matches', () => {
    const small = [make(1, 'down'), make(2, 'down'), make(3, 'up'), make(4, 'up'), make(5, 'up')];
    const options = nameItOptions(small[0], small, 's');
    expect(options).toHaveLength(4);
    expect(options.filter((o) => o.bigMove === 'down')).toHaveLength(2);
  });

  it('never offers another moment for the same ticker', () => {
    const apple = [make(1, 'down', 'AAPL'), make(2, 'down', 'AAPL'), ...pool];
    for (const o of nameItOptions(apple[0], apple, 's')) {
      if (o.slug !== 'p1') expect(o.ticker).not.toBe('AAPL');
    }
  });

  it('is the same for everyone, but depends on the secret', () => {
    const a = nameItOptions(pool[3], pool, 'one').map((o) => o.slug);
    expect(nameItOptions(pool[3], [...pool].reverse(), 'one').map((o) => o.slug)).toEqual(a);
    const differs = pool.some(
      (p) =>
        nameItOptions(p, pool, 'one')
          .map((o) => o.slug)
          .join() !==
        nameItOptions(p, pool, 'two')
          .map((o) => o.slug)
          .join(),
    );
    expect(differs).toBe(true);
  });

  it("doesn't always put the answer in the same place", () => {
    const places = new Set(
      pool.map((p) => nameItOptions(p, pool, 's').findIndex((o) => o.slug === p.slug)),
    );
    expect(places.size).toBeGreaterThan(2);
  });

  it('works with a tiny catalog', () => {
    expect(nameItOptions(make(1, 'up'), [make(1, 'up')], 's')).toHaveLength(1);
    expect(nameItOptions(make(1, 'up'), [make(1, 'up'), make(2, 'down')], 's')).toHaveLength(2);
  });
});

describe('bigMoveOf', () => {
  it('takes the direction of the largest move', () => {
    expect(bigMoveOf([78.5, 352.5, -6.5, -72.3, -40.6])).toBe('up');
    expect(bigMoveOf([-11.7, 1.7, -18, -3.1, 8.6])).toBe('down');
    expect(bigMoveOf([0, 0, 0, 0, 0])).toBe('up');
  });
});
