import type { CallRecord } from '#lib/game/share.ts';
import type { CallResult } from './types.ts';

/** Convert server call results into the records the share text reads. */
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
