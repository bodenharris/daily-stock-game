/**
 * Pixel sprites as text grids: one character per pixel, `.` for transparent, every other
 * character a key into `palette`. `wolf.json` is shared with scripts/make-images.py, which draws
 * the app icons and link preview from the same grid.
 */
import type { PackRankKey } from '#lib/game/rank.ts';
import wolf from './wolf.json';
import ranks from './ranks.json';

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

/** A small Statue of Liberty on her pedestal, torch lit, for the title screen's skyline. */
export const LIBERTY: Sprite = {
	rows: [
		'..F..........',
		'.FOF.........',
		'..O..........',
		'.GgG.........',
		'..g..........',
		'..g...G.G.G..',
		'..g....GgG...',
		'..g...GgggG..',
		'..g....ggG...',
		'..gg...gG....',
		'...gggggggG..',
		'.....ggggGTT.',
		'.....gggGgTT.',
		'.....ggGggTT.',
		'.....gGggGg..',
		'.....Gggggg..',
		'....gggGggG..',
		'....ggGgggG..',
		'....gGggGggG.',
		'...gggggGggG.',
		'..sssssssssss',
		'...SsssssssS.',
		'...SsSsSsSsS.',
		'...SsssssssS.',
		'..SSSSSSSSSSS'
	],
	palette: {
		F: '#ffd23f',
		O: '#ff8a3d',
		g: '#6cc4ad',
		G: '#3f8f7f',
		T: '#2f6e62',
		s: '#8a82a6',
		S: '#5c5578'
	}
};

/** One 16×16 badge per Wolf Pack Rank, from `ranks.json`, all on one shared palette. */
const badge = (rows: string[]): Sprite => ({ rows, palette: ranks.palette });
const { pup, scout, sentinel, hunter, elder, alpha } = ranks.sprites;
export const RANK_BADGES: Record<PackRankKey, Sprite> = {
	pup: badge(pup),
	scout: badge(scout),
	sentinel: badge(sentinel),
	hunter: badge(hunter),
	elder: badge(elder),
	alpha: badge(alpha)
};
