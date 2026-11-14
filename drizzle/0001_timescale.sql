-- TimescaleDB objects. Drizzle does not generate these, so they are hand-written.

-- prices: daily bars for ~100 tickers going back decades. One chunk per year,
-- compressed into the columnstore, segmented by ticker so a single ticker's
-- window decompresses only its own segment.
SELECT create_hypertable('prices', by_range('ts', INTERVAL '1 year'));
--> statement-breakpoint
ALTER TABLE prices SET (
	timescaledb.enable_columnstore = true,
	timescaledb.segmentby = 'ticker',
	timescaledb.orderby = 'ts'
);
--> statement-breakpoint
CALL add_columnstore_policy('prices', after => INTERVAL '60 days');
--> statement-breakpoint

-- guesses: one row per call, partitioned by day.
SELECT create_hypertable('guesses', by_range('ts', INTERVAL '1 day'));
--> statement-breakpoint
ALTER TABLE guesses SET (
	timescaledb.enable_columnstore = true,
	timescaledb.segmentby = 'puzzle_number',
	timescaledb.orderby = 'ts DESC'
);
--> statement-breakpoint
CALL add_columnstore_policy('guesses', after => INTERVAL '7 days');
--> statement-breakpoint

-- crowd_hourly: the crowd split for every call of every puzzle, per hour.
-- Real-time (materialized_only = false), so the newest calls count immediately.
-- Feeds the crowd payout and the live stats page.
CREATE MATERIALIZED VIEW crowd_hourly
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT
	time_bucket(INTERVAL '1 hour', ts) AS bucket,
	puzzle_number,
	step,
	source,
	count(*) AS calls,
	count(*) FILTER (WHERE up) AS ups,
	count(*) FILTER (WHERE correct) AS correct,
	sum(stake_cents) AS staked_cents,
	sum(delta_cents) AS delta_cents
FROM guesses
GROUP BY bucket, puzzle_number, step, source
WITH NO DATA;
--> statement-breakpoint
SELECT add_continuous_aggregate_policy('crowd_hourly',
	start_offset => INTERVAL '3 days',
	end_offset => INTERVAL '1 minute',
	schedule_interval => INTERVAL '1 minute');
