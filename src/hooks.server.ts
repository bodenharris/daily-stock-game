import type { Handle } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { auth } from '#lib/server/auth.ts';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	// Anonymous players are only ever created by the game itself (on a first call, rate-limited
	// per IP). Closing Better Auth's public endpoint stops scripts minting players around that.
	if (event.url.pathname.startsWith('/api/auth/sign-in/anonymous')) {
		return new Response('Not found', { status: 404 });
	}
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
