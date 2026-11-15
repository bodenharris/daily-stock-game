import type { ChartPoint } from './layout.ts';

/**
 * One marker stroke, pinned to the chart's data (bar index, log price) rather than to the
 * screen, so it stays on the part of the line it was drawn on when the chart rescales after
 * a call, resizes, or adds its labels at the unmasking.
 */
export type Stroke = ChartPoint[];

/** A stroke as the first version kept it: shares of the layer's width and height. */
type BoxStroke = [x: number, y: number][];

/** What's stored per chart. A bare array is the old, box-relative format. */
interface Saved {
	v: 2;
	strokes: Stroke[];
}

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
	/** Strokes saved in the old box-relative format, waiting for `adopt` to pin them. */
	boxStrokes = $state.raw<BoxStroke[] | null>(null);
	#key = '';

	/** Switch to the strokes saved under `key` (one key per chart). */
	load(key: string) {
		this.#key = key;
		this.strokes = [];
		this.boxStrokes = null;
		try {
			const raw = localStorage.getItem(key);
			const parsed: unknown = raw ? JSON.parse(raw) : null;
			if (Array.isArray(parsed)) this.boxStrokes = parsed as BoxStroke[];
			else if ((parsed as Saved | null)?.v === 2) this.strokes = (parsed as Saved).strokes;
		} catch {
			// Unreadable: start clean.
		}
	}

	/**
	 * Pin old box-relative strokes to the chart as it looks now (which is where the player
	 * sees them), then save them in the new format.
	 */
	adopt(pin: (share: [number, number]) => ChartPoint) {
		if (!this.boxStrokes) return;
		const pinned = this.boxStrokes.map((s) => s.map((p) => round(pin(p))));
		this.boxStrokes = null;
		this.strokes = [...pinned, ...this.strokes].slice(-MAX_STROKES);
		this.#save();
	}

	start(p: ChartPoint) {
		this.strokes = [...this.strokes, [round(p)]].slice(-MAX_STROKES);
	}

	extend(points: ChartPoint[]) {
		const last = this.strokes.at(-1);
		if (!last || points.length === 0) return;
		this.strokes = [...this.strokes.slice(0, -1), [...last, ...points.map(round)]];
	}

	end() {
		this.#save();
	}

	undo() {
		this.strokes = this.strokes.slice(0, -1);
		this.#save();
	}

	clear() {
		this.strokes = [];
		this.#save();
	}

	#save() {
		if (!this.#key) return;
		try {
			if (this.strokes.length) {
				const saved: Saved = { v: 2, strokes: this.strokes };
				localStorage.setItem(this.#key, JSON.stringify(saved));
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
