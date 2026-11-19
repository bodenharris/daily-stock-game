import { describe, expect, it } from 'vitest';
import { toRecords } from '#lib/play/records.ts';
import type { CallResult } from '#lib/play/types.ts';
import { CALLS_PER_GAME, CROWD_RULES, START_BALANCE_CENTS } from './config.ts';
import { settleCall, type Direction } from './economy.ts';
import { ALPHA, PACK_EMOJI, PACK_RANKS } from './rank.ts';
import { buildShareText, shareRow } from './share.ts';

/** [stake percent, right?, crowd share on own side (0..1), direction] */
type CallSpec = readonly [number, boolean, number, Direction?];

/** Plays the calls in order from the start balance, as the server would record them. */
function play(specs: readonly CallSpec[]): CallResult[] {
	const {
		minMultiplierHundredths: min,
		maxMultiplierHundredths: max,
		slopeHundredths
	} = CROWD_RULES;
	let balance = START_BALANCE_CENTS;
	return specs.map(([stakePercent, correct, shareOwn, direction = 'up'], i) => {
		const multiplierHundredths = Math.min(
			max,
			Math.max(min, Math.round(100 + slopeHundredths * (0.5 - shareOwn)))
		);
		const s = settleCall({ balanceCents: balance, stakePercent, multiplierHundredths, correct });
		balance = s.balanceAfterCents;
		return {
			step: i + 1,
			direction,
			correct,
			deltaCents: s.deltaCents,
			stakeCents: s.stakeCents,
			balanceAfterCents: balance,
			crowdUpShareAtCall: direction === 'up' ? shareOwn : 1 - shareOwn,
			move: 0,
			crowd: { up: 0, down: 0 }
		};
	});
}
const playGame = (specs: readonly CallSpec[]) => toRecords(play(specs));

/** Deterministic random full games (seeded Park-Miller): any chip, result, crowd and direction. */
function randomGames(count: number, seed = 99): CallSpec[][] {
	let state = seed;
	const rand = () => {
		state = (state * 16807) % 2147483647;
		return state / 2147483647;
	};
	return Array.from({ length: count }, () =>
		Array.from({ length: CALLS_PER_GAME }, (): CallSpec => {
			const direction: Direction = rand() < 0.5 ? 'up' : 'down';
			return [[10, 25, 50][Math.floor(rand() * 3)], rand() < 0.5, rand(), direction];
		})
	);
}

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
				'https://thewolfof.nyc'
			].join('\n')
		);
	});

	it('leaves the rank line out when there is no rank', () => {
		const calls = playGame(CONTRARIAN_GAME);
		const text = buildShareText({ puzzleNumber: 12, calls });
		expect(text).toBe(
			['The Wolf #12 · $100 → $146', '🟩⭐⭐🟥🟥', 'https://thewolfof.nyc'].join('\n')
		);
		expect(buildShareText({ puzzleNumber: 12, calls, rank: null })).toBe(text);
	});

	it('takes a URL and a rank without a standing', () => {
		const text = buildShareText({
			puzzleNumber: 1234,
			calls: playGame(Array(5).fill([10, L, 0.5])),
			url: 'https://example.com/?s=1',
			rank: ALPHA
		});
		expect(text).toBe(
			['The Wolf #1,234 · $100 → $60', '🟥🟥🟥🟥🟥', '🐺 Alpha', 'https://example.com/?s=1'].join(
				'\n'
			)
		);
	});

	it('shows big balances in whole dollars with thousands separators', () => {
		const text = buildShareText({ puzzleNumber: 1, calls: playGame(Array(5).fill([50, W, 0])) });
		expect(text.split('\n')[0]).toBe('The Wolf #1 · $100 → $1,044');
	});

	it('handles an unfinished game', () => {
		const text = buildShareText({ puzzleNumber: 2, calls: playGame(CONTRARIAN_GAME.slice(0, 2)) });
		expect(text.split('\n').slice(0, 2)).toEqual(['The Wolf #2 · $100 → $140', '🟩⭐']);
	});

	it('adds a target after the row when the moment was named, and nothing otherwise', () => {
		const calls = playGame(CONTRARIAN_GAME);
		const named = buildShareText({ puzzleNumber: 4, calls, named: true }).split('\n');
		const plain = buildShareText({ puzzleNumber: 4, calls, named: false }).split('\n');
		expect(named[1]).toBe('🟩⭐⭐🟥🟥 🎯');
		expect(plain[1]).toBe('🟩⭐⭐🟥🟥');
		expect(named).toHaveLength(plain.length);
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

describe('spoilers', () => {
	const directionGlyphs = /[↑↓↗↘⇧⇩⬆⬇▲▼△▽🔼🔽📈📉⏫⏬]|\b(up|down|bull|bear|long|short)\b/iu;

	it('the text is identical whichever way the calls went', () => {
		const extra = { puzzleNumber: 7, rank: HUNTER, standing: '3rd of 6 today' };
		for (const specs of randomGames(500)) {
			const flipped = specs.map(([s, c, share, d]): CallSpec => [
				s,
				c,
				share,
				d === 'up' ? 'down' : 'up'
			]);
			expect(buildShareText({ ...extra, calls: playGame(flipped) })).toBe(
				buildShareText({ ...extra, calls: playGame(specs) })
			);
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
