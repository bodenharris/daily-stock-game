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

/**
 * The Statue of Liberty, if she were a wolf: crowned ears, glowing eyes, torch lit. Drawn in
 * the skyline's dusk tones so she reads as part of the city, not a sticker on top of it.
 */
export const LIBERTY: Sprite = {
	rows: [
		'..F..........',
		'.FOF.........',
		'..O..........',
		'.GgG.........',
		'..g..g.G.g...',
		'..g..gGGGg...',
		'..g..gegeg...',
		'..g...ggg....',
		'..g...gkg....',
		'..gg...g.....',
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
		e: '#ffd23f',
		k: '#0b1430',
		g: '#2f6670',
		G: '#22495a',
		T: '#1a3a4c',
		s: '#1d2a55',
		S: '#111a3a'
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
