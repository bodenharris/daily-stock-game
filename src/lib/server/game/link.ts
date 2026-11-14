import { sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';

/**
 * When someone who played anonymously signs up or signs in, move their games to the account
 * before Better Auth deletes the anonymous user. If the account already has a game for the
 * same puzzle (they played on another device too), the account's game wins.
 * Guesses follow automatically: they reference the game, not the user.
 *
 * This runs inside the sign-in flow, so it must never throw: a failed transfer only costs the
 * anonymous history, while a thrown error would fail the sign-in itself.
 */
export async function transferAnonymousPlays(fromUserId: string, toUserId: string): Promise<void> {
	if (fromUserId === toUserId) return;
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			await db.execute(sql`
				update games set user_id = ${toUserId}
				where user_id = ${fromUserId}
					and puzzle_number not in (select puzzle_number from games where user_id = ${toUserId})`);
			return;
		} catch (e) {
			// A unique clash means the account just started the same puzzle; try once more.
			if (attempt === 1) console.error('Could not move anonymous games to the account', e);
		}
	}
}
