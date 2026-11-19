/** Where a finish stands among the day's finished games, the viewer's included. */
export interface Standing {
	/** Share (0..1) of the other finished players this finish beat; null until someone else finishes. */
	betterThan: number | null;
	finished: number;
}

/** The standing for an exact place (1-based, ties sharing the better place) among `finished` games. */
export function exactStanding(place: number, finished: number): Standing {
	if (finished < 2) return { betterThan: null, finished };
	const betterThan = (finished - place) / (finished - 1);
	return { betterThan: Math.min(1, Math.max(0, betterThan)), finished };
}

const ordinal = new Intl.PluralRules('en-US', { type: 'ordinal' });
const SUFFIX: Partial<Record<Intl.LDMLPluralRule, string>> = { one: 'st', two: 'nd', few: 'rd' };

/**
 * Where a finish stands among the day's players, in a few friendly words. `among` is 'today'
 * for today's chart, or 'players' for a past day played from the archive.
 */
export function standingText(
	standing: Standing | null,
	among: 'today' | 'players' = 'today'
): string | null {
	if (!standing || standing.betterThan == null || standing.finished < 2) return null;
	const { betterThan, finished } = standing;
	if (finished <= 20) {
		const place = Math.max(1, finished - Math.round(betterThan * (finished - 1)));
		return `${place}${SUFFIX[ordinal.select(place)] ?? 'th'} of ${finished} ${among}`;
	}
	return `Beat ${Math.round(betterThan * 100)}% of players${among === 'today' ? ' today' : ''}`;
}
