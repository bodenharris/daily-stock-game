import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { command, getRequestEvent, query } from '$app/server';
import { dev } from '$app/env';
import { getIP } from 'better-auth/api';
import { and, count, eq, gt } from 'drizzle-orm';
import { auth } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { session, user } from '#lib/server/db/schema.ts';
import {
	archiveFor,
	dayView,
	nameMoment,
	placeCall,
	viewFor,
	type Player
} from '#lib/server/game/play.ts';
import { CALLS_PER_GAME, STAKE_OPTIONS } from '#lib/game/config.ts';
import type { CallResponse, GameView } from '#lib/play/types.ts';

function currentUser(): Player | null {
	const { locals } = getRequestEvent();
	if (!locals.user) return null;
	return { id: locals.user.id, isAnonymous: !!locals.user.isAnonymous, email: locals.user.email };
}

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
	return { id: res.user.id, isAnonymous: true };
}

export const getGame = query(async (): Promise<GameView> => viewFor(currentUser()));

const puzzleNumber = v.pipe(v.number(), v.integer(), v.minValue(1));

/** A past day, for the archive. */
export const getDay = query(puzzleNumber, (number) => dayView(currentUser(), number));

/** Every past day, with how this player did on each. */
export const getArchive = query(() => archiveFor(currentUser()));

/** Point the right cached query at a game's new view: today's page, or the archive's. */
function publish(view: GameView, archive: boolean) {
	if (archive) {
		getDay(view.number).set(view);
		void getArchive().refresh();
	} else {
		getGame().set(view);
	}
}

export const makeCall = command(
	v.object({
		puzzleNumber,
		step: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(CALLS_PER_GAME)),
		direction: v.picklist(['up', 'down']),
		stakePercent: v.picklist(STAKE_OPTIONS.map((o) => o.percent)),
		archive: v.optional(v.boolean())
	}),
	async (input): Promise<CallResponse> => {
		const res = await placeCall(await playerForWrite(), input);
		publish(res.view, !!input.archive);
		return res;
	}
);

/** "Name it": pick one of the four moments (by index), or null to skip. Then the reveal. */
export const nameIt = command(
	v.object({
		puzzleNumber,
		choice: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(3))),
		archive: v.optional(v.boolean())
	}),
	async ({ puzzleNumber, choice, archive }): Promise<GameView> => {
		const user = currentUser();
		if (!user) error(401, 'Play today first');
		const view = await nameMoment(user, puzzleNumber, choice, !!archive);
		publish(view, !!archive);
		return view;
	}
);
