/**
 * Smoke test against a running server: the pages load, and nothing in the HTML an anonymous
 * visitor receives gives away today's puzzle (ticker, company, headline or any of its dates).
 *
 * Usage: node scripts/smoke.ts [base-url]   (default http://localhost:5173)
 */
import { existsSync } from 'node:fs';
import postgres from 'postgres';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const base = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '');
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

let failures = 0;
function check(ok: boolean, label: string) {
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
	if (!ok) failures++;
}

const pages: Record<string, string> = {};
for (const path of ['/', '/stats']) {
	const started = performance.now();
	const res = await fetch(base + path);
	pages[path] = await res.text();
	check(
		res.status === 200,
		`${path} → ${res.status} in ${Math.round(performance.now() - started)} ms`
	);
}

// Which puzzle is today's? The schedule row is written on the first view, which just happened.
const sql = postgres(url, { max: 1, onnotice: () => {} });
const [today] = await sql<
	{ slug: string; ticker: string; company: string; headline: string; last_context_date: string }[]
>`
	select p.slug, p.ticker, p.company, p.headline, p.last_context_date::text
	from schedule s join puzzles p on p.slug = s.slug
	order by s.created_at desc limit 1`;
await sql.end();
check(!!today, 'today is in the schedule');

if (today) {
	const secrets = [
		today.ticker,
		today.company,
		today.headline,
		today.slug,
		today.last_context_date
	];
	for (const [path, html] of Object.entries(pages)) {
		for (const secret of secrets) {
			// Match whole words only, so a short ticker like "GE" doesn't trip on ordinary text.
			const re = new RegExp(`\\b${secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
			check(!re.test(html), `${path} does not contain "${secret}"`);
		}
	}
}

if (failures) {
	console.error(`${failures} check(s) failed`);
	process.exit(1);
}
console.log('all good');
