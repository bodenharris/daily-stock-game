import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { command, getRequestEvent, query } from '$app/server';
import { auth } from '#lib/server/auth.ts';
import { PlayError, nameMoment, placeCall, viewFor } from '#lib/server/game/play.ts';
import { BONUS_ROUNDS, bonusState, guessBonus } from '#lib/server/game/bonus.ts';
import { STAKE_OPTIONS } from '#lib/game/config.ts';
import type { CallResponse, GameView } from '#lib/play/types.ts';

function currentUser() {
	const { locals } = getRequestEvent();
	if (!locals.user) return null;
	return {
		id: locals.user.id,
		isAnonymous: !!locals.user.isAnonymous,
		email: locals.user.email
	};
}

// New anonymous players per IP per hour. Generous, because a whole hackathon hall can share
// one IP, but it stops a script from minting thousands of players to swing the crowd.
const ANON_PER_HOUR = 60;
const anonByIp = new Map<string, { count: number; since: number }>();

function allowAnonymous(ip: string): boolean {
	const now = Date.now();
	const entry = anonByIp.get(ip);
	if (!entry || now - entry.since > 3_600_000) {
		anonByIp.set(ip, { count: 1, since: now });
		if (anonByIp.size > 10_000) anonByIp.clear();
		return true;
	}
	entry.count++;
	return entry.count <= ANON_PER_HOUR;
}

/** The player behind this request, creating an anonymous player on their first call. */
async function playerForWrite() {
	const existing = currentUser();
	if (existing) return existing;
	const event = getRequestEvent();
	let ip = 'unknown';
	try {
		ip = event.getClientAddress();
	} catch {
		// Not available in some environments; fall back to one shared bucket.
	}
	// Behind a proxy without ADDRESS_HEADER set, every visitor looks like the proxy itself.
	// Fail open rather than lock the whole site out after 60 players.
	const loopback =
		ip === 'unknown' || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
	if (!loopback && !allowAnonymous(ip)) {
		error(429, 'Too many new players from here. Try again in a few minutes.');
	}
	const res = await auth.api.signInAnonymous({ headers: event.request.headers });
	if (!res?.user) error(500, 'Could not start a game');
	event.locals.user = { ...res.user, isAnonymous: true } as typeof event.locals.user;
	return { id: res.user.id, isAnonymous: true };
}

function rethrow(e: unknown): never {
	if (e instanceof PlayError) error(e.status, e.message);
	throw e;
}

export const getGame = query(async (): Promise<GameView> => {
	try {
		return await viewFor(currentUser());
	} catch (e) {
		rethrow(e);
	}
});

export const makeCall = command(
	v.object({
		puzzleNumber: v.pipe(v.number(), v.integer(), v.minValue(1)),
		step: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10)),
		direction: v.picklist(['up', 'down']),
		stakePercent: v.picklist(STAKE_OPTIONS.map((o) => o.percent))
	}),
	async (input): Promise<CallResponse> => {
		try {
			const user = await playerForWrite();
			const res = await placeCall(user, input);
			getGame().set(res.view);
			return res;
		} catch (e) {
			rethrow(e);
		}
	}
);

/** "Name it": pick one of the four moments (by index), or null to skip. Then the reveal. */
export const nameIt = command(
	v.object({
		puzzleNumber: v.pipe(v.number(), v.integer(), v.minValue(1)),
		choice: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(3)))
	}),
	async ({ puzzleNumber, choice }): Promise<GameView> => {
		const user = currentUser();
		if (!user) error(401, 'Play today first');
		try {
			const view = await nameMoment(user, puzzleNumber, choice);
			getGame().set(view);
			return view;
		} catch (e) {
			rethrow(e);
		}
	}
);

const bonusNumber = v.pipe(v.number(), v.integer(), v.minValue(1));

/** The Real-or-Random round for a finished game (answers only for rounds already guessed). */
export const getBonus = query(bonusNumber, async (puzzleNumber) => {
	const user = currentUser();
	if (!user) error(401, 'Play today first');
	try {
		return await bonusState(user.id, puzzleNumber);
	} catch {
		error(409, 'Finish the game first');
	}
});

export const guessBonusRound = command(
	v.object({
		puzzleNumber: bonusNumber,
		index: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(BONUS_ROUNDS - 1)),
		real: v.boolean()
	}),
	async ({ puzzleNumber, index, real }) => {
		const user = currentUser();
		if (!user) error(401, 'Play today first');
		let state;
		try {
			state = await guessBonus(user.id, puzzleNumber, index, real);
		} catch {
			error(409, 'Finish the game first');
		}
		getBonus(puzzleNumber).set(state);
		if (state.finished) void getGame().refresh();
		return state;
	}
);
