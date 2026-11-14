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
		description:
			'Secret used to sign tokens. For production use 32+ characters generated with high entropy. See [Better Auth installation](https://www.better-auth.com/docs/installation).'
	},
	BETTER_AUTH_URL: {
		description: 'Public base URL Better Auth uses for callbacks. Falls back to ORIGIN.',
		schema: optional
	}
});
