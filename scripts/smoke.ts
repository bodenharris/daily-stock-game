// Smoke test against a running server that uses the same database: the pages load, and nothing in
// what an anonymous visitor receives (the HTML, including the remote query results it carries)
// gives away today's or yesterday's puzzle: ticker, company, headline, slug or its last date.
//
//   node scripts/smoke.ts [base-url]   (default http://localhost:5173)
import { desc, eq, inArray } from 'drizzle-orm';
import { puzzleNumberFor } from '#lib/game/daily.ts';
import { puzzles, schedule } from '#lib/server/db/schema.ts';
import { db } from './db.ts';

const base = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '');
const today = puzzleNumberFor(new Date());
const days = today > 1 ? [today, today - 1] : [today];

const ENTITIES: Record<string, string> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#39;': "'",
	'&#x27;': "'"
};

let failures = 0;
function check(ok: boolean, label: string) {
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
	if (!ok) failures++;
}

// Fetched first: the first view of a day is what writes its schedule entry.
const pages = new Map<string, string>();
for (const path of ['/', '/stats', '/archive', ...days.slice(1).map((n) => `/day/${n}`)]) {
	const started = performance.now();
	const res = await fetch(base + path);
	const html = await res.text();
	check(res.ok, `${path} → ${res.status} in ${Math.round(performance.now() - started)} ms`);
	// Search the text as a reader sees it, not as the markup escapes it.
	pages.set(
		path,
		html.replace(/&(amp|lt|gt|quot|#39|#x27);/g, (e) => ENTITIES[e])
	);
}

const scheduled = await db
	.select({ number: schedule.number, puzzle: puzzles })
	.from(schedule)
	.innerJoin(puzzles, eq(schedule.slug, puzzles.slug))
	.where(inArray(schedule.number, days))
	.orderBy(desc(schedule.number));
check(
	scheduled.some((s) => s.number === today),
	`#${today} (today) is in the schedule`
);

for (const { number, puzzle: p } of scheduled) {
	// The ticker only as a quoted string: a bare "C" or "T" turns up in any SVG path.
	const secrets = {
		ticker: `"${p.ticker}"`,
		company: p.company,
		headline: p.headline,
		slug: p.slug,
		date: p.lastContextDate
	};
	for (const [path, html] of pages) {
		// Names what leaked, never the value, so a failing run spoils nothing either.
		const leaked = Object.entries(secrets)
			.filter(([, secret]) => html.includes(secret))
			.map(([name]) => name);
		check(
			!leaked.length,
			`${path} gives nothing away about #${number}${leaked.length ? ` (${leaked.join(', ')})` : ''}`
		);
	}
}

if (failures) {
	console.error(`${failures} check(s) failed`);
	process.exitCode = 1;
} else {
	console.log('All good.');
}
