/**
 * Write the puzzle catalog from the shared database to private/catalog.json (git-ignored), in
 * play-pool order. Retired puzzles (negative positions) are left out. Refuses to overwrite a
 * local catalog that has puzzles the database doesn't, unless --force.
 *
 * Usage: node scripts/export-catalog.ts [--force]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { catalogPath, type Puzzle } from './catalog.ts';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const sql = postgres(url, { max: 1, onnotice: () => {} });
const rows = await sql<
	{
		slug: string;
		ticker: string;
		company: string;
		headline: string;
		story: string;
		last_context_date: string;
		context_bars: number;
		step_bars: number;
		calls: number;
	}[]
>`
	select slug, ticker, company, headline, story, last_context_date::text, context_bars,
		step_bars, calls
	from puzzles where position >= 0 order by position`;
await sql.end();

const puzzles: Puzzle[] = rows.map((r) => ({
	slug: r.slug,
	ticker: r.ticker,
	company: r.company,
	headline: r.headline,
	story: r.story,
	lastContextDate: r.last_context_date,
	contextBars: r.context_bars,
	stepBars: r.step_bars,
	calls: r.calls
}));

const CATALOG_PATH = catalogPath();
if (existsSync(CATALOG_PATH) && !process.argv.includes('--force')) {
	const local = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as Puzzle[];
	const inDb = new Set(puzzles.map((p) => p.slug));
	const onlyLocal = local.filter((p) => !inDb.has(p.slug)).map((p) => p.slug);
	if (onlyLocal.length) {
		console.error(
			`Not overwriting ${CATALOG_PATH}: it has puzzles the database doesn't ` +
				`(${onlyLocal.join(', ')}). Seed them first, or pass --force.`
		);
		process.exit(1);
	}
}

mkdirSync(path.dirname(CATALOG_PATH), { recursive: true });
writeFileSync(CATALOG_PATH, JSON.stringify(puzzles, null, '\t') + '\n');
console.log(`wrote ${puzzles.length} puzzles to ${path.relative(process.cwd(), CATALOG_PATH)}`);
