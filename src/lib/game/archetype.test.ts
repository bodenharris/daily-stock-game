import { describe, expect, it } from 'vitest';
import {
	ARCHETYPES,
	classifyArchetype,
	classifyGame,
	type ArchetypeKey,
	type StoredCall
} from './archetype.ts';
import { playGame, type CallSpec } from './testing.ts';

const W = true;
const L = false;

/** One natural game per archetype. */
const FIXTURES: Record<ArchetypeKey, CallSpec[]> = {
	oracle: [
		[25, W, 0.5],
		[10, W, 0.7],
		[50, W, 0.3],
		[25, W, 0.5],
		[10, W, 0.5]
	],
	'margin-call': [
		[50, L, 0.5],
		[50, L, 0.5],
		[50, W, 0.5],
		[10, L, 0.5],
		[10, W, 0.5]
	],
	contrarian: [
		[25, W, 0.3],
		[25, W, 0.3],
		[25, L, 0.3],
		[10, L, 0.5],
		[10, W, 0.5]
	],
	'diamond-hands': [
		[50, W, 0.6],
		[50, W, 0.6],
		[50, W, 0.6],
		[50, W, 0.6],
		[50, L, 0.6]
	],
	comeback: [
		[50, L, 0.5],
		[25, W, 0.5],
		[25, W, 0.5],
		[25, W, 0.5],
		[25, W, 0.5]
	],
	herd: [
		[25, W, 0.7],
		[25, L, 0.7],
		[25, W, 0.7],
		[25, L, 0.7],
		[25, W, 0.7]
	],
	'index-fund': [
		[10, W, 0.5],
		[10, L, 0.5],
		[10, L, 0.5],
		[10, W, 0.5],
		[25, L, 0.5]
	],
	'day-trader': [
		[25, W, 0.5],
		[25, W, 0.5],
		[25, L, 0.5],
		[25, W, 0.5],
		[25, L, 0.5]
	],
	bagholder: [
		[25, L, 0.5],
		[25, W, 0.5],
		[25, L, 0.5],
		[25, W, 0.5],
		[25, L, 0.5]
	]
};

describe('classifyArchetype', () => {
	for (const [key, specs] of Object.entries(FIXTURES)) {
		it(`reaches ${key}`, () => {
			expect(classifyArchetype(playGame(specs)).key).toBe(key);
		});
	}

	it('every archetype is reachable', () => {
		const reached = new Set(Object.values(FIXTURES).map((s) => classifyArchetype(playGame(s)).key));
		expect([...reached].sort()).toEqual(ARCHETYPES.map((a) => a.key).sort());
	});

	it('never depends on whether calls were up or down', () => {
		for (const specs of Object.values(FIXTURES)) {
			const up = playGame(specs.map(([s, c, share]) => [s, c, share, 'up'] as const));
			const down = playGame(specs.map(([s, c, share]) => [s, c, share, 'down'] as const));
			const mixed = playGame(
				specs.map(([s, c, share], i) => [s, c, share, i % 2 ? 'up' : 'down'] as const)
			);
			expect(classifyArchetype(down)).toEqual(classifyArchetype(up));
			expect(classifyArchetype(mixed)).toEqual(classifyArchetype(up));
		}
	});

	describe('priority order', () => {
		it('The Oracle beats Diamond Hands', () => {
			expect(classifyArchetype(playGame(Array(5).fill([50, W, 0.6]))).key).toBe('oracle');
		});

		it('Margin Call beats The Contrarian', () => {
			const game = playGame([
				[50, W, 0.3],
				[50, W, 0.3],
				[50, L, 0.3],
				[50, L, 0.5],
				[50, L, 0.5]
			]);
			expect(game.at(-1)!.balanceAfterCents).toBeLessThan(5000);
			expect(classifyArchetype(game).key).toBe('margin-call');
		});

		it('The Contrarian beats Diamond Hands', () => {
			const game = playGame([
				[50, W, 0.3],
				[50, W, 0.3],
				[50, L, 0.3],
				[50, W, 0.5],
				[25, L, 0.5]
			]);
			expect(game.at(-1)!.balanceAfterCents).toBeGreaterThanOrEqual(10_000);
			expect(classifyArchetype(game).key).toBe('contrarian');
		});

		it('Diamond Hands beats Comeback Kid', () => {
			const game = playGame([
				[50, L, 0.5],
				[50, W, 0.5],
				[50, W, 0.5],
				[50, W, 0.5],
				[50, W, 0.5]
			]);
			expect(classifyArchetype(game).key).toBe('diamond-hands');
		});

		it('Herd Animal beats The Index Fund', () => {
			const game = playGame([
				[10, W, 0.7],
				[10, L, 0.7],
				[10, W, 0.7],
				[10, L, 0.7],
				[10, W, 0.7]
			]);
			expect(classifyArchetype(game).key).toBe('herd');
		});
	});

	it('treats an exactly even crowd as neither minority nor majority', () => {
		const game = playGame(Array(5).fill([25, L, 0.5]));
		expect(classifyArchetype(game).key).toBe('bagholder');
	});

	it('a dip that does not recover is not a comeback', () => {
		expect(classifyArchetype(playGame(FIXTURES.herd)).key).toBe('herd');
		const game = playGame([
			[50, L, 0.5],
			[10, W, 0.5],
			[10, W, 0.5],
			[10, W, 0.5],
			[25, W, 0.5]
		]);
		expect(game.at(-1)!.balanceAfterCents).toBeLessThan(10_000);
		expect(classifyArchetype(game).key).toBe('bagholder');
	});

	it('rejects an empty game', () => {
		expect(() => classifyArchetype([])).toThrow(RangeError);
	});
});

describe('ARCHETYPES', () => {
	it('has unique keys, short labels and one-line quips', () => {
		expect(new Set(ARCHETYPES.map((a) => a.key)).size).toBe(ARCHETYPES.length);
		expect(ARCHETYPES.length).toBeGreaterThanOrEqual(8);
		for (const a of ARCHETYPES) {
			expect(a.label.length).toBeLessThanOrEqual(16);
			expect(a.line.length).toBeLessThanOrEqual(48);
			expect(a.line).not.toContain('\n');
			expect([...a.emoji]).toHaveLength(1);
		}
	});

	it('labels never name a direction', () => {
		for (const a of ARCHETYPES) {
			expect(a.label).not.toMatch(/\b(up|down|bull|bear|long|short)/i);
		}
	});
});

describe('classifyGame (stored calls)', () => {
	function stored(specs: CallSpec[]): { calls: StoredCall[]; final: number } {
		const played = playGame(specs);
		const calls = played.map((c, i) => ({
			step: i + 1,
			direction: c.direction,
			stakePercent: c.stakePercent,
			correct: c.correct,
			multiplierHundredths: c.multiplierHundredths,
			crowdUpShareAtCall: c.direction === 'up' ? c.crowdShareOwn : 1 - c.crowdShareOwn
		}));
		return { calls, final: played.at(-1)!.balanceAfterCents };
	}

	it('agrees with classifyArchetype for every fixture, in any row order and direction', () => {
		for (const [key, specs] of Object.entries(FIXTURES)) {
			const down = specs.map(([s, c, share]) => [s, c, share, 'down'] as const);
			for (const variant of [specs, down]) {
				const { calls, final } = stored(variant);
				expect(classifyGame(calls, final).key).toBe(key);
				expect(classifyGame([...calls].reverse(), final).key).toBe(key);
			}
		}
	});

	it('reads the minority side from the up share and the call direction', () => {
		const calls: StoredCall[] = [1, 2, 3, 4, 5].map((step) => ({
			step,
			direction: 'down',
			stakePercent: 25,
			correct: step !== 3,
			multiplierHundredths: 140,
			crowdUpShareAtCall: 0.7
		}));
		expect(classifyGame(calls, 18_000).key).toBe('contrarian');
	});

	it('rejects an empty game', () => {
		expect(() => classifyGame([], 10_000)).toThrow(RangeError);
	});
});
