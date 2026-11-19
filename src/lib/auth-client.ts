import { createAuthClient } from 'better-auth/svelte';

/** Email and password only: anonymous players are created by the server on a first call. */
export const authClient = createAuthClient();
