/**
 * The end-of-game label. Deterministic: the first rule in ARCHETYPES whose test passes wins.
 *
 * Priority order (most remarkable story first):
 *   1. The Oracle       every call right
 *   2. Margin Call      3+ calls at the biggest chip, finished below half the start
 *   3. The Contrarian   3+ calls on the minority side, 2+ of them right
 *   4. Diamond Hands    4+ calls at the biggest chip, finished at or above the start
 *   5. Comeback Kid     dipped below 75% of the start, finished above it
 *   6. Herd Animal      4+ calls on the majority side
 *   7. The Index Fund   4+ calls at the smallest chip
 *   8. The Day Trader   anything else, finished at or above the start
 *   9. The Bagholder    anything else, finished below the start
 *
 * No archetype depends on whether calls were up or down: the label goes into the share text,
 * and together with the right/wrong grid a direction-based label would spoil the chart.
 */
import { ARCHETYPE_RULES, PAYOUT_RULES, START_BALANCE_CENTS, type PayoutRules } from './config.ts';
import { settleCall, type Direction } from './economy.ts';

/** One settled call, as the game records it. */
export interface CallRecord {
	readonly direction: Direction;
	readonly stakePercent: number;
	readonly correct: boolean;
	/**
	 * Share (0..1) of the crowd on the player's side when the call was locked, prior included,
	 * player excluded. Below 0.5 = minority side, above 0.5 = majority side.
	 */
	readonly crowdShareOwn: number;
	readonly multiplierHundredths: number;
	readonly balanceAfterCents: number;
}

export type ArchetypeKey =
	| 'oracle'
	| 'margin-call'
	| 'contrarian'
	| 'diamond-hands'
	| 'comeback'
	| 'herd'
	| 'index-fund'
	| 'day-trader'
	| 'bagholder';

export interface Archetype {
	readonly key: ArchetypeKey;
	readonly label: string;
	/** One dry line under the label. */
	readonly line: string;
	/** Shown in the share text. Chosen from emoji every major platform has rendered for years. */
	readonly emoji: string;
}

interface GameFacts {
	calls: number;
	right: number;
	maxStakes: number;
	minStakes: number;
	minorityCalls: number;
	minorityWins: number;
	majorityCalls: number;
	startCents: number;
	finalCents: number;
	lowCents: number;
}

interface Rule {
	archetype: Archetype;
	test: (f: GameFacts) => boolean;
}

const R = ARCHETYPE_RULES;

const RULES: readonly Rule[] = [
	{
		archetype: {
			key: 'oracle',
			label: 'The Oracle',
			line: 'Every call right. The SEC would like a word.',
			emoji: '🔮'
		},
		test: (f) => f.right === f.calls
	},
	{
		archetype: {
			key: 'margin-call',
			label: 'Margin Call',
			line: 'Bet big. Learned bigger.',
			emoji: '💥'
		},
		test: (f) =>
			f.maxStakes >= R.marginCallMaxStakes &&
			f.finalCents * 100 < f.startCents * R.marginCallBelowPercent
	},
	{
		archetype: {
			key: 'contrarian',
			label: 'The Contrarian',
			line: 'Faded the crowd and got paid for it.',
			emoji: '🙃'
		},
		test: (f) => f.minorityCalls >= R.contrarianCalls && f.minorityWins >= R.contrarianWins
	},
	{
		archetype: {
			key: 'diamond-hands',
			label: 'Diamond Hands',
			line: 'Max stake, no flinching, still standing.',
			emoji: '💎'
		},
		test: (f) => f.maxStakes >= R.diamondHandsMaxStakes && f.finalCents >= f.startCents
	},
	{
		archetype: {
			key: 'comeback',
			label: 'Comeback Kid',
			line: 'Down bad, then not.',
			emoji: '🧗'
		},
		test: (f) =>
			f.lowCents * 100 < f.startCents * R.comebackLowPercent && f.finalCents > f.startCents
	},
	{
		archetype: {
			key: 'herd',
			label: 'Herd Animal',
			line: 'Agreed with everyone. Bold.',
			emoji: '🐑'
		},
		test: (f) => f.majorityCalls >= R.herdCalls
	},
	{
		archetype: {
			key: 'index-fund',
			label: 'The Index Fund',
			line: 'Low risk, low drama. Your advisor approves.',
			emoji: '🐢'
		},
		test: (f) => f.minStakes >= R.indexFundMinStakes
	},
	{
		archetype: {
			key: 'day-trader',
			label: 'The Day Trader',
			line: 'In, out, a little up. Expense the coffee.',
			emoji: '💼'
		},
		test: (f) => f.finalCents >= f.startCents
	},
	{
		archetype: {
			key: 'bagholder',
			label: 'The Bagholder',
			line: 'Held the bag. It was heavy.',
			emoji: '🎒'
		},
		test: () => true
	}
];

/** Every archetype, in priority order. */
export const ARCHETYPES: readonly Archetype[] = RULES.map((r) => r.archetype);

export interface ClassifyOptions {
	startBalanceCents?: number;
	rules?: PayoutRules;
}

/** Pick the archetype for a finished game. Throws on an empty game. */
export function classifyArchetype(
	calls: readonly CallRecord[],
	options: ClassifyOptions = {}
): Archetype {
	if (calls.length === 0) throw new RangeError('cannot classify a game with no calls');
	const startCents = options.startBalanceCents ?? START_BALANCE_CENTS;
	const chips = (options.rules ?? PAYOUT_RULES).stakeOptions.map((o) => o.percent);
	const maxChip = Math.max(...chips);
	const minChip = Math.min(...chips);

	const facts: GameFacts = {
		calls: calls.length,
		right: 0,
		maxStakes: 0,
		minStakes: 0,
		minorityCalls: 0,
		minorityWins: 0,
		majorityCalls: 0,
		startCents,
		finalCents: calls[calls.length - 1].balanceAfterCents,
		lowCents: startCents
	};
	for (const call of calls) {
		if (call.correct) facts.right++;
		if (call.stakePercent === maxChip) facts.maxStakes++;
		if (call.stakePercent === minChip) facts.minStakes++;
		if (call.crowdShareOwn < 0.5) {
			facts.minorityCalls++;
			if (call.correct) facts.minorityWins++;
		} else if (call.crowdShareOwn > 0.5) {
			facts.majorityCalls++;
		}
		facts.lowCents = Math.min(facts.lowCents, call.balanceAfterCents);
	}
	return RULES.find((r) => r.test(facts))!.archetype;
}

/** A call as the server stores it (one `guesses` row). */
export interface StoredCall {
	/** 1-based call number. */
	readonly step: number;
	readonly direction: Direction;
	readonly stakePercent: number;
	readonly correct: boolean;
	readonly multiplierHundredths: number;
	/** Blended share (0..1) of the crowd that had called up when this call was locked. */
	readonly crowdUpShareAtCall: number;
}

/**
 * classifyArchetype for stored calls. Sorts by step, converts the up share to the player's own
 * side, and replays the settlement from the start balance to recover the low point. The final
 * balance passed in is authoritative.
 */
export function classifyGame(
	calls: readonly StoredCall[],
	finalBalanceCents: number,
	options: ClassifyOptions = {}
): Archetype {
	if (calls.length === 0) throw new RangeError('cannot classify a game with no calls');
	const rules = options.rules ?? PAYOUT_RULES;
	let balance = options.startBalanceCents ?? START_BALANCE_CENTS;
	const ordered = [...calls].sort((a, b) => a.step - b.step);
	const records: CallRecord[] = ordered.map((call, i) => {
		balance = settleCall(
			{
				balanceCents: balance,
				stakePercent: call.stakePercent,
				multiplierHundredths: call.multiplierHundredths,
				correct: call.correct
			},
			rules
		).balanceAfterCents;
		const last = i === ordered.length - 1;
		return {
			direction: call.direction,
			stakePercent: call.stakePercent,
			correct: call.correct,
			crowdShareOwn:
				call.direction === 'up' ? call.crowdUpShareAtCall : 1 - call.crowdUpShareAtCall,
			multiplierHundredths: call.multiplierHundredths,
			balanceAfterCents: last ? finalBalanceCents : balance
		};
	});
	return classifyArchetype(records, options);
}
