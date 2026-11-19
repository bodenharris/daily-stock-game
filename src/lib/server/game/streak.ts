import { midnightIn } from '#lib/game/daily.ts';
import { LAUNCH_DATE } from '#lib/game/config.ts';

/** A game started before midnight can still be finished for this long after the rollover. */
export const GRACE_MS = 3 * 60 * 60 * 1000;

/** Eastern calendar date of daily puzzle `number`. */
export function dateForNumber(number: number): string {
	const d = new Date(`${LAUNCH_DATE}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + number - 1);
	return d.toISOString().slice(0, 10);
}

/** Started before the next day unlocked, and finished within the grace period after it. */
export function playedOnItsDay(number: number, startedAt: Date, finishedAt: Date): boolean {
	const next = midnightIn(dateForNumber(number + 1)).getTime();
	return startedAt.getTime() < next && finishedAt.getTime() < next + GRACE_MS;
}

/** Length of the run of consecutive numbers (newest first) ending today or yesterday. */
export function countStreak(numbersDesc: number[], todayNumber: number): number {
	let expected = numbersDesc[0] === todayNumber ? todayNumber : todayNumber - 1;
	let streak = 0;
	for (const n of numbersDesc) {
		if (n > expected) continue;
		if (n !== expected) break;
		streak++;
		expected--;
	}
	return streak;
}
