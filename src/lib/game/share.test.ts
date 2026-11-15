import { describe, expect, it } from 'vitest';
import { GAME_NAME, SITE_URL } from './config.ts';
import { dollars } from '../play/money.ts';
import { ALPHA, PACK_EMOJI, PACK_RANKS } from './rank.ts';
import { buildShareText, formatWholeDollars, shareRow } from './share.ts';
import { flipDirections, playGame, randomGames, type CallSpec } from './testing.ts';

const W = true;
const L = false;
const HUNTER = { key: 'hunter', label: 'Hunter', line: 'Beat 45–79% of the pack.' } as const;

const CONTRARIAN_GAME: CallSpec[] = [
	[10, W, 0.5],
	[25, W, 0.35],
	[50, W, 0.3],
	[10, L, 0.4],
	[25, L, 0.5]
];

describe('buildShareText', () => {
	it('renders the full card', () => {
		const text = buildShareText({
			puzzleNumber: 12,
			calls: playGame(CONTRARIAN_GAME),
			rank: HUNTER,
			standing: '3rd of 6 today'
		});
		expect(text).toBe(
			[
				'The Wolf #12 · $100 → $146',
				'🟩⭐⭐🟥🟥',
				'🐺 Hunter · 3rd of 6 today',
				'https://thewolf.example'
			].join('\n')
		);
	});

	it('leaves the rank line out when there is no rank', () => {
		const calls = playGame(CONTRARIAN_GAME);
		const text = buildShareText({ puzzleNumber: 12, calls });
		expect(text).toBe(
			['The Wolf #12 · $100 → $146', '🟩⭐⭐🟥🟥', 'https://thewolf.example'].join('\n')
		);
		expect(buildShareText({ puzzleNumber: 12, calls, rank: null })).toBe(text);
	});

	it('puts the result on the first line, for lock-screen previews', () => {
		const text = buildShareText({ puzzleNumber: 12, calls: playGame(CONTRARIAN_GAME) });
		expect(text.split('\n')[0]).toMatch(/^The Wolf #12 · \$100 → \$146$/);
	});

	it('uses the configured name and URL by default', () => {
		const text = buildShareText({ puzzleNumber: 1, calls: playGame(CONTRARIAN_GAME) });
		expect(text.startsWith(`${GAME_NAME} #1 · `)).toBe(true);
		expect(text.endsWith(`\n${SITE_URL}`)).toBe(true);
	});

	it('takes a custom URL, name and rank, and still accepts a theme', () => {
		const calls = playGame(Array(5).fill([10, L, 0.5]));
		const input = {
			puzzleNumber: 1234,
			calls,
			url: 'https://example.com/?s=1',
			gameName: 'Other',
			rank: ALPHA
		};
		const text = buildShareText({ ...input, theme: 'light' });
		expect(text).toBe(
			['Other #1,234 · $100 → $59', '🟥🟥🟥🟥🟥', '🐺 Alpha', 'https://example.com/?s=1'].join('\n')
		);
		expect(buildShareText({ ...input, theme: 'dark' })).toBe(text);
		expect(buildShareText(input)).toBe(text);
	});

	it('is always 4 lines with a rank, 3 without', () => {
		for (const specs of randomGames(500)) {
			const calls = playGame(specs);
			const ranked = buildShareText({ puzzleNumber: 7, calls, rank: HUNTER, standing: '2nd of 5' });
			expect(ranked.split('\n')).toHaveLength(4);
			expect(buildShareText({ puzzleNumber: 7, calls }).split('\n')).toHaveLength(3);
		}
	});

	it('shows big balances in whole dollars with thousands separators', () => {
		const text = buildShareText({ puzzleNumber: 1, calls: playGame(Array(5).fill([50, W, 0])) });
		// $1,048.57 on the books, $1,049 on screen.
		expect(text.split('\n')[0]).toBe('The Wolf #1 · $100 → $1,049');
	});

	it('handles an unfinished game', () => {
		const text = buildShareText({ puzzleNumber: 2, calls: playGame(CONTRARIAN_GAME.slice(0, 2)) });
		expect(text.split('\n').slice(0, 2)).toEqual(['The Wolf #2 · $100 → $141', '🟩⭐']);
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
		const extra = { rank: HUNTER, standing: '3rd of 6 today' };
		for (const specs of randomGames(500)) {
			const asPlayed = buildShareText({ puzzleNumber: 7, calls: playGame(specs), ...extra });
			const flipped = buildShareText({
				puzzleNumber: 7,
				calls: playGame(flipDirections(specs)),
				...extra
			});
			const allUp = buildShareText({
				puzzleNumber: 7,
				calls: playGame(specs.map(([s, c, share]) => [s, c, share, 'up'])),
				...extra
			});
			expect(flipped).toBe(asPlayed);
			expect(allUp).toBe(asPlayed);
		}
	});

	it('contains no arrows, chart emoji or direction words', () => {
		for (const specs of randomGames(500)) {
			const text = buildShareText({ puzzleNumber: 7, calls: playGame(specs) });
			expect(text).not.toMatch(directionGlyphs);
		}
		for (const r of [...PACK_RANKS, ALPHA]) {
			expect(`${PACK_EMOJI} ${r.label}`).not.toMatch(directionGlyphs);
		}
	});
});

describe('share standing', () => {
	it('adds the standing to the rank line without adding a line', async () => {
		const { buildShareText } = await import('./share.ts');
		const calls = [
			{
				direction: 'up' as const,
				stakePercent: 25,
				correct: true,
				crowdShareOwn: 0.5,
				multiplierHundredths: 100,
				balanceAfterCents: 12500
			}
		];
		const base = { puzzleNumber: 3, calls, url: 'https://x.test', rank: HUNTER };
		const without = buildShareText(base);
		const withIt = buildShareText({ ...base, standing: '2nd of 5 today' });
		expect(withIt.split(/\n/)).toHaveLength(without.split(/\n/).length);
		expect(withIt).toContain('🐺 Hunter · 2nd of 5 today');
	});
});

describe('share named', () => {
	it('adds a target after the row when the moment was named, and nothing otherwise', () => {
		const calls = playGame(CONTRARIAN_GAME);
		const named = buildShareText({ puzzleNumber: 4, calls, named: true }).split(/\n/);
		const plain = buildShareText({ puzzleNumber: 4, calls, named: false }).split(/\n/);
		expect(named[1]).toBe('🟩⭐⭐🟥🟥 🎯');
		expect(plain[1]).toBe('🟩⭐⭐🟥🟥');
		expect(named).toHaveLength(plain.length);
		expect(buildShareText({ puzzleNumber: 4, calls }).split(/\n/)).toEqual(plain);
	});
});
