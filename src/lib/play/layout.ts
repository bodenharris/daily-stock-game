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

export function plotWidth(f: Frame) {
	return Math.max(1, f.width - f.padLeft - f.padRight);
}

/** x position for a (possibly fractional) bar index. */
export function xFor(i: number, shape: ChartShape, f: Frame): number {
	const w = plotWidth(f);
	const contextW = w * f.contextShare;
	const slotW = (w - contextW) / shape.calls;
	const last = shape.contextBars - 1;
	if (i <= last) return f.padLeft + (last === 0 ? contextW : (i / last) * contextW);
	return f.padLeft + contextW + ((i - last) / shape.stepBars) * slotW;
}

/** Left and right x of call slot `step` (1-based). */
export function slotBounds(step: number, shape: ChartShape, f: Frame): [number, number] {
	const last = shape.contextBars - 1;
	return [
		xFor(last + (step - 1) * shape.stepBars, shape, f),
		xFor(last + step * shape.stepBars, shape, f)
	];
}

/** y domain with breathing room, so the line never touches the edges. */
export function domainFor(values: number[], pad = 0.12): [number, number] {
	let lo = Infinity;
	let hi = -Infinity;
	for (const v of values) {
		if (v < lo) lo = v;
		if (v > hi) hi = v;
	}
	if (!Number.isFinite(lo)) return [0, 1];
	const span = Math.max(hi - lo, Math.abs(hi) * 0.02, 1e-6);
	return [lo - span * pad, hi + span * pad];
}

export function yFor(v: number, domain: [number, number], f: Frame): number {
	const [lo, hi] = domain;
	const h = Math.max(1, f.height - f.padTop - f.padBottom);
	return f.padTop + (1 - (v - lo) / (hi - lo || 1)) * h;
}

/** Points for bars [from, to] (inclusive), clipped to a fractional end for the draw-on effect. */
export function pointsFor(
	values: number[],
	from: number,
	to: number,
	end: number
): Array<[number, number]> {
	const out: Array<[number, number]> = [];
	const stop = Math.min(to, end, values.length - 1);
	for (let i = from; i <= Math.floor(stop); i++) out.push([i, values[i]]);
	const frac = stop - Math.floor(stop);
	if (frac > 0 && Math.floor(stop) + 1 < values.length) {
		const a = values[Math.floor(stop)];
		const b = values[Math.floor(stop) + 1];
		out.push([stop, a + (b - a) * frac]);
	}
	return out;
}
