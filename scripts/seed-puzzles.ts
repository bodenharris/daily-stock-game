/**
 * Upsert the puzzle catalog (src/lib/server/puzzles/catalog.ts) into the `puzzles` table.
 * Puzzles removed from the catalog are kept (games reference them) but parked at a negative
 * position so they are never scheduled again.
 *
 * Usage: node scripts/seed-puzzles.ts
 */
import { existsSync } from 'node:fs';
import postgres from 'postgres';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

type CatalogPuzzle = {
	slug: string;
	ticker: string;
	company: string;
	headline: string;
	story: string;
	lastContextDate: string;
	contextBars: number;
	stepBars: number;
	calls: number;
};

const mod = (await import('../src/lib/server/puzzles/catalog.ts')) as Record<string, unknown>;
const catalog = Object.values(mod).find(
	(v) => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && 'slug' in v[0]
) as CatalogPuzzle[] | undefined;
if (!catalog) throw new Error('No puzzle array exported from catalog.ts');

const sql = postgres(url, { max: 1, onnotice: () => {} });
await sql.begin(async (tx) => {
	const missing = await tx<{ symbol: string }[]>`
		select t.symbol from unnest(${catalog.map((p) => p.ticker)}::text[]) as t(symbol)
		where not exists (select 1 from tickers where tickers.symbol = t.symbol)`;
	if (missing.length) {
		throw new Error(
			`Load prices first, missing tickers: ${missing.map((m) => m.symbol).join(', ')}`
		);
	}
	// Free every position so the new order can be written without unique clashes.
	await tx`update puzzles set position = -1000000 - position where position >= 0`;
	for (const [i, p] of catalog.entries()) {
		await tx`
			insert into puzzles (slug, position, ticker, company, headline, story,
				last_context_date, context_bars, step_bars, calls)
			values (${p.slug}, ${i}, ${p.ticker}, ${p.company}, ${p.headline}, ${p.story},
				${p.lastContextDate}, ${p.contextBars}, ${p.stepBars}, ${p.calls})
			on conflict (slug) do update set
				position = excluded.position, ticker = excluded.ticker, company = excluded.company,
				headline = excluded.headline, story = excluded.story,
				last_context_date = excluded.last_context_date, context_bars = excluded.context_bars,
				step_bars = excluded.step_bars, calls = excluded.calls`;
	}
	// Anything still parked was dropped from the catalog: give it a stable negative slot.
	await tx`
		update puzzles p set position = -1 - s.rn
		from (select slug, row_number() over (order by slug) as rn from puzzles where position < 0) s
		where p.slug = s.slug`;
});
const [{ n }] = await sql<
	{ n: number }[]
>`select count(*)::int as n from puzzles where position >= 0`;
console.log(`seeded ${catalog.length} puzzles (${n} scheduled)`);
await sql.end();
