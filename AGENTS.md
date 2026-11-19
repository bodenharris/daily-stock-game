# AGENTS.md

Keep this file current: if a change makes anything here wrong or incomplete, update it in the same change.

## Tech Stack

See the Tech Stack section of `README.md`. If you add, remove, or change a core technology, update it in the same change.

Most of this tech stack had a recent major version, so your training data is likely stale. When unsure about an API, check the official docs instead of guessing.

## Skills

- Use the **svelte-code-writer** and **svelte-core-bestpractices** skills whenever you write or edit Svelte code. Remote functions are enabled, so use those. The enhanced-img plugin is added, so use that for images. Always check the official docs.
- Use the **shadcn-svelte** skill whenever you add or change UI. The component source lives in `src/lib/components/ui` and is ours to change: add components with the CLI as needed and edit existing ones freely. They are restyled to the pixel theme, and `src/routes/layout.css` keeps only the tokens the game uses, so a stock component needs restyling when it is added.
- If a skill is missing, say so in your reply and ask the user to install it.

## Database

- Schema changes go through migrations: edit `src/lib/server/db/schema.ts`, run `npm run db:generate` and commit the migration. Never `db:push`. The workflows apply migrations; a pull request fails if the schema changed without one.
- After changing the Better Auth config, run `npm run auth:schema` to regenerate `src/lib/server/db/auth.schema.ts`.
- The app queries Neon over HTTP (`drizzle-orm/neon-http`), which has no interactive transactions. Use a single statement or `db.batch` when writes must happen together.

## Cloudflare Workers

- The app runs on Workers, where each request may land in a fresh isolate: module memory is at most a cache of values that never change, and there is no file system.
- Environment variables are declared in `src/env.ts` and read from `$app/env/private`. They are Worker secrets in production and Previews (see Deployment in `README.md`) and `.env` locally.
- Keep `wrangler.jsonc` minimal: the adapter writes the entry point and assets config itself.

## The game

- Nothing that gives away the answer (ticker, company, dates, real prices) may reach the browser before the reveal. `npm run smoke` checks this against a running server.
- The puzzle catalog holds the answers and stays out of the repo (`private/`, git-ignored).
