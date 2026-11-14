import { describe, expect, it } from 'vitest';
import {
	ARCHETYPES,
	classifyArchetype,
	classifyGame,
	type ArchetypeKey,
	type CallRecord,
	type StoredCall
} from './archetype.ts';
import { ARCHETYPE_RULES, START_BALANCE_CENTS } from './config.ts';
import { flipDirections, playGame, randomGames, type CallSpec } from './testing.ts';

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
	'cool-customer': [
		[25, W, 0.5],
		[25, W, 0.5],
		[25, L, 0.5],
		[25, W, 0.5],
		[25, L, 0.5]
	],
	'paid-tuition': [
		[25, L, 0.5],
		[25, W, 0.5],
		[25, L, 0.5],
		[25, W, 0.5],
		[25, L, 0.5]
	]
};

/**
 * What each label claims about the game, written independently of the classifier. A game that
 * gets a label must satisfy its claim, so no label can land on a game that didn't earn it.
 */
const CLAIMS: Record<ArchetypeKey, (calls: readonly CallRecord[]) => boolean> = {
	oracle: (c) => c.every((x) => x.correct),
	'margin-call': (c) =>
		count(c, (x) => x.stakePercent === 50) >= ARCHETYPE_RULES.marginCallMaxStakes &&
		final(c) * 100 < START_BALANCE_CENTS * ARCHETYPE_RULES.marginCallBelowPercent,
	contrarian: (c) =>
		count(c, (x) => x.crowdShareOwn < 0.5) >= ARCHETYPE_RULES.contrarianCalls &&
		count(c, (x) => x.crowdShareOwn < 0.5 && x.correct) >= ARCHETYPE_RULES.contrarianWins,
	'diamond-hands': (c) =>
		count(c, (x) => x.stakePercent === 50) >= ARCHETYPE_RULES.diamondHandsMaxStakes &&
		final(c) >= START_BALANCE_CENTS,
	comeback: (c) =>
		low(c) * 100 < START_BALANCE_CENTS * ARCHETYPE_RULES.comebackLowPercent &&
		final(c) >= START_BALANCE_CENTS,
	herd: (c) => count(c, (x) => x.crowdShareOwn > 0.5) >= ARCHETYPE_RULES.herdCalls,
	'index-fund': (c) => count(c, (x) => x.stakePercent === 10) >= ARCHETYPE_RULES.indexFundMinStakes,
	// "Kept your cool and your money."
	'cool-customer': (c) =>
		final(c) >= START_BALANCE_CENTS &&
		low(c) * 100 >= START_BALANCE_CENTS * ARCHETYPE_RULES.comebackLowPercent,
	// "Markets charge for lessons."
	'paid-tuition': (c) => final(c) < START_BALANCE_CENTS
};

function count(calls: readonly CallRecord[], test: (c: CallRecord) => boolean): number {
	return calls.filter(test).length;
}
function final(calls: readonly CallRecord[]): number {
	return calls.at(-1)!.balanceAfterCents;
}
function low(calls: readonly CallRecord[]): number {
	return Math.min(START_BALANCE_CENTS, ...calls.map((c) => c.balanceAfterCents));
}

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

	it('every archetype turns up in ordinary random play', () => {
		const reached = new Set(randomGames(5000, 1).map((s) => classifyArchetype(playGame(s)).key));
		expect([...reached].sort()).toEqual(ARCHETYPES.map((a) => a.key).sort());
	});

	it('every label is earned: the game always satisfies what the label claims', () => {
		for (const specs of randomGames(5000, 2)) {
			const calls = playGame(specs);
			const { key } = classifyArchetype(calls);
			expect(CLAIMS[key](calls), `${key} for ${JSON.stringify(specs)}`).toBe(true);
		}
	});

	it('the first matching claim in priority order wins', () => {
		for (const specs of randomGames(5000, 3)) {
			const calls = playGame(specs);
			const first = ARCHETYPES.find((a) => CLAIMS[a.key](calls))!;
			expect(classifyArchetype(calls).key).toBe(first.key);
		}
	});

	describe('spoiler rule: never depends on whether calls were up or down', () => {
		it('for every fixture, all up, all down or alternating', () => {
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

		it('for random games with every direction flipped', () => {
			for (const specs of randomGames(2000, 4)) {
				expect(classifyArchetype(playGame(flipDirections(specs)))).toEqual(
					classifyArchetype(playGame(specs))
				);
			}
		});
	});

	describe('priority order', () => {
		it('lists the archetypes in the documented order', () => {
			expect(ARCHETYPES.map((a) => a.key)).toEqual([
				'oracle',
				'margin-call',
				'contrarian',
				'diamond-hands',
				'comeback',
				'herd',
				'index-fund',
				'cool-customer',
				'paid-tuition'
			]);
		});

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

		it('Comeback Kid beats Herd Animal', () => {
			const game = playGame([
				[50, L, 0.6],
				[25, W, 0.6],
				[25, W, 0.6],
				[25, W, 0.6],
				[50, W, 0.6]
			]);
			expect(game.at(-1)!.balanceAfterCents).toBeGreaterThanOrEqual(10_000);
			expect(classifyArchetype(game).key).toBe('comeback');
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

		it('The Index Fund beats both catch-alls', () => {
			const ahead = playGame([
				[10, W, 0.5],
				[10, W, 0.5],
				[10, L, 0.5],
				[10, W, 0.5],
				[10, L, 0.5]
			]);
			const behind = playGame(Array(5).fill([10, L, 0.5]));
			expect(ahead.at(-1)!.balanceAfterCents).toBeGreaterThanOrEqual(10_000);
			expect(behind.at(-1)!.balanceAfterCents).toBeLessThan(10_000);
			expect(classifyArchetype(ahead).key).toBe('index-fund');
			expect(classifyArchetype(behind).key).toBe('index-fund');
		});
	});

	it('treats an exactly even crowd as neither minority nor majority', () => {
		const game = playGame(Array(5).fill([25, L, 0.5]));
		expect(classifyArchetype(game).key).toBe('paid-tuition');
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
		expect(classifyArchetype(game).key).toBe('paid-tuition');
	});

	it('a loss with mixed stakes and switching sides is Paid Tuition, not an accusation', () => {
		// The playtester's game: lost most of the balance, but never 3 max stakes.
		const game = playGame([
			[50, L, 0.6],
			[25, W, 0.4],
			[50, L, 0.5],
			[25, L, 0.6],
			[10, W, 0.6]
		]);
		expect(game.at(-1)!.balanceAfterCents).toBeLessThan(5000);
		expect(classifyArchetype(game).key).toBe('paid-tuition');
	});

	it('rejects an empty game', () => {
		expect(() => classifyArchetype([])).toThrow(RangeError);
	});
});

describe('ARCHETYPES', () => {
	it('has 8 or 9 archetypes with unique keys, short labels and one-line quips', () => {
		expect(new Set(ARCHETYPES.map((a) => a.key)).size).toBe(ARCHETYPES.length);
		expect(ARCHETYPES.length).toBeGreaterThanOrEqual(8);
		expect(ARCHETYPES.length).toBeLessThanOrEqual(9);
		for (const a of ARCHETYPES) {
			expect(a.label.length).toBeLessThanOrEqual(16);
			expect(a.line.length, a.line).toBeLessThanOrEqual(45);
			expect(a.line).not.toContain('\n');
			expect([...a.emoji]).toHaveLength(1);
		}
		expect(new Set(ARCHETYPES.map((a) => a.emoji)).size).toBe(ARCHETYPES.length);
	});

	it('labels never name a direction', () => {
		for (const a of ARCHETYPES) {
			expect(a.label).not.toMatch(/\b(up|down|bull|bear|long|short)/i);
		}
	});
});

describe('classifyGame (stored calls)', () => {
	function stored(specs: readonly CallSpec[]): { calls: StoredCall[]; final: number } {
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

	it('agrees with classifyArchetype for random games, with directions flipped', () => {
		for (const specs of randomGames(1000, 5)) {
			const expected = classifyArchetype(playGame(specs)).key;
			for (const variant of [specs, flipDirections(specs)]) {
				const { calls, final } = stored(variant);
				expect(classifyGame(calls, final).key).toBe(expected);
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
