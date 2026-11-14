/**
 * Monte Carlo check of the payout rules.
 *
 *   node scripts/simulate.ts                 final rules vs the starting proposal
 *   node scripts/simulate.ts --games 50000   more games per scenario (default 20000)
 *   node scripts/simulate.ts --sweep         tune the per-chip payout share
 *   node scripts/simulate.ts --seed 7        different random stream (default 1)
 *
 * Every player in a game faces the same chart and the same crowd, so comparisons are paired.
 * Uses the real settlement code from src/lib/game/economy.ts.
 */
import {
	CALLS_PER_GAME,
	PAYOUT_RULES,
	START_BALANCE_CENTS,
	type PayoutRules
} from '../src/lib/game/config.ts';
import { lockMultiplier, settleCall, type Direction } from '../src/lib/game/economy.ts';

// ---------- randomness ----------

type Rng = () => number;

function mulberry32(seed: number): Rng {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function normal(rng: Rng): number {
	const u = Math.max(rng(), 1e-12);
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

function clamp(x: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, x));
}

function binomial(rng: Rng, n: number, p: number): number {
	if (n <= 60) {
		let k = 0;
		for (let i = 0; i < n; i++) if (rng() < p) k++;
		return k;
	}
	const k = Math.round(n * p + Math.sqrt(n * p * (1 - p)) * normal(rng));
	return clamp(k, 0, n);
}

const flip = (d: Direction): Direction => (d === 'up' ? 'down' : 'up');

// ---------- outcome models: how the chart moves after each call ----------

interface OutcomeModel {
	name: string;
	/** Probability the next stretch continues the recent trend, chosen once per chart. */
	continueProb: (rng: Rng) => number;
	/** Optional bias toward up, applied after the trend logic. */
	upBias?: number;
}

const OUTCOME_MODELS: OutcomeModel[] = [
	{ name: 'random walk', continueProb: () => 0.5 },
	{ name: 'momentum', continueProb: () => 0.6 },
	{ name: 'turning points', continueProb: () => 0.35 },
	{ name: 'mixed catalog', continueProb: (rng) => [0.35, 0.5, 0.6][Math.floor(rng() * 3)] },
	{ name: 'bull drift', continueProb: () => 0.5, upBias: 0.06 }
];

// ---------- crowd models: how everyone else calls ----------

interface CrowdModel {
	name: string;
	/** Share of the crowd calling up, given the visible trend and the (hidden) outcome. */
	shareUp: (rng: Rng, trend: Direction, outcome: Direction) => number;
	/** How many players called before our player. */
	players: (rng: Rng) => number;
}

const typicalPlayers = (rng: Rng): number =>
	rng() < 0.2 ? Math.floor(rng() * 40) : Math.floor(100 * Math.pow(200, rng()));

const onSide = (side: Direction, share: number): number => (side === 'up' ? share : 1 - share);

const CROWD_MODELS: CrowdModel[] = [
	{
		name: 'trend chasers',
		shareUp: (rng, trend) => onSide(trend, clamp(0.72 + 0.08 * normal(rng), 0.05, 0.95)),
		players: typicalPlayers
	},
	{
		name: 'bullish chasers',
		shareUp: (rng, trend) => clamp(onSide(trend, 0.7 + 0.08 * normal(rng)) + 0.08, 0.05, 0.95),
		players: typicalPlayers
	},
	{
		name: 'coin-flip crowd',
		shareUp: (rng) => clamp(0.5 + 0.06 * normal(rng), 0.05, 0.95),
		players: typicalPlayers
	},
	{
		name: 'wise crowd',
		shareUp: (rng, _trend, outcome) =>
			onSide(outcome, clamp(0.62 + 0.08 * normal(rng), 0.05, 0.95)),
		players: typicalPlayers
	},
	{
		name: 'savvy faders',
		shareUp: (rng, trend) => onSide(trend, clamp(0.38 + 0.08 * normal(rng), 0.05, 0.95)),
		players: typicalPlayers
	},
	{
		name: 'launch day',
		shareUp: (rng, trend) => onSide(trend, clamp(0.72 + 0.08 * normal(rng), 0.05, 0.95)),
		players: (rng) => Math.floor(rng() * 16)
	}
];

// ---------- players ----------

interface CallContext {
	trend: Direction;
	/** The shared imperfect read: a direction plus whether it feels confident. */
	read: Direction;
	confident: boolean;
	rng: Rng;
	rules: PayoutRules;
}

interface Decision {
	direction: Direction;
	stakePercent: number;
}

interface Player {
	name: string;
	decide: (ctx: CallContext) => Decision;
}

/** What a thoughtful player believes about a crowd it cannot see: most people chase the trend. */
const EXPECTED_CROWD_ON_TREND = 0.65;
const BELIEVED_ACCURACY = 0.6;

function chips(rules: PayoutRules): number[] {
	return rules.stakeOptions.map((o) => o.percent).sort((a, b) => a - b);
}

/**
 * Thoughtful: stakes by confidence and reasons about the crowd.
 * - Confident read against the trend (the crowd probably disagrees, so it pays more): max chip.
 * - Confident read with the trend (right, but probably with the crowd): middle chip.
 * - No read: it is a coin flip, so take the side that probably pays more, minimum chip.
 */
function thoughtfulDecision(ctx: CallContext): Decision {
	const [low, mid, high] = chips(ctx.rules);
	if (ctx.confident) {
		return { direction: ctx.read, stakePercent: ctx.read === ctx.trend ? mid : high };
	}
	return { direction: flip(ctx.trend), stakePercent: low };
}

/** Log-optimal (Kelly) choice under the thoughtful player's beliefs. A reference, not a human. */
function kellyDecision(ctx: CallContext): Decision {
	let best: Decision = { direction: flip(ctx.trend), stakePercent: chips(ctx.rules)[0] };
	let bestValue = -Infinity;
	for (const direction of ['up', 'down'] as Direction[]) {
		const p = ctx.confident
			? direction === ctx.read
				? BELIEVED_ACCURACY
				: 1 - BELIEVED_ACCURACY
			: 0.5;
		const ownShare =
			direction === ctx.trend ? EXPECTED_CROWD_ON_TREND : 1 - EXPECTED_CROWD_ON_TREND;
		const m = clamp(
			(ctx.rules.crowd.scaleHundredths * (1 - ownShare)) / 100,
			ctx.rules.crowd.minMultiplierHundredths / 100,
			ctx.rules.crowd.maxMultiplierHundredths / 100
		);
		for (const option of ctx.rules.stakeOptions) {
			const f = option.percent / 100;
			const win = f * m * (option.payoutPercent / 100);
			const value = p * Math.log(1 + win) + (1 - p) * Math.log(1 - f);
			if (value > bestValue) {
				bestValue = value;
				best = { direction, stakePercent: option.percent };
			}
		}
	}
	return best;
}

const PLAYERS: Player[] = [
	{ name: 'Thoughtful', decide: thoughtfulDecision },
	{
		name: 'All-in',
		decide: (ctx) => ({ direction: thoughtfulDecision(ctx).direction, stakePercent: 50 })
	},
	{
		name: 'Random',
		decide: (ctx) => {
			const options = chips(ctx.rules);
			return {
				direction: ctx.rng() < 0.5 ? 'up' : 'down',
				stakePercent: options[Math.floor(ctx.rng() * options.length)]
			};
		}
	},
	{ name: 'Always up', decide: () => ({ direction: 'up', stakePercent: 25 }) },
	{ name: 'Always down', decide: () => ({ direction: 'down', stakePercent: 25 }) },
	{ name: 'Herd', decide: (ctx) => ({ direction: ctx.trend, stakePercent: 25 }) },
	{ name: 'Contrarian', decide: (ctx) => ({ direction: flip(ctx.trend), stakePercent: 25 }) },
	{
		name: 'Timid',
		decide: (ctx) => ({ direction: thoughtfulDecision(ctx).direction, stakePercent: 10 })
	},
	{
		name: 'Reader (no crowd)',
		decide: (ctx) =>
			ctx.confident
				? { direction: ctx.read, stakePercent: 50 }
				: { direction: ctx.rng() < 0.5 ? 'up' : 'down', stakePercent: 10 }
	},
	{ name: 'Kelly (reference)', decide: kellyDecision }
];

// ---------- one game ----------

/**
 * The shared read: on CONFIDENT_SHARE of calls it is right with a probability drawn from
 * [low, high]; on the rest it is a coin flip. Override with --read 0.52,0.58 --confident 0.3.
 */
const READ = { confidentShare: 0.4, low: 0.55, high: 0.65 };

function playGame(
	rng: Rng,
	rules: PayoutRules,
	outcomeModel: OutcomeModel,
	crowdModel: CrowdModel,
	balances: number[],
	lows: number[]
): void {
	const continueProb = outcomeModel.continueProb(rng);
	for (let i = 0; i < PLAYERS.length; i++) {
		balances[i] = START_BALANCE_CENTS;
		lows[i] = START_BALANCE_CENTS;
	}
	let trend: Direction = rng() < 0.5 ? 'up' : 'down';
	for (let call = 0; call < CALLS_PER_GAME; call++) {
		let outcome: Direction = rng() < continueProb ? trend : flip(trend);
		if (outcomeModel.upBias && rng() < outcomeModel.upBias * 2) outcome = 'up';

		const confident = rng() < READ.confidentShare;
		const accuracy = confident ? READ.low + (READ.high - READ.low) * rng() : 0.5;
		const read: Direction = rng() < accuracy ? outcome : flip(outcome);

		const n = crowdModel.players(rng);
		const up = binomial(rng, n, crowdModel.shareUp(rng, trend, outcome));
		const counts = { up, down: n - up };

		for (let i = 0; i < PLAYERS.length; i++) {
			const d = PLAYERS[i].decide({ trend, read, confident, rng, rules });
			const multiplierHundredths = lockMultiplier(counts, d.direction, rules.crowd);
			const s = settleCall(
				{
					balanceCents: balances[i],
					stakePercent: d.stakePercent,
					multiplierHundredths,
					correct: d.direction === outcome
				},
				rules
			);
			balances[i] = s.balanceAfterCents;
			if (balances[i] < lows[i]) lows[i] = balances[i];
		}
		trend = outcome;
	}
}

// ---------- statistics ----------

interface Stats {
	mean: number;
	median: number;
	p10: number;
	p90: number;
	p99: number;
	max: number;
	above: number;
	broke: number;
	logReturn: number;
}

function quantile(sorted: Float64Array, q: number): number {
	return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function summarize(finals: Float64Array): Stats {
	const sorted = Float64Array.from(finals).sort();
	let sum = 0;
	let log = 0;
	let above = 0;
	let broke = 0;
	for (const v of finals) {
		sum += v;
		log += Math.log(v / 100);
		if (v > 100) above++;
		if (v < 40) broke++;
	}
	const n = finals.length;
	return {
		mean: sum / n,
		median: quantile(sorted, 0.5),
		p10: quantile(sorted, 0.1),
		p90: quantile(sorted, 0.9),
		p99: quantile(sorted, 0.99),
		max: sorted[n - 1],
		above: above / n,
		broke: broke / n,
		logReturn: log / n
	};
}

interface ScenarioResult {
	outcome: string;
	crowd: string;
	stats: Stats[];
	/** Share of games Thoughtful finished strictly above All-in. */
	beatsAllIn: number;
	beatsRandom: number;
	pooled: Float64Array[];
}

function runScenario(
	rules: PayoutRules,
	outcomeModel: OutcomeModel,
	crowdModel: CrowdModel,
	games: number,
	seed: number
): ScenarioResult {
	const rng = mulberry32(seed);
	const finals = PLAYERS.map(() => new Float64Array(games));
	const balances = new Array<number>(PLAYERS.length).fill(0);
	const lows = new Array<number>(PLAYERS.length).fill(0);
	const thoughtful = PLAYERS.findIndex((p) => p.name === 'Thoughtful');
	const allIn = PLAYERS.findIndex((p) => p.name === 'All-in');
	const random = PLAYERS.findIndex((p) => p.name === 'Random');
	let beatsAllIn = 0;
	let beatsRandom = 0;
	for (let g = 0; g < games; g++) {
		playGame(rng, rules, outcomeModel, crowdModel, balances, lows);
		for (let i = 0; i < PLAYERS.length; i++) finals[i][g] = balances[i] / 100;
		if (balances[thoughtful] > balances[allIn]) beatsAllIn++;
		if (balances[thoughtful] > balances[random]) beatsRandom++;
	}
	return {
		outcome: outcomeModel.name,
		crowd: crowdModel.name,
		stats: finals.map(summarize),
		beatsAllIn: beatsAllIn / games,
		beatsRandom: beatsRandom / games,
		pooled: finals
	};
}

function runAll(rules: PayoutRules, games: number, seed: number): ScenarioResult[] {
	const results: ScenarioResult[] = [];
	let s = seed;
	for (const o of OUTCOME_MODELS) {
		for (const c of CROWD_MODELS) results.push(runScenario(rules, o, c, games, s++ * 7919));
	}
	return results;
}

function pool(results: ScenarioResult[]): Stats[] {
	return PLAYERS.map((_, i) => {
		const total = results.reduce((n, r) => n + r.pooled[i].length, 0);
		const all = new Float64Array(total);
		let offset = 0;
		for (const r of results) {
			all.set(r.pooled[i], offset);
			offset += r.pooled[i].length;
		}
		return summarize(all);
	});
}

// ---------- printing ----------

const money = (v: number): string =>
	v >= 1000 ? `$${Math.round(v).toLocaleString('en-US')}` : `$${v.toFixed(2)}`;
const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;
const pad = (s: string, w: number): string => (s.length >= w ? s : s + ' '.repeat(w - s.length));
const lpad = (s: string, w: number): string => (s.length >= w ? s : ' '.repeat(w - s.length) + s);

function printTable(title: string, stats: Stats[]): void {
	console.log(`\n${title}`);
	const head = ['player', 'mean', 'median', 'P10', 'P90', 'P99', 'max', '>$100', '<$40', 'mean ln'];
	const widths = [18, 9, 9, 9, 9, 9, 9, 7, 7, 8];
	console.log(head.map((h, i) => (i === 0 ? pad(h, widths[i]) : lpad(h, widths[i]))).join(' '));
	stats.forEach((s, i) => {
		const row = [
			PLAYERS[i].name,
			money(s.mean),
			money(s.median),
			money(s.p10),
			money(s.p90),
			money(s.p99),
			money(s.max),
			pct(s.above),
			pct(s.broke),
			s.logReturn.toFixed(3)
		];
		console.log(row.map((c, j) => (j === 0 ? pad(c, widths[j]) : lpad(c, widths[j]))).join(' '));
	});
}

interface Verdict {
	/** Scenarios where Thoughtful beats All-in and Random on every required metric. */
	clean: number;
	/** Scenarios where Thoughtful also has a higher mean than All-in (reported, not required). */
	meanVsAllIn: number;
	total: number;
	failures: string[];
}

/**
 * "Clearly beat" = in every scenario, Thoughtful beats
 *   Random on mean, median, mean ln, share above $100 and P10, and
 *   All-in on median, mean ln, share above $100, P10 and the head-to-head (finishes higher on
 *   more than half of the days).
 * The mean against All-in is tracked separately: see the report for why it is not required.
 */
function verdict(results: ScenarioResult[]): Verdict {
	const t = PLAYERS.findIndex((p) => p.name === 'Thoughtful');
	const a = PLAYERS.findIndex((p) => p.name === 'All-in');
	const r = PLAYERS.findIndex((p) => p.name === 'Random');
	const failures: string[] = [];
	let clean = 0;
	let meanVsAllIn = 0;
	for (const res of results) {
		const me = res.stats[t];
		const lost: string[] = [];
		const checks: [string, number, boolean][] = [
			['Random', r, true],
			['All-in', a, false]
		];
		for (const [name, j, needMean] of checks) {
			const them = res.stats[j];
			if (needMean && me.mean <= them.mean) lost.push(`${name} mean`);
			if (me.median <= them.median) lost.push(`${name} median`);
			if (me.logReturn <= them.logReturn) lost.push(`${name} ln`);
			if (me.above <= them.above) lost.push(`${name} >$100`);
			if (me.p10 <= them.p10) lost.push(`${name} P10`);
		}
		if (res.beatsAllIn <= 0.5) lost.push('All-in head-to-head');
		if (me.mean > res.stats[a].mean) meanVsAllIn++;
		if (lost.length === 0) clean++;
		else failures.push(`${res.outcome} / ${res.crowd}: ${lost.join(', ')}`);
	}
	return { clean, meanVsAllIn, total: results.length, failures };
}

function printScenarioGrid(results: ScenarioResult[]): void {
	const t = PLAYERS.findIndex((p) => p.name === 'Thoughtful');
	const a = PLAYERS.findIndex((p) => p.name === 'All-in');
	const r = PLAYERS.findIndex((p) => p.name === 'Random');
	const c = PLAYERS.findIndex((p) => p.name === 'Contrarian');
	console.log(
		'\nPer scenario: Thoughtful vs All-in vs Random vs Contrarian (mean | median | mean ln)'
	);
	console.log(
		pad('outcome / crowd', 34) +
			lpad('Thoughtful', 30) +
			lpad('All-in', 30) +
			lpad('Random', 30) +
			lpad('Contrarian', 30) +
			lpad('T>A days', 10)
	);
	const cell = (s: Stats): string =>
		`${money(s.mean)} | ${money(s.median)} | ${s.logReturn.toFixed(3)}`;
	for (const res of results) {
		console.log(
			pad(`${res.outcome} / ${res.crowd}`, 34) +
				lpad(cell(res.stats[t]), 30) +
				lpad(cell(res.stats[a]), 30) +
				lpad(cell(res.stats[r]), 30) +
				lpad(cell(res.stats[c]), 30) +
				lpad(pct(res.beatsAllIn), 10)
		);
	}
}

function report(label: string, rules: PayoutRules, games: number, seed: number): void {
	const results = runAll(rules, games, seed);
	const describe = rules.stakeOptions
		.map((o) => `${o.percent}%${o.payoutPercent === 100 ? '' : ` pays ${o.payoutPercent}%`}`)
		.join(', ');
	const c = rules.crowd;
	console.log(`\n=== ${label} ===`);
	console.log(
		`chips: ${describe}; m = ${c.scaleHundredths / 100} x other share, clamp [${c.minMultiplierHundredths / 100}, ${c.maxMultiplierHundredths / 100}], prior ${c.priorPlayers}`
	);
	console.log(
		`${results.length} scenarios x ${games.toLocaleString('en-US')} games = ${(results.length * games).toLocaleString('en-US')} games per player`
	);
	printTable('All scenarios pooled', pool(results));
	const headline = results.filter(
		(r) => r.outcome === 'mixed catalog' && r.crowd === 'trend chasers'
	);
	printTable('Headline scenario: mixed catalog / trend chasers', headline[0].stats);
	printScenarioGrid(results);
	const v = verdict(results);
	console.log(`\nThoughtful clearly beats All-in and Random in ${v.clean}/${v.total} scenarios`);
	console.log(`Thoughtful also has the higher mean than All-in in ${v.meanVsAllIn}/${v.total}`);
	for (const f of v.failures) console.log(`  lost: ${f}`);
}

function sweep(games: number, seed: number): void {
	console.log('\n=== Sweep: crowd scale and payout share of the 50% chip ===');
	console.log(
		'clean = scenarios where Thoughtful clearly beats All-in and Random; ' +
			'mean = scenarios where it also beats All-in on the mean; T = Thoughtful, R = Random'
	);
	console.log(
		pad('scale / 50% chip pays', 24) +
			lpad('clean', 7) +
			lpad('mean', 7) +
			lpad('T mean', 10) +
			lpad('T median', 10) +
			lpad('T >$100', 9) +
			lpad('T P99', 9) +
			lpad('R median', 10) +
			lpad('R <$40', 8) +
			lpad('A mean', 10)
	);
	const t = PLAYERS.findIndex((p) => p.name === 'Thoughtful');
	const a = PLAYERS.findIndex((p) => p.name === 'All-in');
	const r = PLAYERS.findIndex((p) => p.name === 'Random');
	for (const scale of [200, 220, 240]) {
		for (const high of [100, 90, 80, 70]) {
			const rules: PayoutRules = {
				crowd: { ...PAYOUT_RULES.crowd, scaleHundredths: scale, maxMultiplierHundredths: 250 },
				stakeOptions: [
					{ percent: 10, payoutPercent: 100 },
					{ percent: 25, payoutPercent: 100 },
					{ percent: 50, payoutPercent: high }
				]
			};
			const results = runAll(rules, games, seed);
			const v = verdict(results);
			const pooled = pool(results);
			console.log(
				pad(`${(scale / 100).toFixed(1)}x / ${high}%`, 24) +
					lpad(`${v.clean}/${v.total}`, 7) +
					lpad(`${v.meanVsAllIn}`, 7) +
					lpad(money(pooled[t].mean), 10) +
					lpad(money(pooled[t].median), 10) +
					lpad(pct(pooled[t].above), 9) +
					lpad(money(pooled[t].p99), 9) +
					lpad(money(pooled[r].median), 10) +
					lpad(pct(pooled[r].broke), 8) +
					lpad(money(pooled[a].mean), 10)
			);
		}
	}
}

// ---------- main ----------

const args = process.argv.slice(2);
const flag = (name: string, fallback: number): number => {
	const i = args.indexOf(name);
	return i >= 0 ? Number(args[i + 1]) : fallback;
};
const games = flag('--games', 20000);
const seed = flag('--seed', 1);
const readIndex = args.indexOf('--read');
if (readIndex >= 0) {
	const [low, high] = args[readIndex + 1].split(',').map(Number);
	READ.low = low;
	READ.high = high;
}
READ.confidentShare = flag('--confident', READ.confidentShare);
console.log(
	`Thoughtful read: ${pct(READ.confidentShare)} of calls feel confident, right ${pct(READ.low)}-${pct(READ.high)} of those; coin flip otherwise`
);

const STARTING_PROPOSAL: PayoutRules = {
	stakeOptions: [
		{ percent: 10, payoutPercent: 100 },
		{ percent: 25, payoutPercent: 100 },
		{ percent: 50, payoutPercent: 100 }
	],
	crowd: {
		scaleHundredths: 200,
		minMultiplierHundredths: 50,
		maxMultiplierHundredths: 250,
		priorPlayers: 10
	}
};

if (args.includes('--sweep')) {
	sweep(Math.min(games, 10000), seed);
} else {
	report('Starting proposal', STARTING_PROPOSAL, games, seed);
	report('Final rules (src/lib/game/config.ts)', PAYOUT_RULES, games, seed);
}
