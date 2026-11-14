import { describe, expect, it } from 'vitest';
import { ARCHETYPES } from './archetype.ts';
import { GAME_NAME, SITE_URL } from './config.ts';
import type { Direction } from './economy.ts';
import { buildShareText, shareGrid } from './share.ts';
import { playGame, type CallSpec } from './testing.ts';

const W = true;
const L = false;

const CONTRARIAN_GAME: CallSpec[] = [
	[10, W, 0.5],
	[25, W, 0.35],
	[50, W, 0.3],
	[10, L, 0.4],
	[25, L, 0.5]
];

describe('buildShareText', () => {
	it('renders the full card', () => {
		const text = buildShareText({ puzzleNumber: 12, calls: playGame(CONTRARIAN_GAME) });
		expect(text).toBe(
			[
				'Hindsight #12 · $100 → $153.48',
				'⬛⬛🟨⬛⬛',
				'⬛🟨🟨⬛🟥',
				'🟩🟨🟨🟥🟥',
				'🙃 The Contrarian',
				'https://hindsight.example'
			].join('\n')
		);
	});

	it('uses the configured name and URL by default', () => {
		const text = buildShareText({ puzzleNumber: 1, calls: playGame(CONTRARIAN_GAME) });
		expect(text.startsWith(`${GAME_NAME} #1 · `)).toBe(true);
		expect(text.endsWith(`\n${SITE_URL}`)).toBe(true);
	});

	it('takes a custom URL, name, archetype and light theme', () => {
		const text = buildShareText({
			puzzleNumber: 1234,
			calls: playGame(Array(5).fill([10, L, 0.5])),
			url: 'https://example.com/?s=1',
			gameName: 'Other',
			archetype: ARCHETYPES[0],
			theme: 'light'
		});
		const lines = text.split('\n');
		expect(lines[0]).toBe('Other #1,234 · $100 → $59.05');
		expect(lines[1]).toBe('⬜⬜⬜⬜⬜');
		expect(lines[3]).toBe('🟥🟥🟥🟥🟥');
		expect(lines[4]).toBe(`${ARCHETYPES[0].emoji} ${ARCHETYPES[0].label}`);
		expect(lines.at(-1)).toBe('https://example.com/?s=1');
	});

	it('adds an optional bonus line and stays short', () => {
		const text = buildShareText({
			puzzleNumber: 3,
			calls: playGame(CONTRARIAN_GAME),
			bonus: { label: 'Real or Random', correct: 2, total: 3 }
		});
		const lines = text.split('\n');
		expect(lines).toHaveLength(7);
		expect(lines[5]).toBe('🎲 Real or Random 2/3');
		expect(lines.at(-1)).toBe(SITE_URL);
	});

	it('shows big balances with thousands separators', () => {
		const text = buildShareText({ puzzleNumber: 1, calls: playGame(Array(5).fill([50, W, 0])) });
		expect(text.split('\n')[0]).toBe('Hindsight #1 · $100 → $1,889.56');
	});

	it('rejects games it cannot describe', () => {
		expect(() => buildShareText({ puzzleNumber: 1, calls: [] })).toThrow(RangeError);
		expect(() =>
			buildShareText({ puzzleNumber: 1, calls: playGame(Array(6).fill([10, W, 0.5])) })
		).toThrow(RangeError);
		expect(() => buildShareText({ puzzleNumber: 0, calls: playGame(CONTRARIAN_GAME) })).toThrow(
			RangeError
		);
	});
});

describe('shareGrid', () => {
	it('draws one column per call with height = stake', () => {
		const calls = playGame([
			[10, W, 0.5],
			[25, W, 0.5],
			[50, W, 0.5]
		]);
		expect(shareGrid(calls)).toEqual(['⬛⬛🟩', '⬛🟩🟩', '🟩🟩🟩']);
	});

	it('keeps every row the same width', () => {
		const rows = shareGrid(playGame(CONTRARIAN_GAME));
		for (const row of rows) expect([...row]).toHaveLength(5);
	});
});

describe('spoilers', () => {
	const directionGlyphs = /[↑↓↗↘⇧⇩⬆⬇▲▼△▽🔼🔽📈📉⏫⏬]|\b(up|down|bull|bear|long|short)\b/iu;

	function randomGames(count: number): CallSpec[][] {
		let seed = 99;
		const rand = () => {
			seed = (seed * 16807) % 2147483647;
			return seed / 2147483647;
		};
		return Array.from({ length: count }, () =>
			Array.from({ length: 5 }, (): CallSpec => {
				const direction: Direction = rand() < 0.5 ? 'up' : 'down';
				return [[10, 25, 50][Math.floor(rand() * 3)], rand() < 0.5, rand(), direction];
			})
		);
	}

	it('the text is identical whichever way the calls went', () => {
		for (const specs of randomGames(500)) {
			const asPlayed = buildShareText({ puzzleNumber: 7, calls: playGame(specs) });
			const flipped = buildShareText({
				puzzleNumber: 7,
				calls: playGame(specs.map(([s, c, share, d]) => [s, c, share, d === 'up' ? 'down' : 'up']))
			});
			const allUp = buildShareText({
				puzzleNumber: 7,
				calls: playGame(specs.map(([s, c, share]) => [s, c, share, 'up']))
			});
			expect(flipped).toBe(asPlayed);
			expect(allUp).toBe(asPlayed);
		}
	});

	it('contains no arrows, chart emoji or direction words', () => {
		for (const specs of randomGames(500)) {
			const text = buildShareText({
				puzzleNumber: 7,
				calls: playGame(specs),
				bonus: { label: 'Real or Random', correct: 1, total: 3 }
			});
			expect(text).not.toMatch(directionGlyphs);
		}
		for (const a of ARCHETYPES) expect(`${a.emoji} ${a.label}`).not.toMatch(directionGlyphs);
	});
});
