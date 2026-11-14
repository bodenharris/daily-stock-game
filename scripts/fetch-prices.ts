// Downloads full daily price history for every ticker in scripts/tickers.ts from Tiingo and
// saves each raw JSON response to .cache/tiingo/<TICKER>.json. Nothing else reads Tiingo.
//
// Usage:
//   node scripts/fetch-prices.ts                     all tickers, in priority order
//   node scripts/fetch-prices.ts --only=AAPL,MSFT    just these, in this order
//   node scripts/fetch-prices.ts --puzzles           only the puzzle tickers
//
// Options:
//   --delay=75        seconds between requests (free plan: ~50 requests/hour, 1000/day)
//   --wait=600        seconds to wait after hitting the rate limit before retrying
//   --max-requests=N  stop after N requests this run
//   --force           re-download tickers that are already cached
//
// Resumable: cached tickers are skipped, files are written atomically, and a rate limit just
// pauses the run, so it can be left running unattended. The API key is read from .env
// (TIINGO_API_KEY), sent only in the Authorization header, and never printed.

import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { puzzleTickers, tickers } from './tickers.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE_DIR = path.join(ROOT, '.cache', 'tiingo');
const START_DATE = '1980-01-01';
const MAX_RATE_LIMIT_RETRIES = 24;
const MAX_ERROR_RETRIES = 3;

type Args = {
	only: string[] | null;
	puzzles: boolean;
	delay: number;
	wait: number;
	maxRequests: number;
	force: boolean;
};

function parseArgs(argv: string[]): Args {
	const args: Args = {
		only: null,
		puzzles: false,
		delay: 75,
		wait: 600,
		maxRequests: Infinity,
		force: false
	};
	for (const arg of argv) {
		const [key, value] = arg.split('=', 2);
		const num = () => {
			const n = Number(value);
			if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid number for ${key}`);
			return n;
		};
		switch (key) {
			case '--only':
				args.only = (value ?? '')
					.split(',')
					.map((t) => t.trim().toUpperCase())
					.filter(Boolean);
				break;
			case '--puzzles':
				args.puzzles = true;
				break;
			case '--delay':
				args.delay = num();
				break;
			case '--wait':
				args.wait = num();
				break;
			case '--max-requests':
				args.maxRequests = num();
				break;
			case '--force':
				args.force = true;
				break;
			default:
				throw new Error(`Unknown argument: ${arg}`);
		}
	}
	return args;
}

function loadApiKey(): string {
	try {
		process.loadEnvFile(path.join(ROOT, '.env'));
	} catch {
		// No .env file: fall back to the process environment.
	}
	const key = process.env.TIINGO_API_KEY?.trim();
	if (!key) throw new Error('TIINGO_API_KEY is not set (add it to .env).');
	return key;
}

function cachePath(ticker: string) {
	return path.join(CACHE_DIR, `${ticker}.json`);
}

function log(message: string) {
	console.log(`[${new Date().toISOString().slice(11, 19)}] ${message}`);
}

type FetchResult =
	| { kind: 'ok'; bars: unknown[] }
	| { kind: 'rate-limited'; detail: string }
	| { kind: 'not-found'; detail: string }
	| { kind: 'error'; detail: string };

async function fetchTicker(ticker: string, apiKey: string): Promise<FetchResult> {
	const url = `https://api.tiingo.com/tiingo/daily/${encodeURIComponent(ticker)}/prices?startDate=${START_DATE}`;
	let res: Response;
	try {
		res = await fetch(url, {
			headers: { 'Content-Type': 'application/json', Authorization: `Token ${apiKey}` },
			signal: AbortSignal.timeout(60_000)
		});
	} catch (err) {
		return { kind: 'error', detail: err instanceof Error ? err.name : 'network error' };
	}
	const text = await res.text();
	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		body = null;
	}
	const detail =
		body && typeof body === 'object' && 'detail' in body
			? String((body as { detail: unknown }).detail).slice(0, 200)
			: `HTTP ${res.status}`;

	if (res.status === 429 || /allocation|rate limit|too many/i.test(detail)) {
		return { kind: 'rate-limited', detail };
	}
	if (res.status === 404 || /not found/i.test(detail)) return { kind: 'not-found', detail };
	if (!res.ok) return { kind: 'error', detail: `HTTP ${res.status}: ${detail}` };
	if (!Array.isArray(body)) return { kind: 'error', detail: `Unexpected response: ${detail}` };
	if (body.length === 0) return { kind: 'not-found', detail: 'No price data returned' };
	return { kind: 'ok', bars: body };
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const apiKey = loadApiKey();
	mkdirSync(CACHE_DIR, { recursive: true });

	const list = args.only ?? (args.puzzles ? puzzleTickers : tickers).map((t) => t.ticker);
	const todo = list.filter((t) => args.force || !existsSync(cachePath(t)));
	log(
		`${list.length} tickers, ${list.length - todo.length} already cached, ${todo.length} to fetch.`
	);
	if (todo.length) {
		const minutes = Math.ceil(((todo.length - 1) * args.delay) / 60);
		log(
			`Pacing one request every ${args.delay}s (about ${minutes} min, plus any rate-limit waits).`
		);
	}

	const failed: string[] = [];
	let requests = 0;
	let lastRequestAt = 0;

	for (const [i, ticker] of todo.entries()) {
		let rateLimitRetries = 0;
		let errorRetries = 0;
		while (true) {
			if (requests >= args.maxRequests) {
				log(`Reached --max-requests=${args.maxRequests}; stopping. Re-run to continue.`);
				return report(failed, todo.length - i);
			}
			const waitMs = lastRequestAt + args.delay * 1000 - Date.now();
			if (waitMs > 0) await sleep(waitMs);
			lastRequestAt = Date.now();
			requests++;

			const result = await fetchTicker(ticker, apiKey);
			const progress = `(${i + 1}/${todo.length})`;
			if (result.kind === 'ok') {
				const file = cachePath(ticker);
				writeFileSync(`${file}.tmp`, JSON.stringify(result.bars));
				renameSync(`${file}.tmp`, file);
				const first = (result.bars[0] as { date?: string }).date?.slice(0, 10);
				const last = (result.bars.at(-1) as { date?: string }).date?.slice(0, 10);
				log(`${progress} ${ticker}: ${result.bars.length} bars, ${first} to ${last}`);
				break;
			}
			if (result.kind === 'not-found') {
				log(`${progress} ${ticker}: not available on Tiingo (${result.detail}); skipping.`);
				failed.push(ticker);
				break;
			}
			if (result.kind === 'rate-limited') {
				if (++rateLimitRetries > MAX_RATE_LIMIT_RETRIES) {
					log(`${progress} ${ticker}: still rate limited after many retries; stopping.`);
					return report(failed, todo.length - i);
				}
				log(`${progress} ${ticker}: rate limited (${result.detail}). Waiting ${args.wait}s.`);
				await sleep(args.wait * 1000);
				continue;
			}
			if (++errorRetries > MAX_ERROR_RETRIES) {
				log(`${progress} ${ticker}: failed (${result.detail}); skipping.`);
				failed.push(ticker);
				break;
			}
			log(`${progress} ${ticker}: ${result.detail}; retrying.`);
			await sleep(30_000 * errorRetries);
		}
	}
	report(failed, 0);
}

function report(failed: string[], remaining: number) {
	if (failed.length) log(`Not fetched: ${failed.join(', ')}`);
	if (remaining) log(`${remaining} tickers left; re-run the same command to resume.`);
	else log('Done.');
	if (failed.length || remaining) process.exitCode = 1;
}

main().catch((err: unknown) => {
	console.error(err instanceof Error ? err.message : 'Unexpected error');
	process.exitCode = 1;
});
