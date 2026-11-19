import type { auth } from '#lib/server/auth.ts';

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			user?: typeof auth.$Infer.Session.user;
		}
	}
}

export {};
