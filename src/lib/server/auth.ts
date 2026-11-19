import { BETTER_AUTH_SECRET } from '$app/env/private';
import { building } from '$app/env';
import { getRequestEvent } from '$app/server';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous } from 'better-auth/plugins/anonymous';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { sql } from 'drizzle-orm';
import { SITE_URL } from '#lib/game/config.ts';
import { db } from '#lib/server/db/index.ts';

/** The Cloudflare account's workers.dev subdomain, where the Worker and its Previews answer. */
const WORKERS_SUBDOMAIN = 'yoursplit.workers.dev';

export const auth = betterAuth({
	// One build serves the production domain, the Worker's own workers.dev host, every pr-<n>
	// Preview and deployment URL on our subdomain, and local dev. Each allowed host is also a
	// trusted origin; an unlisted host throws. https://better-auth.com/docs/guides/dynamic-base-url
	baseURL: {
		allowedHosts: [
			new URL(SITE_URL).host,
			`thewolfgame.${WORKERS_SUBDOMAIN}`,
			`*-thewolfgame.${WORKERS_SUBDOMAIN}`,
			'localhost:*'
		]
	},
	// The build imports this module without secrets; Better Auth refuses an empty one in production mode.
	secret: building ? 'not-a-secret-while-building' : BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	// Workers get the client address in CF-Connecting-IP, not X-Forwarded-For.
	advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
	emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
	session: {
		// Keep sessions for a year so streaks survive, and avoid a DB round trip on every request.
		expiresIn: 60 * 60 * 24 * 365,
		updateAge: 60 * 60 * 24 * 7,
		cookieCache: { enabled: true, maxAge: 5 * 60 }
	},
	plugins: [
		anonymous({
			// Move the anonymous player's games to the account before Better Auth deletes them. If the
			// account already played the same day elsewhere, the account's game wins. Guesses follow
			// their game. This runs inside sign-in, so it must not throw: a failed move only costs the
			// anonymous history, while an error would fail the sign-in itself.
			onLinkAccount: async ({ anonymousUser, newUser }) => {
				const from = anonymousUser.user.id;
				const to = newUser.user.id;
				if (from === to) return;
				try {
					await db.execute(sql`
						update games set user_id = ${to}
						where user_id = ${from}
							and puzzle_number not in (select puzzle_number from games where user_id = ${to})`);
				} catch (e) {
					console.error('Could not move anonymous games to the account', e);
				}
			}
		}),
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
