import { START_BALANCE_CENTS } from '#lib/game/config.ts';

/** Width of the finish buckets the server sends (the curve smooths over them). */
export const FINISH_BUCKET_CENTS = 1_000;
/** Finishes at or above this land in one last bucket, so a wild outlier can't stretch the axis. */
export const FINISH_CAP_CENTS = 100_000;

/** Finishes in one bucket: `cents` is its lower edge; the FINISH_CAP_CENTS bucket is open-ended. */
export interface FinishBucket {
	cents: number;
	count: number;
}

/**
 * The day's range split into round-width groups ($10, $20, $25, $50 …): they set where the
 * axis ends. Widths are tried narrowest first; the first that fits the range in `maxGroups`
 * wins. `mine` is the viewer's group (-1 if they have no finish).
 */
export function groupFinishes(finishes: FinishBucket[], you: number | null, maxGroups = 16) {
	const WIDTHS = [1_000, 2_000, 2_500, 5_000, 10_000, 20_000, 25_000, 50_000];
	const top = Math.max(0, ...finishes.map((f) => f.cents));
	const capped = top >= FINISH_CAP_CENTS;
	// Always reach past the start, so the start line has room on both sides.
	const end = Math.max(top + 1, START_BALANCE_CENTS * 2);
	const width = WIDTHS.find((w) => Math.ceil(end / w) <= maxGroups) ?? WIDTHS.at(-1)!;
	const n = Math.ceil(end / width);
	const groups = Array.from({ length: n }, (_, i) => ({
		from: i * width,
		to: (i + 1) * width,
		count: 0,
		open: capped && i === n - 1
	}));
	for (const f of finishes) groups[Math.min(n - 1, Math.floor(f.cents / width))].count += f.count;
	const mine =
		you == null ? -1 : Math.min(n - 1, Math.floor(Math.min(you, FINISH_CAP_CENTS) / width));
	return {
		groups,
		mine,
		total: groups.reduce((s, b) => s + b.count, 0),
		end: n * width,
		capped
	};
}
