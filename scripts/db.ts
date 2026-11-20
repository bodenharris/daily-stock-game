// The database for maintenance scripts: the same Neon HTTP driver and schema as the app. Variables
// already set in the shell win over .env, so `DATABASE_URL=<other> node scripts/x.ts` works.
import { existsSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { getTableColumns, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import type { PgTable } from 'drizzle-orm/pg-core';
import * as schema from '#lib/server/db/schema.ts';

const envFile = new URL('../.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

export const db = drizzle(neon(process.env.DATABASE_URL), { schema });

/** The `set` of an upsert that overwrites `keys` with the incoming row's values. */
export function excluded<T extends PgTable>(table: T, keys: (keyof T['_']['columns'])[]) {
  const columns = getTableColumns(table);
  return Object.fromEntries(
    keys.map((k) => [k, sql.raw(`excluded."${columns[k as string].name}"`)]),
  );
}
