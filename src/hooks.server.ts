import type { Handle } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { SITE_URL } from '#lib/game/config.ts';
import { auth } from '#lib/server/auth.ts';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const SITE_HOST = new URL(SITE_URL).host;

export const handle: Handle = async ({ event, resolve }) => {
  // The Worker also answers on its own workers.dev host, a full copy of the site. Cloudflare
  // marks Preview URLs noindex but not that one, so keep it (and anything else) out of search.
  if (event.url.host !== SITE_HOST) event.setHeaders({ 'x-robots-tag': 'noindex' });

  // Anonymous players are only created by the game itself, on a first call, behind the per-IP
  // limit. Closing Better Auth's public endpoint stops scripts minting players around it.
  if (event.url.pathname.startsWith('/api/auth/sign-in/anonymous')) {
    return new Response('Not found', { status: 404 });
  }
  const session = await auth.api.getSession({ headers: event.request.headers });
  event.locals.user = session?.user;
  return svelteKitHandler({ event, resolve, auth, building });
};
