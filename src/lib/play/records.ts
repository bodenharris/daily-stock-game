import type { CallRecord } from '#lib/game/archetype.ts';
import type { CallResult } from './types.ts';

/** Convert server call results into the records the archetype and share rules read. */
export function toRecords(results: CallResult[]): CallRecord[] {
	return [...results]
		.sort((a, b) => a.step - b.step)
		.map((r) => ({
			direction: r.direction,
			stakePercent: r.stakePercent,
			correct: r.correct,
			crowdShareOwn: r.direction === 'up' ? r.crowdUpShareAtCall : 1 - r.crowdUpShareAtCall,
			multiplierHundredths: r.multiplierHundredths,
			balanceAfterCents: r.balanceAfterCents
		}));
}

/** Share of the live crowd that called the same way as this result (player included). */
export function sameSideShare(r: CallResult): number {
	const total = r.crowd.up + r.crowd.down;
	if (total === 0) return 1;
	return (r.direction === 'up' ? r.crowd.up : r.crowd.down) / total;
}
