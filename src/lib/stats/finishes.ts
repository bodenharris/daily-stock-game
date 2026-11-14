/** Width of the finish buckets the live stats send (the page groups them into wider bars). */
export const FINISH_BUCKET_CENTS = 1_000;
/** Finishes at or above this land in one last bucket, so a wild outlier can't stretch the axis. */
export const FINISH_CAP_CENTS = 100_000;
