/**
 * Wolf Pack Ranks: the end-of-game label, from where a finish stands among the day's players.
 *
 *   Beat 0–9% of players     Pup
 *   Beat 10–24%              Scout
 *   Beat 25–44%              Sentinel
 *   Beat 45–79%              Hunter
 *   Beat 80% or more         Elder
 *   1st place                Alpha (shared by everyone tied for first)
 *
 * The percentage is the one the standing line shows ("Beat 64% of players today"), rounded the
 * same way, so the rank never disagrees with the number beside it. Small crowds get a rank too:
 * the first player of the day is the Alpha until someone beats them.
 *
 * Spoiler rule: a rank only says how a finish compares with other players, never which way the
 * chart went, so it is safe in the share text.
 */

export type PackRankKey = 'pup' | 'scout' | 'sentinel' | 'hunter' | 'elder' | 'alpha';

export interface PackRank {
	readonly key: PackRankKey;
	readonly label: string;
	/** What the rank means, under it on the end card. Short enough for one line on a phone. */
	readonly line: string;
}

/** Lowest first. `from` is the smallest whole "beat X%" that earns the rank. */
export const PACK_RANKS: readonly (PackRank & { readonly from: number })[] = [
	{ key: 'pup', label: 'Pup', line: 'Beat under 10% of the pack.', from: 0 },
	{ key: 'scout', label: 'Scout', line: 'Beat 10–24% of the pack.', from: 10 },
	{ key: 'sentinel', label: 'Sentinel', line: 'Beat 25–44% of the pack.', from: 25 },
	{ key: 'hunter', label: 'Hunter', line: 'Beat 45–79% of the pack.', from: 45 },
	{ key: 'elder', label: 'Elder', line: 'Beat 80% or more of the pack.', from: 80 }
];

export const ALPHA: PackRank = { key: 'alpha', label: 'Alpha', line: 'Top of the pack.' };

/** Shown before the rank in the share text: one emoji every platform has had for years. */
export const PACK_EMOJI = '🐺';

/**
 * The rank for a standing, or null when there is none to give (the day's finishes couldn't be
 * read). `betterThan` is the share (0..1) of the other finished players this finish beat; 1 means
 * first place, ties included.
 */
export function packRank(
	standing: { betterThan: number | null; finished: number } | null
): PackRank | null {
	if (!standing || standing.finished < 1) return null;
	const { betterThan, finished } = standing;
	// Nobody else has finished yet: first, and so the Alpha for now.
	if (finished === 1) return ALPHA;
	if (betterThan == null) return null;
	if (betterThan >= 1) return ALPHA;
	const percent = Math.round(Math.max(0, betterThan) * 100);
	let rank: PackRank = PACK_RANKS[0];
	for (const r of PACK_RANKS) if (percent >= r.from) rank = r;
	return { key: rank.key, label: rank.label, line: rank.line };
}
