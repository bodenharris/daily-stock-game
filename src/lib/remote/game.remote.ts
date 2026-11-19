import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { command, getRequestEvent, query } from '$app/server';
import { dev } from '$app/env';
import { getIP } from 'better-auth/api';
import { and, count, eq, gt } from 'drizzle-orm';
import { CALLS_PER_GAME, STAKE_OPTIONS } from '#lib/game/config.ts';
import type { GameView } from '#lib/play/types.ts';
import { auth } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { session, user } from '#lib/server/db/schema.ts';
import { NAME_IT_OPTIONS } from '#lib/server/game/name-it.ts';
import {
	archiveFor,
	dayView,
	nameMoment,
	placeCall,
	viewFor,
	type Player
} from '#lib/server/game/play.ts';

const currentUser = (): Player | null => getRequestEvent().locals.user ?? null;

// New anonymous players per IP per hour. Generous, because a whole hall can share one IP, but it
// stops a script from minting thousands of players to swing the crowd.
const ANON_PER_HOUR = 60;

/** The player behind this request, creating an anonymous player on their first call. */
async function playerForWrite(): Promise<Player> {
	const existing = currentUser();
	if (existing) return existing;
	const { request } = getRequestEvent();
	// Counted from the sessions Better Auth stores, which hold the address it reads here.
	const ip = getIP(request, auth.options);
	if (ip && !dev) {
		const [recent] = await db
			.select({ n: count() })
			.from(session)
			.innerJoin(user, eq(user.id, session.userId))
			.where(
				and(
					eq(session.ipAddress, ip),
					eq(user.isAnonymous, true),
					gt(session.createdAt, new Date(Date.now() - 3_600_000))
				)
			);
		if (recent.n >= ANON_PER_HOUR) {
			error(429, 'Too many new players from here. Try again in a few minutes.');
		}
	}
	const res = await auth.api.signInAnonymous({ headers: request.headers });
	if (!res?.user) error(500, 'Could not start a game');
	return res.user;
}

export const getGame = query(() => viewFor(currentUser()));

const puzzleNumber = v.pipe(v.number(), v.integer(), v.minValue(1));

/** A past day, for the archive. */
export const getDay = query(puzzleNumber, (number) => dayView(currentUser(), number));

/** Every past day, with how this player did on each. */
export const getArchive = query(() => archiveFor(currentUser()));

/** Point the right cached query at a game's new view: today's page, or the archive's. */
function update(view: GameView, archive: boolean | undefined) {
	if (archive) {
		getDay(view.number).set(view);
		void getArchive().refresh();
	} else {
		getGame().set(view);
	}
}

/** One call. The new view reaches the page through its query; the result says how it went. */
export const makeCall = command(
	v.object({
		puzzleNumber,
		archive: v.optional(v.boolean()),
		step: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(CALLS_PER_GAME)),
		direction: v.picklist(['up', 'down']),
		stakePercent: v.picklist(STAKE_OPTIONS.map((o) => o.percent))
	}),
	async (input) => {
		const { view, result } = await placeCall(await playerForWrite(), input);
		update(view, input.archive);
		return { result };
	}
);

/** "Name it": pick one of the moments (by index), or null to skip. Then the reveal. */
export const nameIt = command(
	v.object({
		puzzleNumber,
		archive: v.optional(v.boolean()),
		choice: v.nullable(
			v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(NAME_IT_OPTIONS - 1))
		)
	}),
	async (input) => {
		const player = currentUser();
		if (!player) error(401, 'Play today first');
		const view = await nameMoment(player, input);
		update(view, input.archive);
		return view;
	}
);
