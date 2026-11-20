import { describe, expect, it } from 'vitest';
import { splitAdjust } from './split.ts';

const bar = (date: string, close: number, splitFactor = 1, volume = 100) => ({
  date: `${date}T00:00:00.000Z`,
  open: close,
  high: close,
  low: close,
  close,
  volume,
  splitFactor,
});

describe('splitAdjust', () => {
  it('divides bars before a split by its factor and leaves later bars alone', () => {
    const rows = splitAdjust('GME', [
      bar('2022-07-21', 160),
      bar('2022-07-22', 40, 4),
      bar('2022-07-25', 38),
    ]);
    expect(rows.map((r) => r.close)).toEqual([40, 40, 38]);
    expect(rows[0].volume).toBe(400);
    expect(rows[0].ts).toBe('2022-07-21');
  });

  it('compounds multiple splits and sorts by date', () => {
    const rows = splitAdjust('X', [
      bar('2020-01-03', 50, 2),
      bar('2020-01-01', 400),
      bar('2020-01-02', 100, 4),
    ]);
    expect(rows.map((r) => [r.ts, r.close])).toEqual([
      ['2020-01-01', 50],
      ['2020-01-02', 50],
      ['2020-01-03', 50],
    ]);
  });

  it('drops broken bars', () => {
    const rows = splitAdjust('X', [bar('2020-01-01', 0), bar('2020-01-02', 10)]);
    expect(rows).toHaveLength(1);
  });
});
