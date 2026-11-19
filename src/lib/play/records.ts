import type { CallRecord } from '#lib/game/share.ts';
import type { CallResult } from './types.ts';

/** The share text's view of the calls: no directions, so it can never give the chart away. */
export function toRecords(results: CallResult[]): CallRecord[] {
	return results.map((r) => ({
		correct: r.correct,
		crowdShareOwn: r.direction === 'up' ? r.crowdUpShareAtCall : 1 - r.crowdUpShareAtCall,
		balanceAfterCents: r.balanceAfterCents
	}));
}
