import { describe, expect, it } from 'vitest';
import { ARCHETYPES } from './archetype.ts';
import { GAME_NAME, SITE_URL } from './config.ts';
import { dollars } from '../play/money.ts';
import { buildShareText, formatWholeDollars, shareRow } from './share.ts';
import { flipDirections, playGame, randomGames, type CallSpec } from './testing.ts';

const W = true;
const L = false;

const CONTRARIAN_GAME: CallSpec[] = [
	[10, W, 0.5],
	[25, W, 0.35],
	[50, W, 0.3],
	[10, L, 0.4],
	[25, L, 0.5]
];

const BONUS = { label: 'Real or Random', correct: 2, total: 3 };

describe('buildShareText', () => {
	it('renders the full card', () => {
		const text = buildShareText({ puzzleNumber: 12, calls: playGame(CONTRARIAN_GAME) });
		expect(text).toBe(
			[
				'Hindsight #12 · $100 → $153',
				'🟩⭐⭐🟥🟥',
				'🙃 The Contrarian',
				'https://hindsight.example'
			].join('\n')
		);
	});

	it('puts the result on the first line, for lock-screen previews', () => {
		const text = buildShareText({ puzzleNumber: 12, calls: playGame(CONTRARIAN_GAME) });
		expect(text.split('\n')[0]).toMatch(/^Hindsight #12 · \$100 → \$153$/);
	});

	it('uses the configured name and URL by default', () => {
		const text = buildShareText({ puzzleNumber: 1, calls: playGame(CONTRARIAN_GAME) });
		expect(text.startsWith(`${GAME_NAME} #1 · `)).toBe(true);
		expect(text.endsWith(`\n${SITE_URL}`)).toBe(true);
	});

	it('takes a custom URL, name and archetype, and still accepts a theme', () => {
		const calls = playGame(Array(5).fill([10, L, 0.5]));
		const input = {
			puzzleNumber: 1234,
			calls,
			url: 'https://example.com/?s=1',
			gameName: 'Other',
			archetype: ARCHETYPES[0]
		};
		const text = buildShareText({ ...input, theme: 'light' });
		expect(text).toBe(
			[
				'Other #1,234 · $100 → $59',
				'🟥🟥🟥🟥🟥',
				`${ARCHETYPES[0].emoji} ${ARCHETYPES[0].label}`,
				'https://example.com/?s=1'
			].join('\n')
		);
		expect(buildShareText({ ...input, theme: 'dark' })).toBe(text);
		expect(buildShareText(input)).toBe(text);
	});

	it('adds an optional bonus line before the URL', () => {
		const text = buildShareText({
			puzzleNumber: 3,
			calls: playGame(CONTRARIAN_GAME),
			bonus: BONUS
		});
		expect(text.split('\n')).toEqual([
			'Hindsight #3 · $100 → $153',
			'🟩⭐⭐🟥🟥',
			'🙃 The Contrarian',
			'🎲 Real or Random 2/3',
			SITE_URL
		]);
	});

	it('is at most 5 lines, with or without the bonus', () => {
		for (const specs of randomGames(500)) {
			const calls = playGame(specs);
			expect(buildShareText({ puzzleNumber: 7, calls }).split('\n')).toHaveLength(4);
			expect(buildShareText({ puzzleNumber: 7, calls, bonus: BONUS }).split('\n')).toHaveLength(5);
		}
	});

	it('shows big balances in whole dollars with thousands separators', () => {
		const text = buildShareText({ puzzleNumber: 1, calls: playGame(Array(5).fill([50, W, 0])) });
		// $1,889.56 on the books, $1,890 on screen.
		expect(text.split('\n')[0]).toBe('Hindsight #1 · $100 → $1,890');
	});

	it('handles an unfinished game', () => {
		const text = buildShareText({ puzzleNumber: 2, calls: playGame(CONTRARIAN_GAME.slice(0, 2)) });
		expect(text.split('\n').slice(0, 2)).toEqual(['Hindsight #2 · $100 → $146', '🟩⭐']);
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

describe('shareRow', () => {
	it('is one cell per call: right, wrong, or right against the crowd', () => {
		const calls = playGame([
			[10, W, 0.5],
			[25, W, 0.7],
			[50, W, 0.49],
			[10, L, 0.2],
			[25, L, 0.8]
		]);
		expect(shareRow(calls)).toBe('🟩🟩⭐🟥🟥');
	});

	it('ignores stake size', () => {
		const small = playGame(Array(5).fill([10, W, 0.3]));
		const big = playGame(Array(5).fill([50, W, 0.3]));
		expect(shareRow(small)).toBe('⭐⭐⭐⭐⭐');
		expect(shareRow(big)).toBe(shareRow(small));
	});

	it('uses single code points only, so nothing garbles across platforms', () => {
		for (const specs of randomGames(200)) {
			expect([...shareRow(playGame(specs))]).toHaveLength(5);
		}
	});
});

describe('formatWholeDollars', () => {
	it('rounds to whole dollars like the in-game balance', () => {
		expect(formatWholeDollars(2930)).toBe('$29');
		expect(formatWholeDollars(15_348)).toBe('$153');
		expect(formatWholeDollars(2950)).toBe('$30');
		expect(formatWholeDollars(2949)).toBe('$29');
		expect(formatWholeDollars(10_000)).toBe('$100');
		expect(formatWholeDollars(49)).toBe('$0');
		expect(formatWholeDollars(123_456_789)).toBe('$1,234,568');
	});

	it('matches the app formatter for every cent value it is likely to see', () => {
		for (let cents = 0; cents <= 300_000; cents += 7) {
			expect(formatWholeDollars(cents)).toBe(dollars(cents, { cents: false }));
		}
	});

	it('rejects values that are not whole, non-negative cents', () => {
		expect(() => formatWholeDollars(1.5)).toThrow(RangeError);
		expect(() => formatWholeDollars(-1)).toThrow(RangeError);
	});
});

describe('spoilers', () => {
	const directionGlyphs = /[↑↓↗↘⇧⇩⬆⬇▲▼△▽🔼🔽📈📉⏫⏬]|\b(up|down|bull|bear|long|short)\b/iu;

	it('the text is identical whichever way the calls went', () => {
		for (const specs of randomGames(500)) {
			const asPlayed = buildShareText({ puzzleNumber: 7, calls: playGame(specs), bonus: BONUS });
			const flipped = buildShareText({
				puzzleNumber: 7,
				calls: playGame(flipDirections(specs)),
				bonus: BONUS
			});
			const allUp = buildShareText({
				puzzleNumber: 7,
				calls: playGame(specs.map(([s, c, share]) => [s, c, share, 'up'])),
				bonus: BONUS
			});
			expect(flipped).toBe(asPlayed);
			expect(allUp).toBe(asPlayed);
		}
	});

	it('contains no arrows, chart emoji or direction words', () => {
		for (const specs of randomGames(500)) {
			const text = buildShareText({ puzzleNumber: 7, calls: playGame(specs), bonus: BONUS });
			expect(text).not.toMatch(directionGlyphs);
		}
		for (const a of ARCHETYPES) expect(`${a.emoji} ${a.label}`).not.toMatch(directionGlyphs);
	});
});
