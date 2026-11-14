import { ORIGIN, BETTER_AUTH_SECRET, BETTER_AUTH_URL } from '$app/env/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous } from 'better-auth/plugins/anonymous';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { dev } from '$app/env';
import { db } from '#lib/server/db/index.ts';
import { transferAnonymousPlays } from '#lib/server/game/link.ts';

export const auth = betterAuth({
	baseURL: BETTER_AUTH_URL || ORIGIN,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	// In development the dev server may land on any local port.
	trustedOrigins: dev ? ['http://localhost:*', 'http://127.0.0.1:*'] : [],
	emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
	session: {
		// Keep sessions for a year so streaks survive, and avoid a DB round trip on every request.
		expiresIn: 60 * 60 * 24 * 365,
		updateAge: 60 * 60 * 24 * 7,
		cookieCache: { enabled: true, maxAge: 5 * 60 }
	},
	plugins: [
		anonymous({
			onLinkAccount: async ({ anonymousUser, newUser }) => {
				await transferAnonymousPlays(anonymousUser.user.id, newUser.user.id);
			}
		}),
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
