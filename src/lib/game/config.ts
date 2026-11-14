/**
 * Every tunable game constant lives here. Pure data: no imports, safe on server and client.
 *
 * Money is in integer cents and multipliers are in integer hundredths (150 = 1.50x) so that
 * every calculation is exact and identical on every device.
 */

/** Working name. Change it here and everywhere follows. */
export const GAME_NAME = 'Hindsight';

/** Placeholder until the domain is decided. Used by the share text. */
export const SITE_URL = 'https://hindsight.example';

/** Every game starts with $100. */
export const START_BALANCE_CENTS = 10_000;

/** Up/down calls per daily game. */
export const CALLS_PER_GAME = 5;

export interface StakeOption {
	/** Share of the current balance put at risk, in percent. */
	readonly percent: number;
	/**
	 * Share of the crowd bonus (multiplier - 1) this chip earns on a right call, in percent.
	 * A right call always wins the stake as profit; on top it wins
	 * stake x (multiplier - 1) x payoutPercent / 100. So a right call never pays below 1.00x.
	 */
	readonly payoutPercent: number;
}

/**
 * The three stake chips. Bonus shares 100/40/20 make the crowd bonus the same number of dollars
 * on every chip: (multiplier - 1) x 10% of the balance, so at most +10% of the balance. Bigger
 * stakes raise what you risk and win at even money, not the bonus; that is what stops
 * "always stake 50%" from beating careful sizing (see scripts/simulate.ts --sweep).
 */
export const STAKE_OPTIONS: readonly StakeOption[] = [
	{ percent: 10, payoutPercent: 100 },
	{ percent: 25, payoutPercent: 40 },
	{ percent: 50, payoutPercent: 20 }
];

export interface CrowdRules {
	/**
	 * multiplier = 1 + slope x (share of players who called the other way - 1/2), in hundredths.
	 * 200 makes it 2 x the other side's share: 50/50 -> 1.00x, beating 80/20 -> 1.60x.
	 */
	readonly slopeHundredths: number;
	/** Must be at least 100: a right call never pays less than the stake. */
	readonly minMultiplierHundredths: number;
	readonly maxMultiplierHundredths: number;
	/**
	 * A 50/50 prior worth this many imaginary players is blended into the real split, so the
	 * first few players cannot swing the multiplier. Must be even (half up, half down).
	 */
	readonly priorPlayers: number;
}

/** Joining the majority pays even money (the floor); beating it pays a bonus. */
export const CROWD_RULES: CrowdRules = {
	slopeHundredths: 200,
	minMultiplierHundredths: 100,
	maxMultiplierHundredths: 200,
	priorPlayers: 10
};

export interface PayoutRules {
	readonly stakeOptions: readonly StakeOption[];
	readonly crowd: CrowdRules;
}

/** The rules the app plays by. The simulator passes alternatives to compare. */
export const PAYOUT_RULES: PayoutRules = {
	stakeOptions: STAKE_OPTIONS,
	crowd: CROWD_RULES
};

/** Thresholds for the end-of-game archetype. See archetype.ts for the priority order. */
export const ARCHETYPE_RULES = {
	/** Diamond Hands: at least this many calls at the biggest chip, finishing at or above $100. */
	diamondHandsMaxStakes: 4,
	/** Margin Call: at least this many calls at the biggest chip... */
	marginCallMaxStakes: 3,
	/** ...finishing below this percent of the start balance. */
	marginCallBelowPercent: 50,
	/** The Contrarian: at least this many calls on the minority side... */
	contrarianCalls: 3,
	/** ...with at least this many of them right. */
	contrarianWins: 2,
	/** Comeback Kid: dipped below this percent of the start, then finished above the start. */
	comebackLowPercent: 75,
	/** Herd Animal: at least this many calls on the majority side. */
	herdCalls: 4,
	/** The Index Fund: at least this many calls at the smallest chip. */
	indexFundMinStakes: 4
} as const;

/** Calendar date (in PUZZLE_TIME_ZONE) of puzzle #1. */
export const LAUNCH_DATE = '2026-11-01';

/** The daily puzzle rolls over at midnight in this time zone. */
export const PUZZLE_TIME_ZONE = 'America/New_York';
