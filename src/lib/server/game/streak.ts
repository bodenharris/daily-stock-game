import { GRACE_MS } from '#lib/game/config.ts';
import { dateForNumber, midnightIn } from '#lib/game/daily.ts';

/**
 * Whether a game counts toward a streak: started before the next day unlocked, and finished
 * within the grace period after it. Past days played from the archive never count.
 */
export function playedOnItsDay(number: number, startedAt: Date, finishedAt: Date): boolean {
	const next = midnightIn(dateForNumber(number + 1)).getTime();
	return startedAt.getTime() < next && finishedAt.getTime() < next + GRACE_MS;
}

/** Length of the run of consecutive numbers (newest first) ending today or yesterday. */
export function countStreak(numbersDesc: number[], todayNumber: number): number {
	const newest = numbersDesc[0] === todayNumber ? todayNumber : todayNumber - 1;
	let streak = 0;
	while (numbersDesc[streak] === newest - streak) streak++;
	return streak;
}
