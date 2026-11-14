// The puzzle catalog: which chart, which window, and the story told at the reveal.
//
// The real catalog holds every answer, so it is kept out of the public repo, in
// `private/catalog.json` (git-ignored; override the path with PUZZLE_CATALOG). The shared
// database is where it lives for the team: `node scripts/export-catalog.ts` writes it from
// there, and `node scripts/seed-puzzles.ts` writes it back. `scripts/catalog.example.json` shows
// the format with three puzzles that were public before the catalog went private.
//
// The player sees `contextBars` daily bars ending at `lastContextDate`, then makes `calls`
// up/down calls. Each call reveals the next `stepBars` trading days and is scored on the close
// at the end of that stretch versus the close of the last bar visible before it.
//
// `ticker` is the Tiingo symbol we store prices under. Delisted companies keep their
// post-delisting Tiingo symbol (BBBYQ for Bed Bath & Beyond, which traded as BBBY in 2022).

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type Puzzle = {
	/** Stable id, the database key. Never change it once a puzzle has shipped. */
	slug: string;
	/** Tiingo symbol the prices are stored under. */
	ticker: string;
	/** Display name shown at the reveal. */
	company: string;
	/** Short title of the market moment, shown at the reveal. */
	headline: string;
	/** One or two plain sentences about what happened, shown at the reveal. */
	story: string;
	/** ISO date (YYYY-MM-DD) of the last bar visible before call 1. */
	lastContextDate: string;
	/** Number of bars visible before call 1, ending at lastContextDate. */
	contextBars: number;
	/** Trading days revealed by each call. */
	stepBars: number;
	/** Number of up/down calls. */
	calls: number;
};

const ROOT = path.resolve(import.meta.dirname, '..');
/** Read when called, so a PUZZLE_CATALOG set in .env (loaded by the script) is honoured. */
export function catalogPath(): string {
	return process.env.PUZZLE_CATALOG
		? path.resolve(process.env.PUZZLE_CATALOG)
		: path.join(ROOT, 'private', 'catalog.json');
}
export const EXAMPLE_PATH = path.join(ROOT, 'scripts', 'catalog.example.json');

const FIELDS: (keyof Puzzle)[] = [
	'slug',
	'ticker',
	'company',
	'headline',
	'story',
	'lastContextDate',
	'contextBars',
	'stepBars',
	'calls'
];

function parse(file: string): Puzzle[] {
	const data = JSON.parse(readFileSync(file, 'utf8')) as unknown;
	if (!Array.isArray(data)) throw new Error(`${file}: expected an array of puzzles`);
	for (const [i, p] of data.entries()) {
		for (const f of FIELDS) {
			if (p?.[f] === undefined) throw new Error(`${file}: puzzle ${i + 1} has no ${f}`);
		}
	}
	return data as Puzzle[];
}

/**
 * The real catalog. With `{ example: true }` it falls back to the public example when the
 * private file is missing (for checking the format on a fresh clone); seeding never does.
 */
export function loadCatalog(opts: { example?: boolean } = {}): {
	puzzles: Puzzle[];
	file: string;
	isExample: boolean;
} {
	const file = catalogPath();
	if (existsSync(file)) return { puzzles: parse(file), file, isExample: false };
	if (opts.example) return { puzzles: parse(EXAMPLE_PATH), file: EXAMPLE_PATH, isExample: true };
	throw new Error(
		`No puzzle catalog at ${file}. Pull it from the shared database with ` +
			'`node scripts/export-catalog.ts`.'
	);
}
