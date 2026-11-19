import { createHash } from 'node:crypto';

/**
 * The slug for daily puzzle `number`.
 *
 * `active` is the catalog in catalog order; `history` is the slugs already scheduled for earlier
 * numbers, oldest first. Every puzzle is played once before any repeats (a "pass"); within a pass
 * the next one is picked by a hash keyed with a server secret, so the order can't be read from
 * the repo. Because the pick only looks at what has been played, puzzles can be added or retired
 * at any time without a repeat or a skip. Number 1 opens with the first catalog entry (the launch
 * puzzle is chosen by hand), and a new pass never starts with the puzzle that ended the last one.
 */
export function nextSlug(
	number: number,
	active: string[],
	history: string[],
	secret: string
): string {
	if (active.length === 0) throw new Error('Empty catalog');
	if (number === 1 && history.length === 0) return active[0];

	const inCatalog = new Set(active);
	let pass = new Set<string>();
	for (const slug of history) {
		if (!inCatalog.has(slug)) continue; // retired puzzles don't count
		if (pass.has(slug)) pass = new Set();
		pass.add(slug);
		if (pass.size === active.length) pass = new Set();
	}
	let candidates = active.filter((s) => !pass.has(s));
	const previous = history.at(-1);
	if (pass.size === 0 && candidates.length > 1 && previous) {
		candidates = candidates.filter((s) => s !== previous);
	}

	const key = (slug: string) =>
		createHash('sha256').update(`${secret}:${number}:${slug}`).digest('hex');
	return candidates.reduce((best, s) => (key(s) < key(best) ? s : best));
}
