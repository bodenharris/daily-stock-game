import { getRequestEvent, query } from '$app/server';
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { games } from '#lib/server/db/schema.ts';
import { loadToday } from '#lib/server/game/play.ts';
import { statsFor, type Stats } from '#lib/server/stats.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type LiveStats = Stats & {
	/** Today's per-call crowd split is hidden until the viewer has finished, so it can't be gamed. */
	viewerFinished: boolean;
};

async function viewerFinished(userId: string | undefined, puzzleNumber: number) {
	if (!userId) return false;
	const [row] = await db
		.select({ id: games.id })
		.from(games)
		.where(
			and(
				eq(games.userId, userId),
				eq(games.puzzleNumber, puzzleNumber),
				isNotNull(games.finishedAt)
			)
		);
	return !!row;
}

/** Live stats for today's puzzle, pushed every few seconds while the page is open. */
export const liveStats = query.live(async function* (): AsyncGenerator<LiveStats> {
	const userId = getRequestEvent().locals.user?.id;
	let finished = false;
	while (true) {
		const today = await loadToday();
		if (!finished) finished = await viewerFinished(userId, today.number);
		const stats = await statsFor(today.number);
		yield { ...stats, steps: finished ? stats.steps : [], viewerFinished: finished };
		await sleep(4000);
	}
});
