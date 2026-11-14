/** Width of the finish buckets the server sends (the curve smooths over them). */
export const FINISH_BUCKET_CENTS = 1_000;
/** Finishes at or above this land in one last bucket, so a wild outlier can't stretch the axis. */
export const FINISH_CAP_CENTS = 100_000;

/** Finishes in one bucket: `cents` is its lower edge; the FINISH_CAP_CENTS bucket is open-ended. */
export interface FinishBucket {
	cents: number;
	count: number;
}
