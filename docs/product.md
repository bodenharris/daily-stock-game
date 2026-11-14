# Product context

## What we're building
A daily trading game for the web, in the spirit of Wordle: one puzzle a day, a minute to play, a result worth sharing. Built by a team of 3–4 at HackUMass XIV.

Working name and domain are not final. Keep the name in one config constant.

It will be judged by people playing it live on their phones, from a public GitHub repo.

## Goals, in order
1. Win MLH "Best Use of Tiger Data". Judged on the most innovative, impactful and performance-driven use.
2. A game people share after the hackathon.
3. Also entering: Best Domain Name (GoDaddy Registry), Best Use of Vultr, and one HackUMass category (Best UI/UX).

## The game
- One hidden real price chart per day, picked from famous market moments. The ticker and dates stay hidden until the end.
- The player makes five up-or-down calls on what the chart does next. Each call reveals the next stretch of the chart.
- The player starts with $100 and stakes part of it on each call (max 50% of the current balance). Winnings compound.
- A correct call pays more when most players called the other way.
- At the end: the chart is unmasked (ticker, dates, what happened), with the final balance, an emoji share grid that spoils nothing, and an archetype label such as "The Contrarian".
- Optional bonus round, "Real or Random": is this chart real or generated?

Known design risk: a single up/down call is close to a coin flip. Stake sizing and the crowd payout have to carry the skill, so they matter more than anything else in the design.

Not yet decided: how long each call's stretch is, the exact payout formula, what the crowd payout does before enough people have played, the archetype list, and which puzzles ship. About 30 hand-picked puzzles should be preloaded.

## Stack
- SvelteKit with `@sveltejs/adapter-node`. Mobile first.
- Tiger Data (PostgreSQL + TimescaleDB) is the only database.
- Drizzle ORM. Use `generate` + `migrate`, never `push`.
- Better Auth, email and password. Add the anonymous plugin so people can play before signing up; an account saves the streak.
- Tiingo for daily price history. Loaded once into the database by a script; the app never calls Tiingo at runtime. Store split-adjusted prices.
- Hosting: one Vultr Ubuntu server, Caddy in front, app run by systemd, deployed by GitHub Actions on push to `main`.

## How the database should earn the Tiger prize
- `prices` hypertable: daily bars for about 100 tickers, with compression.
- `guesses` hypertable: one row per call.
- A continuous aggregate for the crowd split on each call. This feeds the payout and the stats.
- Users, sessions and puzzles as ordinary tables in the same database (relational and time-series data together).
- A public live stats page built on the aggregates.

TimescaleDB rules:
- A hypertable's primary key must include the time column, e.g. `(ticker, ts)`.
- Hypertables, continuous aggregates and compression go in hand-written SQL migrations (`drizzle-kit generate --custom`). Drizzle does not generate them.
- Auth tables stay ordinary tables.
- Continuous aggregates are not yet confirmed to work on our plan. Check before building on them.

## Environment variables
`DATABASE_URL` (keep `sslmode=require`), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TIINGO_API_KEY`, and `ORIGIN` in production.

## Rules
- The repo is public. Never commit `.env` or any secret, and never print one in logs.
- Do not drop or reset the database. It is shared by the whole team.
- Do not change the server, DNS, or any paid service.

## Known risks
- Tiingo's free plan is licensed for internal use only, not public display. Accepted for the hackathon demo; needs a display license or another source if the game continues.
- Similar games exist (Bulliq, Trader Rush, Chart Duels). The crowd payout, the reveal and the share card are what set this one apart.
