import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { building } from '$app/env';
import { DATABASE_URL } from '$app/env/private';
import * as schema from './schema.ts';

// SvelteKit imports server modules once more after the build, with no database around.
// The HTTP driver opens nothing until a query runs, so a placeholder URL is safe there.
export const db = drizzle(neon(building ? 'postgresql://build:build@build/build' : DATABASE_URL), {
  schema,
});
