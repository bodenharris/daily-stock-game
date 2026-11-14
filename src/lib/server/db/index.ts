import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { DATABASE_URL } from '$app/env/private';

/** One small pool per server process. Tiger Data allows ~100 connections shared by the team. */
export const client = postgres(DATABASE_URL, {
	max: 8,
	idle_timeout: 30,
	connect_timeout: 10
});

export const db = drizzle(client, { schema });
