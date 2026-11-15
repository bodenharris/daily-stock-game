/** One marker stroke: points as shares of the chart's width and height, so it survives a resize. */
export type Stroke = [x: number, y: number][];

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
		try {
			const raw = localStorage.getItem(key);
			const parsed: unknown = raw ? JSON.parse(raw) : [];
			this.strokes = Array.isArray(parsed) ? (parsed as Stroke[]) : [];
		} catch {
			this.strokes = [];
		}
	}

	start(p: [number, number]) {
		this.strokes = [...this.strokes, [p]].slice(-MAX_STROKES);
	}

	extend(points: [number, number][]) {
		const last = this.strokes.at(-1);
		if (!last || points.length === 0) return;
		this.strokes = [...this.strokes.slice(0, -1), [...last, ...points]];
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
			if (this.strokes.length) localStorage.setItem(this.#key, JSON.stringify(this.strokes));
			else localStorage.removeItem(this.#key);
		} catch {
			// Storage blocked or full: the marks stay for this visit only.
		}
	}
}
