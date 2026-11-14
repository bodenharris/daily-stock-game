import { describe, expect, it } from 'vitest';
import { nextSlug } from './schedule-order.ts';

const catalog = (n: number, prefix = 'p') => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

/** Schedule days 1..days, growing the history as the server would. */
function run(days: number, active: (day: number) => string[], secret = 's', start: string[] = []) {
	const history = [...start];
	for (let day = history.length + 1; day <= days; day++) {
		history.push(nextSlug(day, active(day), history, secret));
	}
	return history;
}

describe('nextSlug', () => {
	it('opens with the first catalog entry', () => {
		expect(nextSlug(1, catalog(30), [], 's')).toBe('p0');
	});

	it('plays every puzzle exactly once per pass', () => {
		const days = run(90, () => catalog(30));
		for (const pass of [0, 1, 2]) {
			expect(new Set(days.slice(pass * 30, pass * 30 + 30)).size).toBe(30);
		}
	});

	it('never repeats a puzzle on back-to-back days, even across passes', () => {
		const days = run(200, () => catalog(7));
		for (let i = 1; i < days.length; i++) expect(days[i]).not.toBe(days[i - 1]);
	});

	it('depends on the secret, so the repo alone does not give the order', () => {
		const a = run(30, () => catalog(30), 'one');
		const b = run(30, () => catalog(30), 'two');
		expect(a).not.toEqual(b);
		expect(a[0]).toBe(b[0]);
	});

	it('is stable for the same inputs and differs between passes', () => {
		expect(run(30, () => catalog(30))).toEqual(run(30, () => catalog(30)));
		const days = run(60, () => catalog(30));
		expect(days.slice(0, 30)).not.toEqual(days.slice(30, 60));
	});

	it('takes puzzles added mid-pass without repeating anything', () => {
		const grown = [...catalog(30), ...catalog(60, 'new')];
		// 10 days on the old catalog, then the catalog grows to 90.
		const days = run(90, (day) => (day <= 10 ? catalog(30) : grown));
		expect(new Set(days).size).toBe(90);
	});

	it('skips retired puzzles and never schedules them again', () => {
		const full = catalog(10);
		const smaller = full.filter((s) => s !== 'p3' && s !== 'p4');
		const days = run(30, (day) => (day <= 3 ? full : smaller));
		const later = days.slice(3);
		expect(later).not.toContain('p3');
		expect(later).not.toContain('p4');
		// The first pass still covers every remaining puzzle once.
		expect(new Set(days.slice(0, 8)).size).toBe(8);
	});

	it('works with a single puzzle', () => {
		expect(run(3, () => ['only'])).toEqual(['only', 'only', 'only']);
	});

	it('refuses an empty catalog', () => {
		expect(() => nextSlug(2, [], ['x'], 's')).toThrow();
	});
});
