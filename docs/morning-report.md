# Morning report

No deploy workflows exist in `.github/workflows`, so commits were pushed to `main` as we went. Nothing was deployed and the server, DNS and paid services were not touched.

## Run it

```sh
npm i
npm run dev
```

Open http://localhost:5173 in a phone-sized window. This machine's `.env` already has everything, and the shared database is migrated and loaded.

Setting up a new machine:

```sh
cp .env.example .env            # fill in values
npm run db:migrate              # migrations only add things
node scripts/fetch-prices.ts    # Tiingo → .cache/tiingo (slow: free-plan rate limit)
node scripts/ingest-prices.ts   # cache → prices hypertable, then compress
node scripts/seed-puzzles.ts    # catalog → puzzles table
```

- Checks: `npm run verify` (svelte-check, Prettier, ESLint, Vitest).
- Production build: `npm run build && node build`. Set `PLAY_SOURCE=dev` when running a local build against the shared database, so your test plays stay out of the real crowd.
- Money simulator: `node scripts/simulate.ts`.

## What works

- **The game, playable without an account.**
  - A hidden real chart and five calls with 10/25/50% stakes.
  - Each stretch draws in first. Then the balance, score dot, size of the move, crowd split and payout land.
  - Then the unmasking: headline, ticker, dates, real prices on the chart and a short story, plus an archetype and a one-row share grid that spoils nothing.
- **Honest server.**
  - The browser never gets future bars, dates or the ticker before the reveal.
  - Every call settles in a transaction with a row lock.
  - The daily schedule is stored and secretly shuffled, so the repo doesn't reveal the order and a day's puzzle can't change mid-game.
  - Three hours of grace after midnight for a game in progress.
  - Bonus answers are only revealed after the guess is stored.
- **Crowd payout:**
  - 2 × the share of players who called the other way, kept between 0.5× and 2×.
  - Blended with a 10-player 50/50 prior on quiet mornings.
  - Locked at the moment you call, and explained in the result line.
- **Accounts and streaks:**
  - The first call creates an anonymous player.
  - Email and password sign-up keeps today's game and every past one.
  - The streak shows in the header and the account sheet.
- **Live stats** (`/stats`):
  - One shared query every 3 seconds, streamed with `query.live`.
  - Your finish and percentile, and the crowd's split per call, but only after you've finished.
  - The Tiger Data details are in a collapsed "How this page works".
- **Bonus round:** Real or Random. Three charts a day: real post-2001 windows, or GARCH random walks matched to real volatility.
- **Tiger Data**, all visible and fast. Database time is under 0.2 ms for every stats query; round trips from this laptop are about 23 ms.
  - Hypertables: `prices` and `guesses`, both with columnstore compression.
  - Continuous aggregates:
    - `crowd_hourly`: real-time, feeds the payout.
    - `crowd_daily`: hierarchical, rolled up from `crowd_hourly`.
    - `finals_hourly`: a Toolkit `percentile_agg` for the median finish and your rank.
  - `time_bucket_gapfill` for the 24-hour chart.
  - Users, sessions, puzzles, schedule and games are ordinary tables in the same database.
- **Data:** 30 hand-picked puzzles from 1987 to 2025, checked against real prices; about 100 tickers of daily history.
- **Look:** Material 3 Expressive in green, light and dark following the system, self-hosted Google Sans Flex and Roboto Flex. Checked at 375×812 and 320×568.
- **Tests:** 102 covering money math, payout, daily selection (midnight Eastern, DST), the schedule shuffle, archetypes, share text, split adjustment and puzzle outcomes.

## Known issues and limits

- **Replays:** a player can replay a day by clearing cookies, and can move a perfect anonymous game onto an account by signing in. There's no leaderboard, so I accepted it (see decisions).
- **Accounts:** there's no email verification and no password reset, because there's no email service.
- **Licence:** Tiingo's free plan doesn't allow public display (a risk product.md already lists).

## Decisions

All in `docs/decisions.md`. The big ones:

- **The 50% stake pays 0.8× the crowd multiplier.** Without that, betting the max every time tied careful play; now thoughtful play wins 30 of 30 simulated scenarios.
- **Green and coral mean right and wrong.** Never up and down.
- **Each call gets an equal slice of the chart.** The chart uses a log scale and straight segments.
- **Today's crowd split is hidden until you finish,** so nobody can use it to game the payout.
- **Dev plays are tagged `dev`** and never count toward the real crowd or the public stats.

## Blocked on you

Nothing. (`docs/blocked.md` doesn't exist because nothing was blocked.)

## What I would improve next

Kept current at the end of the night.
