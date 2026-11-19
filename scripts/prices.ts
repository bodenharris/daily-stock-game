// Daily price history, from Tiingo into the database in two steps, so a rate limit never leaves
// the database half-written:
//
//   node scripts/prices.ts fetch [TICKER...]  Tiingo → .cache/tiingo/<TICKER>.json
//   node scripts/prices.ts load [TICKER...]   .cache/tiingo → tickers, prices and splits
//
// Without tickers, `fetch` downloads every ticker in scripts/tickers.ts that isn't cached yet and
// `load` loads every cached file. Named tickers are always downloaded again, to refresh them.
// Fetching needs TIINGO_API_KEY in .env; the key only goes in the Authorization header.
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	renameSync,
	writeFileSync
} from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { eq } from 'drizzle-orm';
import { prices, splits, tickers } from '#lib/server/db/schema.ts';
import { db, excluded } from './db.ts';
import { splitAdjust, type TiingoBar } from './split.ts';
import { tickers as names } from './tickers.ts';

const CACHE = new URL('../.cache/tiingo/', import.meta.url);
const cacheFile = (ticker: string) => new URL(`${ticker}.json`, CACHE);

// Tiingo's free plan allows about 50 requests an hour and 1,000 a day. Pacing one request every
// 75 seconds stays under it; if the limit hits anyway, wait and try again, so a long run can be
// left alone. Resumable: cached tickers are skipped and files are written atomically.
const DELAY_MS = 75_000;
const RATE_LIMIT_WAIT_MS = 600_000;
const ERROR_RETRIES = 3;

const log = (message: string) =>
	console.log(`[${new Date().toISOString().slice(11, 19)}] ${message}`);

async function fetchTicker(ticker: string, key: string) {
	const url = `https://api.tiingo.com/tiingo/daily/${encodeURIComponent(ticker)}/prices?startDate=1980-01-01`;
	const res = await fetch(url, {
		headers: { Authorization: `Token ${key}` },
		signal: AbortSignal.timeout(60_000)
	});
	const body: unknown = await res.json().catch(() => null);
	// Tiingo reports errors, including running out of requests, as { detail } and not always
	// with a matching status code.
	const detail =
		body && typeof body === 'object' && 'detail' in body
			? String(body.detail).slice(0, 200)
			: `HTTP ${res.status}`;
	if (res.status === 429 || /allocation|rate limit|too many/i.test(detail)) {
		return { kind: 'rate-limited', detail } as const;
	}
	if (res.status === 404 || /not found/i.test(detail) || (Array.isArray(body) && !body.length)) {
		return { kind: 'not-found', detail } as const;
	}
	if (!res.ok || !Array.isArray(body)) return { kind: 'error', detail } as const;
	return { kind: 'ok', bars: body as TiingoBar[] } as const;
}

async function fetchAll(only: string[]) {
	const key = process.env.TIINGO_API_KEY?.trim();
	if (!key) throw new Error('TIINGO_API_KEY is not set (add it to .env)');
	mkdirSync(CACHE, { recursive: true });
	const todo = only.length ? only : Object.keys(names).filter((t) => !existsSync(cacheFile(t)));
	log(`${todo.length} to fetch, one every ${DELAY_MS / 1000}s.`);

	const failed: string[] = [];
	for (const [i, ticker] of todo.entries()) {
		const progress = `(${i + 1}/${todo.length}) ${ticker}`;
		for (let errors = 0; ;) {
			if (i > 0 || errors > 0) await sleep(DELAY_MS);
			const result = await fetchTicker(ticker, key).catch((e: Error) => ({
				kind: 'error' as const,
				detail: e.name
			}));
			if (result.kind === 'ok') {
				const tmp = new URL(`${ticker}.json.tmp`, CACHE);
				writeFileSync(tmp, JSON.stringify(result.bars));
				renameSync(tmp, cacheFile(ticker));
				const span = `${result.bars[0].date.slice(0, 10)} to ${result.bars.at(-1)!.date.slice(0, 10)}`;
				log(`${progress}: ${result.bars.length} bars, ${span}`);
				break;
			}
			if (result.kind === 'rate-limited') {
				log(
					`${progress}: rate limited (${result.detail}). Waiting ${RATE_LIMIT_WAIT_MS / 60_000} min.`
				);
				await sleep(RATE_LIMIT_WAIT_MS);
				continue;
			}
			if (result.kind === 'not-found' || ++errors > ERROR_RETRIES) {
				log(`${progress}: skipped (${result.detail}).`);
				failed.push(ticker);
				break;
			}
			log(`${progress}: ${result.detail}; retrying.`);
		}
	}
	if (failed.length) throw new Error(`Not fetched: ${failed.join(', ')}`);
	log('Done.');
}

// Postgres takes at most 65,535 parameters per statement: 5,000 rows × 7 columns stays under.
const CHUNK = 5000;

/** Replaces each ticker's bars and splits with its cached download. */
async function loadAll(only: string[]) {
	const list = only.length
		? only
		: readdirSync(CACHE)
				.filter((f) => f.endsWith('.json'))
				.map((f) => f.slice(0, -'.json'.length));
	let total = 0;
	for (const ticker of list) {
		const raw = JSON.parse(readFileSync(cacheFile(ticker), 'utf8')) as TiingoBar[];
		const rows = splitAdjust(ticker, raw);
		const splitRows = raw
			.filter((b) => b.splitFactor && b.splitFactor !== 1)
			.map((b) => ({ ticker, ts: b.date.slice(0, 10), factor: b.splitFactor! }));
		const chunks = Array.from({ length: Math.ceil(rows.length / CHUNK) }, (_, i) =>
			rows.slice(i * CHUNK, (i + 1) * CHUNK)
		);
		// A batch is one transaction, so a failure never leaves a ticker half-loaded.
		await db.batch([
			db
				.insert(tickers)
				.values({
					symbol: ticker,
					name: names[ticker] ?? ticker,
					firstDate: rows[0].ts,
					lastDate: rows.at(-1)!.ts,
					bars: rows.length
				})
				.onConflictDoUpdate({
					target: tickers.symbol,
					set: excluded(tickers, ['name', 'firstDate', 'lastDate', 'bars'])
				}),
			db.delete(prices).where(eq(prices.ticker, ticker)),
			db.delete(splits).where(eq(splits.ticker, ticker)),
			...chunks.map((chunk) => db.insert(prices).values(chunk)),
			...(splitRows.length ? [db.insert(splits).values(splitRows)] : [])
		]);
		total += rows.length;
		console.log(`${ticker}: ${rows.length} bars, ${rows[0].ts} to ${rows.at(-1)!.ts}`);
	}
	console.log(`Loaded ${total} bars for ${list.length} tickers`);
}

const [command, ...only] = process.argv.slice(2);
const symbols = only.map((t) => t.toUpperCase());
if (command === 'fetch') await fetchAll(symbols);
else if (command === 'load') await loadAll(symbols);
else {
	console.error('Usage: node scripts/prices.ts fetch | load [TICKER...]');
	process.exitCode = 1;
}
