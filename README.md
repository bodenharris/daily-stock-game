# The Wolf (working name)

One famous market chart a day, hidden. Five up-or-down calls with real stakes. Then the unmasking.

Third-party media (the bark recording) and their licenses are listed in [CREDITS.md](CREDITS.md).

## Tech Stack

- **[Svelte](https://svelte.dev)** (Svelte 5) - frontend framework
- **[SvelteKit](https://svelte.dev/docs/kit)** (SvelteKit 3, `adapter-node`, remote functions) - full-stack framework
- **[Tailwind CSS](https://tailwindcss.com)** (Tailwind 4) - styling, with the arcade pixel theme (M3 token names, hand-tuned values) in `src/routes/layout.css`
- **[shadcn-svelte](https://shadcn-svelte.com)** - UI components (built on **[bits-ui](https://bits-ui.com)**), restyled to the pixel theme
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

| Workflow | When                              | What                                                                                                                                                                                                                                                                                                                     |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ci.yml` | Every PR and push to `main`       | Type check, lint, tests and build. On `main`, deploys to prod when `DEPLOY_ENABLED` is `true`.                                                                                                                                                                                                                           |
| `pr.yml` | Every push to a PR from this repo | Deploys the PR to the preview (when `PREVIEW_ENABLED` is `true`), or else smoke-tests it in CI. Either way, when the PR changes migrations or the schema, it first forks the prod database and runs the PR's migrations on the fork. The preview keeps its fork between deploys; CI forks are deleted when the run ends. |

A deploy builds in CI, migrates the prod database (migrations only add, so the running version keeps working), copies `build/` to `/srv/thewolf/<slot>/releases/<id>`, switches the `current` symlink, restarts `thewolf@<slot>`, and rolls back if it doesn't answer within 30 seconds. The build bundles every dependency, so the server needs Node and nothing else.

### Databases

|          | Used by                            | Made by                                                                                          |
| -------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| prod     | the server and the deploy job only | the existing Tiger service                                                                       |
| dev      | everyone's local `.env`            | `tiger service fork <prod-id> --name thewolf-dev` once, then refork whenever you want fresh data |
| PR forks | `pr.yml`                           | the `timescale/fork-service` action, deleted automatically                                       |

Forks are copies: nothing done on dev or a PR fork reaches prod. Our Tiger account runs on the MLH hackathon offer ($1,000 of credits for 30 days), so the services are standard ones: a fork is a backup restore that takes several minutes and bills against the credits. That's why forks only happen when a PR changes the database, and why the preview keeps its fork until it needs a new one (or you run the PR workflow by hand with "Fresh database"). The credits run out 30 days after sign-up; a standard service can't be forked into a free one, so moving to the free tier afterwards means a dump and restore. Seeding the private catalog stays a deliberate manual step: `DATABASE_URL=<prod> node scripts/seed-puzzles.ts`.

### One-time setup

On the server (Ubuntu, as root):

1. Install Node 26 and Caddy.
2. Users and folders: `useradd --system thewolf`, `useradd --create-home deploy`, then `mkdir -p /srv/thewolf/{prod,preview}/{releases,shared}` owned by `deploy`, readable by `thewolf`.
3. `/etc/thewolf/prod.env` and `/etc/thewolf/preview.env` from `deploy/slot.env.example` (mode 600).
4. `deploy/thewolf@.service` → `/etc/systemd/system/`, then `systemctl daemon-reload && systemctl enable thewolf@prod thewolf@preview`.
5. `deploy/sudoers.example` → `/etc/sudoers.d/thewolf-deploy` (lets `deploy` restart the app and nothing else).
6. `deploy/Caddyfile.example` → `/etc/caddy/Caddyfile` with the real domains; DNS A records for both names point at the server.
7. An SSH key pair for CI: the public half in `/home/deploy/.ssh/authorized_keys`.

In GitHub (Settings → Secrets and variables → Actions; environments `production` and `preview`):

| Name                                             | Kind                 | Value                                                                             |
| ------------------------------------------------ | -------------------- | --------------------------------------------------------------------------------- |
| `DEPLOY_SSH_KEY`                                 | secret               | the CI private key                                                                |
| `DEPLOY_KNOWN_HOSTS`                             | secret               | output of `ssh-keyscan <server>`, checked by hand once                            |
| `PROD_DATABASE_URL`                              | secret (production)  | the prod connection string                                                        |
| `TIGERDATA_API_KEY`                              | secret               | Tiger client credentials as `publicKey:secretKey`                                 |
| `DEPLOY_HOST`, `DEPLOY_USER`                     | variables            | server address, `deploy`                                                          |
| `TIGER_PROJECT_ID`, `TIGER_SERVICE_ID`           | variables            | the prod service to fork                                                          |
| `PROD_URL`, `PREVIEW_URL`                        | variables            | `https://…` for each                                                              |
| `DEPLOY_ENABLED`, `PREVIEW_ENABLED`              | variables            | `true` to switch each on                                                          |
| `TIGER_FORK_CPU_MILLIS`, `TIGER_FORK_MEMORY_GBS` | variables (optional) | size of PR and preview forks; blank means the same as prod, smaller saves credits |

Until those are set, the workflows only run the checks. Roll back by hand: `ln -sfn /srv/thewolf/prod/releases/<older> /srv/thewolf/prod/current && sudo systemctl restart thewolf@prod`.
