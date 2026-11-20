// The puzzle catalog: which chart, which window, and the story told at the reveal.
//
//   node scripts/catalog.ts export          database → private/catalog.json
//   node scripts/catalog.ts check           checks the file against the prices in the database
//   node scripts/catalog.ts seed [--retire] private/catalog.json → database
//
// The catalog holds every answer, so it stays out of the public repo: it lives in the database
// and in the git-ignored private/catalog.json. scripts/catalog.example.json shows the format with
// three puzzles that were public before the catalog went private; `check` falls back to it.
//
// A puzzle shows `contextBars` daily bars ending at `lastContextDate`, then `calls` up/down calls.
// Each call reveals the next `stepBars` trading days and is scored on the close at the end of
// that stretch against the close before it. `slug` is the database key: never change it once a
// puzzle has shipped. `ticker` is the Tiingo symbol (see scripts/tickers.ts).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { asc, getTableColumns, gte, inArray, sql } from 'drizzle-orm';
import * as v from 'valibot';
import { CALLS_PER_GAME } from '#lib/game/config.ts';
import { puzzles, tickers } from '#lib/server/db/schema.ts';
import { db, excluded } from './db.ts';

const CATALOG = new URL('../private/catalog.json', import.meta.url);
const EXAMPLE = new URL('./catalog.example.json', import.meta.url);

/** A stretch that moves less than this (in percent) reads as flat on the chart. */
const MIN_MOVE_PCT = 0.3;

const atLeast = (n: number) => v.pipe(v.number(), v.integer(), v.minValue(n));
const Catalog = v.array(
  v.strictObject({
    slug: v.string(),
    ticker: v.string(),
    company: v.string(),
    headline: v.string(),
    story: v.string(),
    lastContextDate: v.pipe(v.string(), v.isoDate()),
    contextBars: atLeast(20),
    stepBars: atLeast(1),
    calls: v.literal(CALLS_PER_GAME),
  }),
);
type Puzzle = v.InferOutput<typeof Catalog>[number];

function read(file: URL): Puzzle[] {
  const result = v.safeParse(Catalog, JSON.parse(readFileSync(file, 'utf8')));
  if (!result.success) throw new Error(`${fileURLToPath(file)}:\n${v.summarize(result.issues)}`);
  return result.output;
}

/** Writes the puzzles in play, in catalog order. Refuses to drop puzzles not yet seeded. */
async function exportCatalog() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- every column but position
  const { position, ...columns } = getTableColumns(puzzles);
  const rows = await db
    .select(columns)
    .from(puzzles)
    .where(gte(puzzles.position, 0))
    .orderBy(asc(puzzles.position));
  if (existsSync(CATALOG)) {
    const inDb = new Set(rows.map((p) => p.slug));
    const onlyLocal = read(CATALOG).filter((p) => !inDb.has(p.slug));
    if (onlyLocal.length) {
      throw new Error(
        `Not overwriting private/catalog.json: the database doesn't have ` +
          `${onlyLocal.map((p) => p.slug).join(', ')}. Seed first, or move the file away.`,
      );
    }
  }
  mkdirSync(new URL('.', CATALOG), { recursive: true });
  writeFileSync(CATALOG, JSON.stringify(rows, null, '\t') + '\n');
  console.log(`Wrote ${rows.length} puzzles to private/catalog.json`);
}

/**
 * Upserts the catalog in order. Puzzles missing from it stay in the table (games and the schedule
 * reference them) but get a negative position, so they are never scheduled again. That only
 * happens with --retire, so a stale or partial file can't quietly pull puzzles out of play.
 */
async function seed(retire: boolean) {
  const catalog = read(CATALOG);
  if (catalog.length === 0) throw new Error('The catalog is empty');
  const symbols = [...new Set(catalog.map((p) => p.ticker))];
  const [known, inPlay] = await Promise.all([
    db.select({ symbol: tickers.symbol }).from(tickers).where(inArray(tickers.symbol, symbols)),
    db.select({ slug: puzzles.slug }).from(puzzles).where(gte(puzzles.position, 0)),
  ]);
  const loaded = new Set(known.map((t) => t.symbol));
  const missing = symbols.filter((t) => !loaded.has(t));
  if (missing.length) throw new Error(`Load prices first, missing tickers: ${missing.join(', ')}`);
  const slugs = new Set(catalog.map((p) => p.slug));
  const dropped = inPlay.filter((p) => !slugs.has(p.slug)).map((p) => p.slug);
  if (dropped.length && !retire) {
    throw new Error(
      `The catalog is missing ${dropped.length} puzzle(s) in play: ${dropped.join(', ')}. ` +
        'Export first, or pass --retire.',
    );
  }

  // Positions are unique and checked row by row, so every row is first moved out of the way
  // (into a range no current position can be in), then the catalog takes 0..n-1, then whatever
  // is left over gets a stable negative slot.
  await db.batch([
    db.update(puzzles).set({ position: sql`-1000000 - ${puzzles.position}` }),
    db
      .insert(puzzles)
      .values(catalog.map((p, position) => ({ ...p, position })))
      .onConflictDoUpdate({
        target: puzzles.slug,
        set: excluded(puzzles, [
          'position',
          'ticker',
          'company',
          'headline',
          'story',
          'lastContextDate',
          'contextBars',
          'stepBars',
          'calls',
        ]),
      }),
    db.execute(sql`
			update puzzles p set position = -s.rn
			from (select slug, row_number() over (order by slug) as rn from puzzles where position < 0) s
			where p.slug = s.slug`),
  ]);
  console.log(
    `Seeded ${catalog.length} puzzles` + (dropped.length ? `, retired ${dropped.join(', ')}` : ''),
  );
}

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);

/**
 * Loads each puzzle's window the way the game does (the last `contextBars` closes up to
 * `lastContextDate`, then `calls × stepBars` after it) and prints every call's move, plus how the
 * calls balance out over the catalog, so "always call down" can't win.
 */
async function check() {
  const file = existsSync(CATALOG) ? CATALOG : EXAMPLE;
  if (file === EXAMPLE) console.log('No private/catalog.json: checking the example\n');
  const catalog = read(file);
  const { rows } = await db.execute<{ slug: string; dates: string[]; closes: number[] }>(sql`
		select c.slug, w.dates, w.closes
		from json_to_recordset(${JSON.stringify(catalog)}::json) as c(
			slug text, ticker text, "lastContextDate" date, "contextBars" int, "stepBars" int, calls int)
		cross join lateral (
			select coalesce(array_agg(ts::text order by ts), '{}') as dates,
				coalesce(array_agg(close order by ts), '{}') as closes
			from (
				(select ts, close from prices
					where ticker = c.ticker and ts <= c."lastContextDate"
					order by ts desc limit c."contextBars")
				union all
				(select ts, close from prices
					where ticker = c.ticker and ts > c."lastContextDate"
					order by ts limit c."stepBars" * c.calls)
			) w
		) w`);
  const windows = new Map(rows.map((r) => [r.slug, r]));

  let errors = 0;
  const byCall = Array.from({ length: CALLS_PER_GAME }, () => ({ up: 0, down: 0 }));
  let momentum = 0;
  let allSame = 0;
  const steps = new Map<number, number>();
  const seen = new Set<string>();
  console.log(`${pad('#', 3)} ${pad('ticker', 6)} ${pad('headline', 30)} step context  calls`);
  for (const [i, p] of catalog.entries()) {
    const problems: string[] = [];
    if (seen.has(p.slug)) problems.push(`duplicate slug ${p.slug}`);
    seen.add(p.slug);
    steps.set(p.stepBars, (steps.get(p.stepBars) ?? 0) + 1);

    const { dates, closes } = windows.get(p.slug)!;
    const before = dates.filter((d) => d <= p.lastContextDate).length;
    const last = p.contextBars - 1;
    const moves: number[] = [];
    if (dates[before - 1] !== p.lastContextDate) {
      problems.push(`${p.lastContextDate} is not a trading day in the ${p.ticker} prices`);
    } else if (before < p.contextBars) {
      problems.push(`only ${before} bars before call 1`);
    } else if (dates.length - before < p.calls * p.stepBars) {
      problems.push(`only ${dates.length - before} bars after call 1`);
    } else {
      for (let k = 0; k < p.calls; k++) {
        const from = closes[last + k * p.stepBars];
        moves.push(((closes[last + (k + 1) * p.stepBars] - from) / from) * 100);
      }
    }
    const context = moves.length ? ((closes[last] - closes[0]) / closes[0]) * 100 : 0;
    for (const [k, m] of moves.entries()) {
      if (Math.abs(m) < MIN_MOVE_PCT) problems.push(`call ${k + 1} is flat (${pct(m)})`);
      byCall[k][m > 0 ? 'up' : 'down']++;
      // Momentum: the same way as the stretch before (the context for call 1).
      if (Math.sign(k === 0 ? context : moves[k - 1]) === Math.sign(m)) momentum++;
    }
    if (moves.length && new Set(moves.map((m) => m > 0)).size === 1) allSame++;

    const calls = moves.map((m) => `${m > 0 ? 'U' : 'D'} ${pct(m).padEnd(7)}`).join(' ');
    console.log(
      `${pad(String(i + 1), 3)} ${pad(p.ticker, 6)} ${pad(p.headline, 30)} ` +
        `${pad(String(p.stepBars), 4)} ${pad(moves.length ? pct(context) : '-', 8)} ${calls}`,
    );
    for (const problem of problems) console.log(`    ERROR: ${problem}`);
    errors += problems.length;
  }

  const ups = byCall.reduce((n, c) => n + c.up, 0);
  const total = ups + byCall.reduce((n, c) => n + c.down, 0);
  const share = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
  console.log(`
Puzzles: ${catalog.length}, calls: ${total}
Always up wins ${share(ups)}, always down ${share(total - ups)}, momentum ${share(momentum)}
By call (up/down): ${byCall.map((c, k) => `#${k + 1} ${c.up}/${c.down}`).join(', ')}
All five the same way: ${allSame}
Stretch lengths: ${[...steps]
    .sort(([a], [b]) => a - b)
    .map(([s, n]) => `${s}d ×${n}`)
    .join(', ')}`);
  if (errors) throw new Error(`${errors} error(s)`);
  console.log('All puzzles valid.');
}

const [command, ...flags] = process.argv.slice(2);
if (command === 'export') await exportCatalog();
else if (command === 'check') await check();
else if (command === 'seed') {
  // A puzzle short of prices would break its day for everyone, so never seed an unchecked catalog.
  await check();
  await seed(flags.includes('--retire'));
} else {
  console.error('Usage: node scripts/catalog.ts export | check | seed [--retire]');
  process.exitCode = 1;
}
