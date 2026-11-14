# Morning report

No deploy workflows exist in `.github/workflows`, so commits were pushed to `main` as we went.

## Run it

```sh
npm i
npm run dev
```

Open http://localhost:5173 (use a phone-sized window). The `.env` on this machine already has everything; the database is already migrated and loaded. If you ever need to redo setup on a new machine:

```sh
cp .env.example .env            # fill in values
npm run db:migrate              # apply migrations (adds only)
node scripts/ingest-prices.ts   # needs .cache/tiingo, see below
node scripts/seed-puzzles.ts
```

Checks: `npm run verify` (svelte-check, Prettier, ESLint, Vitest). Production build: `npm run build && node build`.

## What works

- **The game**, playable without an account: hidden chart, five calls with 10/25/50% stakes, each stretch drawn in with a spring, crowd split and crowd payout after every call, then the unmasking (ticker, dates, prices on the chart, the story), an archetype and a share grid.
- **Server-side truth:** the client never receives future bars, dates or the ticker before the reveal; every call is settled in a database transaction with a row lock.
- **Accounts and streaks:** the first call creates an anonymous player; signing up (email + password) keeps today's game and every past game; the streak shows in the header and the account sheet.
- **Live stats page** (`/stats`), streamed from the continuous aggregates.
- **Bonus round:** Real or Random, three charts a day, scored on the server and added to the share text.
- **Tiger Data:** `prices` and `guesses` hypertables with columnstore compression; `crowd_hourly` (real-time continuous aggregate feeding the payout), `crowd_daily` (hierarchical aggregate) and `finals_hourly` (Toolkit `percentile_agg` for the median finish); `time_bucket_gapfill` for the hourly chart; users, sessions, puzzles and games as ordinary tables in the same database.
- **Data:** 30 hand-picked puzzles (1987–2025) validated against the real prices; ~100 tickers of daily history.
- **Tests:** 82 (money math, payout, daily selection across midnight Eastern and DST, archetypes, share text spoils nothing, split adjustment, puzzle outcomes).

## What does not work yet / known issues

Being worked on in the refine loop; this list is kept current.

- The reveal screen is taller than a phone screen, so Share sits below the fold.

## Decisions

All in `docs/decisions.md`. The big ones:

- The 50% stake pays 0.8× the crowd multiplier, so going all-in every time loses to thoughtful play (30/30 simulated scenarios).
- Crowd multiplier = 2 × share who called the other way (0.5×–2×), with a 10-player 50/50 prior for quiet mornings.
- Each call gets an equal slice of the chart's width whatever its length in days; a dashed line shows "now".
- Dev plays are tagged `dev` and never count toward the real crowd or the public stats.
- Today's crowd split on the stats page is hidden until you finish, so it can't be used to game the payout.

## Blocked on you

Nothing so far. See `docs/blocked.md` if it appears.

## What I would improve next

Kept current at the end of the night.
