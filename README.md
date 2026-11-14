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
- **GitHub Actions** - CI, a Tiger database fork per PR, one preview site, and deploys to a Vultr Ubuntu server (systemd + Caddy); see Deployment

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
node scripts/seed-puzzles.ts   # upserts private/catalog.json into the puzzles table
```

The puzzle catalog holds every answer, so it isn't in this public repo. It lives in the shared database and in a git-ignored `private/catalog.json`: run `node scripts/export-catalog.ts` to pull it, edit it, check it with `node scripts/check-puzzles.ts`, then seed it back. `scripts/catalog.example.json` shows the format.

Behind a reverse proxy (Caddy), set `ADDRESS_HEADER=X-Forwarded-For` and `XFF_DEPTH=1` so the per-IP limit on new anonymous players sees real client addresses.

Checks: `npm run verify` (type check, lint, tests). Simulator: `node scripts/simulate.ts`. Spoiler smoke test against a running server: `npm run smoke`.

## Deployment

One Vultr Ubuntu server runs two copies of the app behind Caddy: **prod** (the live game, port 3000) and **preview** (one PR at a time, port 3001). GitHub Actions does the rest:

| Workflow | When                              | What                                                                                                                                                                                                                                                      |
| -------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml` | Every PR and push to `main`       | Type check, lint, tests and build. On `main`, deploys to prod when `DEPLOY_ENABLED` is `true`.                                                                                                                                                            |
| `pr.yml` | Every push to a PR from this repo | Forks the prod database, runs the PR's migrations on the fork, then either deploys the PR to the preview (when `PREVIEW_ENABLED` is `true`) or smoke-tests it in CI. The fork is deleted afterwards (for the preview: when the next preview replaces it). |

A deploy builds in CI, migrates the prod database (migrations only add, so the running version keeps working), copies `build/` to `/srv/hindsight/<slot>/releases/<id>`, switches the `current` symlink, restarts `hindsight@<slot>`, and rolls back if it doesn't answer within 30 seconds. The build bundles every dependency, so the server needs Node and nothing else.

### Databases

|          | Used by                            | Made by                                                                                            |
| -------- | ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| prod     | the server and the deploy job only | the existing Tiger service                                                                         |
| dev      | everyone's local `.env`            | `tiger service fork <prod-id> --name hindsight-dev` once, then refork whenever you want fresh data |
| PR forks | `pr.yml`                           | the `timescale/fork-service` action, deleted automatically                                         |

Forks are copies: nothing done on dev or a PR fork reaches prod. On Tiger's free tier a fork takes 30–90 seconds; on standard services 5–20+ minutes, in which case leave `PREVIEW_ENABLED` off and refork on demand. Seeding the private catalog stays a deliberate manual step: `DATABASE_URL=<prod> node scripts/seed-puzzles.ts`.

### One-time setup

On the server (Ubuntu, as root):

1. Install Node 26 and Caddy.
2. Users and folders: `useradd --system hindsight`, `useradd --create-home deploy`, then `mkdir -p /srv/hindsight/{prod,preview}/{releases,shared}` owned by `deploy`, readable by `hindsight`.
3. `/etc/hindsight/prod.env` and `/etc/hindsight/preview.env` from `deploy/slot.env.example` (mode 600).
4. `deploy/hindsight@.service` → `/etc/systemd/system/`, then `systemctl daemon-reload && systemctl enable hindsight@prod hindsight@preview`.
5. `deploy/sudoers.example` → `/etc/sudoers.d/hindsight-deploy` (lets `deploy` restart the app and nothing else).
6. `deploy/Caddyfile.example` → `/etc/caddy/Caddyfile` with the real domains; DNS A records for both names point at the server.
7. An SSH key pair for CI: the public half in `/home/deploy/.ssh/authorized_keys`.

In GitHub (Settings → Secrets and variables → Actions; environments `production` and `preview`):

| Name                                   | Kind                | Value                                                  |
| -------------------------------------- | ------------------- | ------------------------------------------------------ |
| `DEPLOY_SSH_KEY`                       | secret              | the CI private key                                     |
| `DEPLOY_KNOWN_HOSTS`                   | secret              | output of `ssh-keyscan <server>`, checked by hand once |
| `PROD_DATABASE_URL`                    | secret (production) | the prod connection string                             |
| `TIGERDATA_API_KEY`                    | secret              | Tiger client credentials as `publicKey:secretKey`      |
| `DEPLOY_HOST`, `DEPLOY_USER`           | variables           | server address, `deploy`                               |
| `TIGER_PROJECT_ID`, `TIGER_SERVICE_ID` | variables           | the prod service to fork                               |
| `PROD_URL`, `PREVIEW_URL`              | variables           | `https://…` for each                                   |
| `DEPLOY_ENABLED`, `PREVIEW_ENABLED`    | variables           | `true` to switch each on                               |

Until those are set, the workflows only run the checks. Roll back by hand: `ln -sfn /srv/hindsight/prod/releases/<older> /srv/hindsight/prod/current && sudo systemctl restart hindsight@prod`.
