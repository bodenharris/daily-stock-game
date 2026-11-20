import { describe, expect, it } from 'vitest';
import { finishCurve, groupFinishes } from './finishes.ts';

describe('finishCurve', () => {
  it('is flat when nobody has finished', () => {
    expect(finishCurve([], 20_000, 10)).toEqual(Array(11).fill(0));
  });

  it('peaks at 1 over the crowd and falls away from it', () => {
    const curve = finishCurve([{ cents: 12_000, count: 5 }], 20_000, 40);
    const top = curve.indexOf(1);
    expect(top).toBe(25); // $125, the bucket's midpoint
    expect(curve[0]).toBeLessThan(0.05);
    expect(curve[40]).toBeLessThan(0.5);
    for (let i = 1; i <= top; i++) expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1]);
    for (let i = top + 1; i <= 40; i++) expect(curve[i]).toBeLessThanOrEqual(curve[i - 1]);
  });

  it('keeps a pile of busted players at full height on the $0 edge', () => {
    const curve = finishCurve([{ cents: 0, count: 10 }], 20_000, 40);
    expect(curve[0]).toBeGreaterThan(0.95);
  });

  it('shows two separate crowds as two hills', () => {
    const curve = finishCurve(
      [
        { cents: 4_000, count: 20 },
        { cents: 16_000, count: 20 },
      ],
      20_000,
      40,
    );
    expect(curve[20]).toBeLessThan(0.2); // the dip at $100
    expect(curve[9]).toBeGreaterThan(0.9);
    expect(curve[33]).toBeGreaterThan(0.9);
  });
});

describe('groupFinishes', () => {
  it('always reaches past the start and finds your group', () => {
    const chart = groupFinishes([{ cents: 9_000, count: 3 }], 9_500, 20);
    expect(chart.end).toBe(20_000);
    expect(chart.groups[chart.mine].from).toBe(9_000);
    expect(chart.total).toBe(3);
  });
});
