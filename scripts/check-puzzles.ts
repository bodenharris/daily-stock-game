// Validates every puzzle in the private catalog (scripts/catalog.ts) against the cached Tiingo data
// (.cache/tiingo, filled by scripts/fetch-prices.ts) and prints the outcome of each call.
//
// Usage: node scripts/check-puzzles.ts [--verbose]
//
// Prices are split-adjusted only: raw close divided by the product of all later split factors.
// Call k compares the close at the end of stretch k with the close of the last bar visible
// before it. A step whose |move| is under MIN_MOVE_PCT counts as flat and fails the check.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadCatalog, type Puzzle } from './catalog.ts';

if (existsSync('.env')) process.loadEnvFile('.env');
const catalog = loadCatalog({ example: true });
const puzzles = catalog.puzzles;
if (catalog.isExample)
	console.log(`No private catalog: checking ${catalog.file}
`);

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE_DIR = path.join(ROOT, '.cache', 'tiingo');
const MIN_MOVE_PCT = 0.3;

type RawBar = { date: string; close: number; splitFactor?: number };
type Bar = { date: string; close: number };

const cache = new Map<string, Bar[]>();

function loadBars(ticker: string): Bar[] | null {
	if (cache.has(ticker)) return cache.get(ticker)!;
	const file = path.join(CACHE_DIR, `${ticker}.json`);
	if (!existsSync(file)) return null;
	const raw = JSON.parse(readFileSync(file, 'utf8')) as RawBar[];
	const bars: Bar[] = new Array(raw.length);
	let factor = 1;
	for (let i = raw.length - 1; i >= 0; i--) {
		bars[i] = { date: raw[i].date.slice(0, 10), close: raw[i].close / factor };
		const split = raw[i].splitFactor ?? 1;
		if (split > 0 && split !== 1) factor *= split;
	}
	cache.set(ticker, bars);
	return bars;
}

function pct(from: number, to: number) {
	return ((to - from) / from) * 100;
}

function fmtPct(n: number) {
	return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

type Result = {
	puzzle: Puzzle;
	index: number;
	errors: string[];
	contextMove?: number;
	moves: number[];
	start?: string;
	end?: string;
};

function check(puzzle: Puzzle, index: number): Result {
	const result: Result = { puzzle, index, errors: [], moves: [] };
	const { ticker, lastContextDate, contextBars, stepBars, calls } = puzzle;
	if (calls !== 5) result.errors.push(`calls must be 5, got ${calls}`);
	if (!Number.isInteger(stepBars) || stepBars < 1) result.errors.push('stepBars must be >= 1');
	if (!Number.isInteger(contextBars) || contextBars < 20) {
		result.errors.push('contextBars must be >= 20');
	}
	const bars = loadBars(ticker);
	if (!bars) {
		result.errors.push(`no cached data for ${ticker}`);
		return result;
	}
	const last = bars.findIndex((b) => b.date === lastContextDate);
	if (last < 0) {
		result.errors.push(`${lastContextDate} is not a trading day in ${ticker} data`);
		return result;
	}
	const first = last - contextBars + 1;
	const end = last + calls * stepBars;
	if (first < 0) result.errors.push(`only ${last + 1} bars before call 1`);
	if (end >= bars.length) result.errors.push(`only ${bars.length - 1 - last} bars after call 1`);
	if (result.errors.length) return result;

	result.start = bars[first].date;
	result.end = bars[end].date;
	result.contextMove = pct(bars[first].close, bars[last].close);
	for (let k = 1; k <= calls; k++) {
		const move = pct(bars[last + (k - 1) * stepBars].close, bars[last + k * stepBars].close);
		result.moves.push(move);
		if (Math.abs(move) < MIN_MOVE_PCT) {
			result.errors.push(`call ${k} is flat (${fmtPct(move)})`);
		}
	}
	return result;
}

function pad(s: string, n: number) {
	return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

function main() {
	const verbose = process.argv.includes('--verbose');
	const results = puzzles.map(check);

	const slugs = new Set<string>();
	for (const r of results) {
		if (slugs.has(r.puzzle.slug)) r.errors.push(`duplicate slug ${r.puzzle.slug}`);
		slugs.add(r.puzzle.slug);
	}

	console.log(
		`${pad('#', 3)} ${pad('ticker', 6)} ${pad('headline', 30)} ` +
			`${pad('step', 4)} ${pad('context', 8)} calls`
	);
	let ups = 0;
	let downs = 0;
	let errors = 0;
	let momentumWins = 0;
	let momentumCalls = 0;
	const callCountsByPosition = Array.from({ length: 5 }, () => ({ up: 0, down: 0 }));
	for (const r of results) {
		const p = r.puzzle;
		const head =
			`${pad(String(r.index + 1), 3)} ${pad(p.ticker, 6)} ` +
			`${pad(p.headline, 30)} ${pad(String(p.stepBars), 4)} ` +
			`${pad(r.contextMove === undefined ? '-' : fmtPct(r.contextMove), 8)}`;
		const calls = r.moves.map((m) => `${m >= 0 ? 'U' : 'D'} ${pad(fmtPct(m), 7)}`).join(' ');
		console.log(`${head} ${calls}`);
		if (verbose && r.start) console.log(`    ${r.start} .. ${p.lastContextDate} | .. ${r.end}`);
		for (const e of r.errors) console.log(`    ERROR: ${e}`);
		errors += r.errors.length;
		r.moves.forEach((m, k) => {
			if (m >= 0) {
				ups++;
				callCountsByPosition[k].up++;
			} else {
				downs++;
				callCountsByPosition[k].down++;
			}
			// "Momentum": call the same direction as the previous step (context trend for call 1).
			const prev = k === 0 ? (r.contextMove ?? 0) : r.moves[k - 1];
			momentumCalls++;
			if (Math.sign(prev) === Math.sign(m)) momentumWins++;
		});
	}

	const total = ups + downs;
	const share = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
	const allSame = results.filter(
		(r) => r.moves.length === 5 && (r.moves.every((m) => m >= 0) || r.moves.every((m) => m < 0))
	);
	const mostlyDown = results.filter((r) => r.moves.filter((m) => m < 0).length >= 4);
	const mostlyUp = results.filter((r) => r.moves.filter((m) => m >= 0).length >= 4);
	console.log('');
	console.log(`Puzzles: ${results.length}, calls: ${total}`);
	console.log(`Up: ${ups} (${share(ups)}), down: ${downs} (${share(downs)})`);
	console.log(
		`Always-up wins ${share(ups)}, always-down wins ${share(downs)}, ` +
			`momentum wins ${((momentumWins / momentumCalls) * 100).toFixed(1)}%`
	);
	console.log(
		'By call position (up/down): ' +
			callCountsByPosition.map((c, k) => `#${k + 1} ${c.up}/${c.down}`).join(', ')
	);
	console.log(
		`All five the same: ${allSame.length}, 4+ down: ${mostlyDown.length}, 4+ up: ${mostlyUp.length}`
	);
	const steps = new Map<number, number>();
	for (const p of puzzles) steps.set(p.stepBars, (steps.get(p.stepBars) ?? 0) + 1);
	console.log(
		'Stretch lengths: ' +
			[...steps.entries()]
				.sort((a, b) => a[0] - b[0])
				.map(([s, n]) => `${s}d x${n}`)
				.join(', ')
	);
	if (errors) {
		console.log(`\n${errors} error(s).`);
		process.exitCode = 1;
	} else {
		console.log('\nAll puzzles valid.');
	}
}

main();
