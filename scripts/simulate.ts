// Monte Carlo check of the payout rules (src/lib/game/config.ts), with the game's own settlement
// code. Run it after changing the rules: thoughtful play has to clearly beat both all-in and
// random play in every scenario, or it exits with an error.
//
// 5 chart models × 6 crowd models, 20,000 games each. Every player in a game faces the same chart
// and the same crowd, so the comparisons are paired.
import { CALLS_PER_GAME, STAKE_OPTIONS, START_BALANCE_CENTS } from '#lib/game/config.ts';
import { lockMultiplier, settleCall, type Direction } from '#lib/game/economy.ts';

const GAMES = 20_000;

/** mulberry32: small, fast and seedable, so every run prints the same numbers. */
function rng(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
type Rng = ReturnType<typeof rng>;

const normal = (r: Rng) =>
	Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r());
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const flip = (d: Direction): Direction => (d === 'up' ? 'down' : 'up');
/** Share calling up, given the share on `side`. */
const onSide = (side: Direction, share: number) => (side === 'up' ? share : 1 - share);
const around = (r: Rng, mean: number) => clamp(mean + 0.08 * normal(r), 0.05, 0.95);

/** How the chart moves: the chance each stretch continues the last one, drawn once per chart. */
const CHARTS: { name: string; continues: (r: Rng) => number; upBias?: number }[] = [
	{ name: 'random walk', continues: () => 0.5 },
	{ name: 'momentum', continues: () => 0.6 },
	{ name: 'turning points', continues: () => 0.35 },
	{ name: 'mixed catalog', continues: (r) => [0.35, 0.5, 0.6][Math.floor(r() * 3)] },
	{ name: 'bull drift', continues: () => 0.5, upBias: 0.06 }
];

/** How everyone else calls, and how many called before our players (a few on launch day). */
const typical = (r: Rng) =>
	r() < 0.2 ? Math.floor(r() * 40) : Math.floor(100 * Math.pow(200, r()));
const CROWDS: {
	name: string;
	shareUp: (r: Rng, trend: Direction, outcome: Direction) => number;
	players: (r: Rng) => number;
}[] = [
	{
		name: 'trend chasers',
		shareUp: (r, trend) => onSide(trend, around(r, 0.72)),
		players: typical
	},
	{
		name: 'bullish chasers',
		shareUp: (r, trend) => clamp(onSide(trend, 0.7 + 0.08 * normal(r)) + 0.08, 0.05, 0.95),
		players: typical
	},
	{
		name: 'coin-flip crowd',
		shareUp: (r) => clamp(0.5 + 0.06 * normal(r), 0.05, 0.95),
		players: typical
	},
	{
		name: 'wise crowd',
		shareUp: (r, _, outcome) => onSide(outcome, around(r, 0.62)),
		players: typical
	},
	{ name: 'savvy faders', shareUp: (r, trend) => onSide(trend, around(r, 0.38)), players: typical },
	{
		name: 'launch day',
		shareUp: (r, trend) => onSide(trend, around(r, 0.72)),
		players: (r) => Math.floor(r() * 16)
	}
];

const [LOW, MID, HIGH] = STAKE_OPTIONS.map((o) => o.percent).toSorted((a, b) => a - b);

type Call = { trend: Direction; read: Direction; confident: boolean; r: Rng };
/**
 * Thoughtful: a confident read against the trend probably beats the crowd, so it gets the big
 * chip; with the trend, the middle one. No read means a coin flip, so it takes the side that
 * probably pays more, at the small chip.
 */
const thoughtful = ({ trend, read, confident }: Call) =>
	confident
		? { direction: read, stake: read === trend ? MID : HIGH }
		: { direction: flip(trend), stake: LOW };
const PLAYERS: { name: string; decide: (c: Call) => { direction: Direction; stake: number } }[] = [
	{ name: 'Thoughtful', decide: thoughtful },
	{ name: 'All-in', decide: (c) => ({ direction: thoughtful(c).direction, stake: HIGH }) },
	{
		name: 'Random',
		decide: ({ r }) => ({
			direction: r() < 0.5 ? 'up' : 'down',
			stake: [LOW, MID, HIGH][Math.floor(r() * 3)]
		})
	}
];

/**
 * The read every player shares: on 40% of calls it feels confident and is right 55–65% of the
 * time; otherwise it's a coin flip.
 */
function playGame(r: Rng, chart: (typeof CHARTS)[number], crowd: (typeof CROWDS)[number]) {
	const continues = chart.continues(r);
	const balances = PLAYERS.map(() => START_BALANCE_CENTS);
	let trend: Direction = r() < 0.5 ? 'up' : 'down';
	for (let call = 0; call < CALLS_PER_GAME; call++) {
		let outcome = r() < continues ? trend : flip(trend);
		if (chart.upBias && r() < chart.upBias * 2) outcome = 'up';
		const confident = r() < 0.4;
		const accuracy = confident ? 0.55 + 0.1 * r() : 0.5;
		const read = r() < accuracy ? outcome : flip(outcome);
		const n = crowd.players(r);
		const p = crowd.shareUp(r, trend, outcome);
		let up = 0;
		if (n <= 60) for (let i = 0; i < n; i++) up += r() < p ? 1 : 0;
		else up = clamp(Math.round(n * p + Math.sqrt(n * p * (1 - p)) * normal(r)), 0, n);
		for (const [i, player] of PLAYERS.entries()) {
			const { direction, stake } = player.decide({ trend, read, confident, r });
			balances[i] = settleCall({
				balanceCents: balances[i],
				stakePercent: stake,
				multiplierHundredths: lockMultiplier({ up, down: n - up }, direction),
				correct: direction === outcome
			}).balanceAfterCents;
		}
		trend = outcome;
	}
	return balances.map((b) => b / 100);
}

function stats(finals: Float64Array) {
	const sorted = finals.toSorted();
	const at = (q: number) => sorted[Math.floor(q * sorted.length)];
	let sum = 0;
	let log = 0;
	let above = 0;
	for (const v of finals) {
		sum += v;
		log += Math.log(v / 100);
		if (v > 100) above++;
	}
	const n = finals.length;
	return { mean: sum / n, median: at(0.5), p10: at(0.1), above: above / n, log: log / n };
}

const money = (v: number) => `$${v.toFixed(2)}`;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const pooled = PLAYERS.map(() => [] as number[]);
const lost: string[] = [];
let seed = 1;
for (const chart of CHARTS) {
	for (const crowd of CROWDS) {
		const r = rng(seed++ * 7919);
		const finals = PLAYERS.map(() => new Float64Array(GAMES));
		let beatsAllIn = 0;
		for (let g = 0; g < GAMES; g++) {
			const result = playGame(r, chart, crowd);
			result.forEach((v, i) => (finals[i][g] = v));
			if (result[0] > result[1]) beatsAllIn++;
		}
		finals.forEach((f, i) => pooled[i].push(...f));
		// "Clearly beats" is what a player can feel over many days: the median day, the log
		// return, the share of days in profit, the bad days, and finishing higher more often than
		// not. All-in's mean can still be higher (rare huge days), which no player feels.
		const [me, allIn, random] = finals.map(stats);
		const misses: string[] = [];
		for (const k of ['median', 'log', 'above', 'p10'] as const) {
			if (me[k] <= allIn[k]) misses.push(`All-in ${k}`);
			if (me[k] <= random[k]) misses.push(`Random ${k}`);
		}
		if (me.mean <= random.mean) misses.push('Random mean');
		if (beatsAllIn <= GAMES / 2) misses.push('All-in head-to-head');
		if (misses.length) lost.push(`${chart.name} / ${crowd.name}: ${misses.join(', ')}`);
	}
}

const scenarios = CHARTS.length * CROWDS.length;
console.log(`${scenarios} scenarios × ${GAMES.toLocaleString('en-US')} games, pooled:`);
const table = [
	['', 'mean', 'median', 'P10', '>$100', 'mean ln'],
	...PLAYERS.map((p, i) => {
		const s = stats(Float64Array.from(pooled[i]));
		return [p.name, money(s.mean), money(s.median), money(s.p10), pct(s.above), s.log.toFixed(3)];
	})
];
for (const [name, ...cells] of table) {
	console.log(name.padEnd(10) + cells.map((c) => c.padStart(9)).join(''));
}
console.log(
	`\nThoughtful clearly beats All-in and Random in ${scenarios - lost.length}/${scenarios} scenarios`
);
for (const l of lost) console.log(`  lost: ${l}`);
if (lost.length) process.exitCode = 1;
