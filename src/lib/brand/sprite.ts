/**
 * Pixel sprites as text grids: one character per pixel, `.` for transparent, every other
 * character a key into `palette`. `wolf.json` is shared with scripts/make-images.py, which draws
 * the app icons and link preview from the same grid.
 */
import wolf from './wolf.json';

export interface Sprite {
	rows: string[];
	palette: Record<string, string>;
}

export interface Run {
	x: number;
	y: number;
	w: number;
	fill: string;
}

/** Horizontal runs of one color, so a sprite renders as a few dozen rects, not one per pixel. */
export function spriteRuns({ rows, palette }: Sprite): Run[] {
	const runs: Run[] = [];
	rows.forEach((row, y) => {
		let x = 0;
		while (x < row.length) {
			const key = row[x];
			let end = x + 1;
			while (end < row.length && row[end] === key) end++;
			if (key !== '.') runs.push({ x, y, w: end - x, fill: palette[key] });
			x = end;
		}
	});
	return runs;
}

export const WOLF: Sprite = wolf;
