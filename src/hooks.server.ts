import type { Handle } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { auth } from '#lib/server/auth.ts';
import { svelteKitHandler } from 'better-auth/svelte-kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Anonymous players are only created by the game itself, on a first call, behind the per-IP
	// limit. Closing Better Auth's public endpoint stops scripts minting players around it.
	if (event.url.pathname.startsWith('/api/auth/sign-in/anonymous')) {
		return new Response('Not found', { status: 404 });
	}
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.user = session?.user;
	event.locals.session = session?.session;

	return svelteKitHandler({ event, resolve, auth, building });
};
