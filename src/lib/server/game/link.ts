import { sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';

/**
 * When someone who played anonymously signs up or signs in, move their games to the account
 * before Better Auth deletes the anonymous user. If the account already has a game for the
 * same puzzle (they played on another device too), the account's game wins.
 * Guesses follow automatically: they reference the game, not the user.
 */
export async function transferAnonymousPlays(fromUserId: string, toUserId: string): Promise<void> {
	if (fromUserId === toUserId) return;
	await db.execute(sql`
		update games set user_id = ${toUserId}
		where user_id = ${fromUserId}
			and puzzle_number not in (select puzzle_number from games where user_id = ${toUserId})`);
}
