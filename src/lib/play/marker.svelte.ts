import type { ChartPoint } from './layout.ts';

/**
 * One marker stroke, pinned to the chart's data (bar index, log price) rather than to the
 * screen, so it stays on the part of the line it was drawn on when the chart rescales after
 * a call, resizes, or adds its labels at the unmasking.
 */
export type Stroke = ChartPoint[];

/** Most strokes kept per chart, so a scribbling session can't fill up storage. */
const MAX_STROKES = 200;

/**
 * The red marker: freehand notes on the price chart. Strokes are kept per chart in this
 * browser only (a personal scratchpad, never sent anywhere), and storage failing just means
 * they last until the page closes.
 */
export class Marker {
  /** Marker mode: pointer input draws instead of passing through. */
  active = $state(false);
  strokes = $state.raw<Stroke[]>([]);
  #key = '';

  /** Switch to the strokes saved under `key` (one key per chart). */
  load(key: string) {
    this.#key = key;
    this.strokes = [];
    try {
      // Saved as { v: 2, strokes }. (Version 1, a bare array of screen positions, is ignored.)
      const saved: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
      if ((saved as { v?: number } | null)?.v === 2) {
        this.strokes = (saved as { strokes: Stroke[] }).strokes;
      }
    } catch {
      // Unreadable: start clean.
    }
  }

  start(p: ChartPoint) {
    this.strokes = [...this.strokes, [round(p)]].slice(-MAX_STROKES);
  }

  extend(points: ChartPoint[]) {
    const last = this.strokes.at(-1);
    if (!last || points.length === 0) return;
    this.strokes = [...this.strokes.slice(0, -1), [...last, ...points.map(round)]];
  }

  undo() {
    this.strokes = this.strokes.slice(0, -1);
    this.save();
  }

  clear() {
    this.strokes = [];
    this.save();
  }

  save() {
    if (!this.#key) return;
    try {
      if (this.strokes.length) {
        localStorage.setItem(this.#key, JSON.stringify({ v: 2, strokes: this.strokes }));
      } else localStorage.removeItem(this.#key);
    } catch {
      // Storage blocked or full: the marks stay for this visit only.
    }
  }
}

/**
 * Small to store, still smooth: a thousandth of a bar, and a log price to 1e-5 (about a
 * thousandth of a percent).
 */
function round([bar, logPrice]: ChartPoint): ChartPoint {
  return [Math.round(bar * 1000) / 1000, Math.round(logPrice * 100_000) / 100_000];
}
