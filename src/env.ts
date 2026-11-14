import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => (value ? value : undefined);

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Postgres (Tiger Data) connection string. Keep `sslmode=require`.',
		schema: (value) => {
			if (!value) throw new Error('DATABASE_URL is not set');
			return value;
		}
	},
	ORIGIN: {
		description: 'The app origin (base URL), e.g. `http://localhost:5173`.'
	},
	BETTER_AUTH_SECRET: {
		schema: (value) => {
			if (!value || value.length < 32) throw new Error('BETTER_AUTH_SECRET must be 32+ characters');
			return value;
		},
		description:
			'Secret used to sign tokens. For production use 32+ characters generated with high entropy. See [Better Auth installation](https://www.better-auth.com/docs/installation).'
	},
	PUZZLE_SECRET: {
		description:
			'Secret that shuffles the daily puzzle order, so the schedule cannot be read from the public repo. Falls back to BETTER_AUTH_SECRET.',
		schema: optional
	},
	PLAY_SOURCE: {
		description:
			"Tag for plays from this server: 'real' (default in production) or 'dev'. Set 'dev' when running a local production build against the shared database.",
		schema: (value) => (value === 'dev' || value === 'real' ? value : undefined)
	},
	BETTER_AUTH_URL: {
		description: 'Public base URL Better Auth uses for callbacks. Falls back to ORIGIN.',
		schema: optional
	}
});
