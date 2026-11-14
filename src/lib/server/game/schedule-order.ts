import { createHash } from 'node:crypto';

/**
 * The slug for daily puzzle `number`, given the active catalog in catalog order.
 * Each pass through the catalog is a fresh shuffle keyed by a server secret, so the order can't
 * be read from the public repo and repeats aren't in the same order. The first catalog entry
 * opens day #1 (the launch puzzle is chosen by hand).
 */
export function slugForNumber(number: number, catalog: string[], secret: string): string {
	if (catalog.length === 0) throw new Error('Empty catalog');
	const cycle = Math.floor((number - 1) / catalog.length);
	const index = (number - 1) % catalog.length;
	const key = (slug: string) =>
		createHash('sha256').update(`${secret}:${cycle}:${slug}`).digest('hex');
	const pinned = cycle === 0 ? catalog.slice(0, 1) : [];
	const rest = catalog
		.filter((s) => !pinned.includes(s))
		.map((slug) => ({ slug, k: key(slug) }))
		.sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
		.map((x) => x.slug);
	return [...pinned, ...rest][index];
}
