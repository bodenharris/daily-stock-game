# The Wolf

One famous market chart a day, hidden. Five up-or-down calls with real stakes. Then the unmasking.

Third-party media (the bark recording) and their licenses are listed in [CREDITS.md](CREDITS.md).

## Tech Stack

- **[Svelte](https://svelte.dev)** (Svelte 5) - frontend framework
- **[SvelteKit](https://svelte.dev/docs/kit)** (SvelteKit 3, remote functions) - full-stack framework
- **[Tailwind CSS](https://tailwindcss.com)** (Tailwind 4) - styling, with the arcade pixel theme in `src/routes/layout.css`
- **[shadcn-svelte](https://shadcn-svelte.com)** - UI components (built on **[bits-ui](https://bits-ui.com)**), restyled to the pixel theme
- **[Neon](https://neon.com)** - Postgres, queried over HTTP
- **[Drizzle ORM](https://orm.drizzle.team)** - schema and migrations (`generate` + `migrate`, never `push`)
- **[Better Auth](https://www.better-auth.com)** - anonymous players, plus optional email and password accounts
- **[Cloudflare Workers](https://developers.cloudflare.com/workers/)** (`adapter-cloudflare`, Wrangler) - hosting
- **[Tiingo](https://www.tiingo.com)** - daily price history, loaded by a script
- **[Vitest](https://vitest.dev)**, ESLint, Prettier
- **GitHub Actions** - checks, migrations and deploys; see Deployment

## Getting Started

```sh
npm i
cp .env.example .env   # then fill in the values
npm run db:migrate
npm run dev
```

Local development uses the `dev` branch of the Neon project, a copy of production that you can reset from its parent whenever you want fresh data.

Checks: `npm run lint`, `npm run check`, `npm test`.

Prices and puzzles (`.env` needs `DATABASE_URL`; fetching also needs `TIINGO_API_KEY`):

- `npm run prices fetch [TICKER…]` downloads daily history into `.cache/tiingo` (paced for Tiingo's free plan; resumable). `npm run prices load [TICKER…]` loads it, split-adjusted, into `tickers`, `prices` and `splits`.
- The catalog holds the answers, so it isn't in this repo: `npm run catalog export` pulls it into the git-ignored `private/catalog.json`; edit it, run `npm run catalog check`, then `npm run catalog seed` (which checks again first; add `-- --retire` to take puzzles out of play). `scripts/catalog.example.json` shows the format.
- `npm run simulate` checks the payout rules; `npm run smoke [-- <url>]` spoiler-tests a running server on the same database; `scripts/make-images.py` redraws the icons and link preview.

## Deployment

The app is the Cloudflare Worker `thewolfgame`, served at [thewolfof.nyc](https://thewolfof.nyc), on a Neon database. GitHub Actions does the rest:

| Workflow                | When                              | What                                                                                                                                                                 |
| ----------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deploy-production.yml` | Every push to `main`              | Lint, type check, tests and build; then migrates the production database and deploys the Worker.                                                                     |
| `deploy-preview.yml`    | Every push to a PR from this repo | The same checks, and fails if the schema changed without a committed migration. Then creates the Neon branch `pr-<n>`, migrates it and deploys the Preview `pr-<n>`. |
| `cleanup-preview.yml`   | A PR closes                       | Deletes the PR's Preview and Neon branch.                                                                                                                            |

A Preview is a full copy of the game on its own URL with its own copy of the production data, so nothing done there reaches production.

### Secrets

The Worker reads `DATABASE_URL`, `BETTER_AUTH_SECRET` and `PUZZLE_SECRET` (see `.env.example`). Builds need none of them.

- **Production**: `npx wrangler secret put <NAME>` for each.
- **Previews** inherit nothing from production. `BETTER_AUTH_SECRET` and `PUZZLE_SECRET` are set once for all of them with `npx wrangler preview base-config secret put <NAME>`; each Preview's `DATABASE_URL` comes from its Neon branch in the workflow.
- **GitHub** (Settings → Secrets and variables → Actions): secrets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (an account API token from the "Edit Cloudflare Workers" template) and `NEON_API_KEY`; variable `NEON_PROJECT_ID`; and `DATABASE_URL`, the production connection string, as a secret of the `production` environment.

Sign-in with a password hashes it on the Worker (scrypt, about 70 ms of CPU), which needs the Workers Paid plan; the Free plan stops a request after 10 ms of CPU. Playing without an account is not affected.
