import { defineEnvVars } from '@sveltejs/kit/env';
import { building } from '$app/env';
import * as v from 'valibot';

/** Required when the app runs, but not while it builds, so CI needs no placeholder values. */
const required = {
	schema: building ? v.optional(v.string(), '') : v.pipe(v.string(), v.nonEmpty())
};

export const variables = defineEnvVars({
	DATABASE_URL: { ...required, description: 'The Neon Postgres connection string.' },
	BETTER_AUTH_SECRET: {
		...required,
		description:
			'Signs sessions. 32+ random characters; see [Better Auth installation](https://www.better-auth.com/docs/installation).'
	},
	PUZZLE_SECRET: {
		...required,
		description:
			'Keys the daily puzzle order and the Name it options, so neither can be worked out from the public repo. Must stay the same as production, or past and future days change.'
	},
	PLAY_SOURCE: {
		schema: v.optional(v.picklist(['real', 'dev'])),
		description:
			"Tag for plays from this deployment. Defaults to 'dev' under `vite dev` and 'real' otherwise. Set 'dev' on anything that is not production but shares its database, so test plays never move the real crowd."
	}
});
