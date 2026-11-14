/**
 * Load cached Tiingo downloads (.cache/tiingo/<TICKER>.json) into the `prices` hypertable.
 *
 * Prices are split-adjusted only: each raw bar is divided by the product of every split
 * that happened after it, so old bars line up with today's share count but keep the
 * quotes people remember (no dividend adjustment).
 *
 * Usage: node scripts/ingest-prices.ts [--only=AAPL,MSFT] [--no-compress]
 * Safe to re-run: rows are upserted.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { splitAdjust, type TiingoBar } from '../src/lib/server/prices/split.ts';

const CACHE_DIR = join('.cache', 'tiingo');

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const args = new Map(
	process.argv.slice(2).map((a) => {
		const [k, v] = a.replace(/^--/, '').split('=');
		return [k, v ?? 'true'] as const;
	})
);
const only = args
	.get('only')
	?.split(',')
	.map((s) => s.trim().toUpperCase());

async function loadNames(): Promise<Map<string, string>> {
	try {
		const mod = (await import('./tickers.ts')) as Record<string, unknown>;
		const list = Object.values(mod).find(Array.isArray) as
			{ symbol?: string; ticker?: string; name?: string; company?: string }[] | undefined;
		return new Map(
			(list ?? []).map((t) => [
				String(t.symbol ?? t.ticker).toUpperCase(),
				String(t.name ?? t.company ?? t.symbol ?? t.ticker)
			])
		);
	} catch {
		return new Map();
	}
}

async function main() {
	const sql = postgres(url!, { max: 4, onnotice: () => {} });
	const names = await loadNames();
	const files = readdirSync(CACHE_DIR).filter(
		(f) => f.endsWith('.json') && !f.endsWith('.meta.json')
	);
	let total = 0;
	for (const file of files) {
		const ticker = file.replace(/\.json$/, '').toUpperCase();
		if (only && !only.includes(ticker)) continue;
		const raw = JSON.parse(readFileSync(join(CACHE_DIR, file), 'utf8')) as TiingoBar[];
		if (!Array.isArray(raw) || raw.length === 0) {
			console.log(`${ticker}: empty, skipped`);
			continue;
		}
		const rows = splitAdjust(ticker, raw);
		const first = rows[0].ts;
		const last = rows[rows.length - 1].ts;
		await sql.begin(async (tx) => {
			await tx`
				insert into tickers (symbol, name, first_date, last_date, bars)
				values (${ticker}, ${names.get(ticker) ?? ticker}, ${first}, ${last}, ${rows.length})
				on conflict (symbol) do update set
					name = excluded.name,
					first_date = excluded.first_date,
					last_date = excluded.last_date,
					bars = excluded.bars`;
			for (let i = 0; i < rows.length; i += 4000) {
				const batch = rows.slice(i, i + 4000);
				await tx`
					insert into prices ${tx(batch, 'ticker', 'ts', 'open', 'high', 'low', 'close', 'volume')}
					on conflict (ticker, ts) do update set
						open = excluded.open,
						high = excluded.high,
						low = excluded.low,
						close = excluded.close,
						volume = excluded.volume`;
			}
		});
		total += rows.length;
		console.log(`${ticker}: ${rows.length} bars (${first} → ${last})`);
	}

	if (args.get('no-compress') !== 'true') {
		const compressed = await sql`
			select count(*)::int as n from (
				select compress_chunk(c, if_not_compressed => true)
				from show_chunks('prices', older_than => interval '60 days') c
			) s`;
		console.log(`compressed chunks touched: ${compressed[0].n}`);
	}
	console.log(`done: ${total} bars from ${files.length} files`);
	await sql.end();
}

if (import.meta.main) await main();
