/**
 * Where a finish stands among the day's players, in a few friendly words. `among` is 'today'
 * for today's chart, or 'players' for a past day played from the archive.
 */
export function standingText(
	standing: { betterThan: number | null; finished: number } | null,
	among: 'today' | 'players' = 'today'
): string | null {
	if (!standing || standing.betterThan == null || standing.finished < 2) return null;
	const { betterThan, finished } = standing;
	if (finished <= 20) {
		const place = Math.max(1, finished - Math.round(betterThan * (finished - 1)));
		const suffix =
			place % 10 === 1 && place % 100 !== 11
				? 'st'
				: place % 10 === 2 && place % 100 !== 12
					? 'nd'
					: place % 10 === 3 && place % 100 !== 13
						? 'rd'
						: 'th';
		return `${place}${suffix} of ${finished} ${among === 'today' ? 'today' : 'players'}`;
	}
	return `Beat ${Math.round(betterThan * 100)}% of players${among === 'today' ? ' today' : ''}`;
}
