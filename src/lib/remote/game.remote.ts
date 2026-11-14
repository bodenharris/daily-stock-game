import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { command, getRequestEvent, query } from '$app/server';
import { auth } from '#lib/server/auth.ts';
import { PlayError, loadToday, placeCall, viewFor } from '#lib/server/game/play.ts';
import {
	BONUS_ROUNDS,
	answerBonus,
	bonusCharts,
	bonusRoundAnswer
} from '#lib/server/game/bonus.ts';
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

/** The player behind this request, creating an anonymous player on their first call. */
async function playerForWrite() {
	const existing = currentUser();
	if (existing) return existing;
	const event = getRequestEvent();
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
		stakePercent: v.pipe(v.number(), v.minValue(1), v.maxValue(100))
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

export const getBonus = query(async () => {
	const today = await loadToday();
	return { number: today.number, charts: await bonusCharts(today.number) };
});

export const revealBonusRound = command(
	v.object({ puzzleNumber: v.number(), index: v.pipe(v.number(), v.integer(), v.minValue(0)) }),
	async ({ puzzleNumber, index }) => {
		try {
			return await bonusRoundAnswer(puzzleNumber, index);
		} catch (e) {
			rethrow(e);
		}
	}
);

export const finishBonus = command(
	v.object({
		puzzleNumber: v.number(),
		guesses: v.pipe(v.array(v.boolean()), v.length(BONUS_ROUNDS))
	}),
	async ({ puzzleNumber, guesses }) => {
		const user = currentUser();
		if (!user) error(401, 'Play today first');
		const res = await answerBonus(user.id, puzzleNumber, guesses);
		void getGame().refresh();
		return res;
	}
);
