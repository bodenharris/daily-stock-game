# Hindsight (working name)

One famous market chart a day, hidden. Five up-or-down calls with real stakes. Then the unmasking.

## Tech Stack

- **[Svelte](https://svelte.dev)** (Svelte 5) - frontend framework
- **[SvelteKit](https://svelte.dev/docs/kit)** (SvelteKit 3, `adapter-node`, remote functions) - full-stack framework
- **[Tailwind CSS](https://tailwindcss.com)** (Tailwind 4) - styling, with Material 3 Expressive tokens in `src/routes/layout.css`
- **[shadcn-svelte](https://shadcn-svelte.com)** - UI components (built on **[bits-ui](https://bits-ui.com)**), restyled as M3 Expressive
- **[Tiger Data](https://www.tigerdata.com)** (PostgreSQL + TimescaleDB + Toolkit) - the only database: hypertables, columnstore compression, continuous aggregates
- **[Drizzle ORM](https://orm.drizzle.team)** - schema and migrations (`generate` + `migrate`, never `push`)
- **[Better Auth](https://www.better-auth.com)** - email and password, plus the anonymous plugin
- **[Tiingo](https://www.tiingo.com)** - daily price history, loaded once by a script
- **[Vitest](https://vitest.dev)**, ESLint, Prettier

## Getting Started

```sh
npm i
cp .env.example .env   # then fill in the values
npm run db:migrate
npm run dev
```

Price data and puzzles (one-off, already done for the shared database):

```sh
node scripts/fetch-prices.ts   # downloads to .cache/tiingo (slow: free-plan rate limit)
node scripts/ingest-prices.ts  # loads the cache into the prices hypertable
node scripts/seed-puzzles.ts   # upserts the puzzle catalog
```

Checks: `npm run verify` (type check, lint, tests). Simulator: `node scripts/simulate.ts`.
