/**
 * Chart geometry. The context gets a fixed share of the width and every call gets an equal
 * slot after it, whatever its length in trading days, so each call reads as one clear chunk
 * of future.
 */

export interface ChartShape {
  contextBars: number;
  stepBars: number;
  calls: number;
}

export interface Frame {
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
  /** Share of the plot width given to the context. */
  contextShare: number;
}

/**
 * A point in the chart's own terms: a (fractional) bar index and a log price. Pinned to the
 * data, it stays put on the line however the chart is sized or scaled.
 */
export type ChartPoint = [bar: number, logPrice: number];

function widths(shape: ChartShape, f: Frame) {
  const plot = Math.max(1, f.width - f.padLeft - f.padRight);
  const context = plot * f.contextShare;
  return { context, slot: (plot - context) / shape.calls, last: shape.contextBars - 1 };
}

/** x position for a (possibly fractional) bar index. */
export function xFor(i: number, shape: ChartShape, f: Frame): number {
  const { context, slot, last } = widths(shape, f);
  if (i <= last) return f.padLeft + (last === 0 ? context : (i / last) * context);
  return f.padLeft + context + ((i - last) / shape.stepBars) * slot;
}

/** The (fractional) bar index at x: the inverse of `xFor`, carried on past both ends. */
export function barFor(x: number, shape: ChartShape, f: Frame): number {
  const { context, slot, last } = widths(shape, f);
  const dx = x - f.padLeft;
  if (dx <= context && last > 0) return (dx / context) * last;
  return last + ((dx - context) / slot) * shape.stepBars;
}

/** Left and right x of call slot `step` (1-based). */
export function slotBounds(step: number, shape: ChartShape, f: Frame): [number, number] {
  const last = shape.contextBars - 1;
  return [
    xFor(last + (step - 1) * shape.stepBars, shape, f),
    xFor(last + step * shape.stepBars, shape, f),
  ];
}

/** y domain with breathing room, so the line never touches the edges. */
export function domainFor(values: number[], pad: number): [number, number] {
  if (values.length === 0) return [0, 1];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(hi - lo, Math.abs(hi) * 0.02, 1e-6);
  return [lo - span * pad, hi + span * pad];
}

/** Points for bars [from, to] (inclusive), cut off at a fractional `end` for the draw-on effect. */
export function pointsFor(values: number[], from: number, to: number, end: number): ChartPoint[] {
  const out: ChartPoint[] = [];
  const stop = Math.min(to, end, values.length - 1);
  const whole = Math.floor(stop);
  for (let i = from; i <= whole; i++) out.push([i, values[i]]);
  if (stop > whole && whole + 1 < values.length) {
    out.push([stop, values[whole] + (values[whole + 1] - values[whole]) * (stop - whole)]);
  }
  return out;
}
