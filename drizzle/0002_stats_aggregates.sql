-- Aggregates behind the live stats page.

-- crowd_daily: a hierarchical continuous aggregate rolled up from crowd_hourly.
-- One row per day, puzzle, call and source. Cheap history for the stats page.
CREATE MATERIALIZED VIEW crowd_daily
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT
	time_bucket(INTERVAL '1 day', bucket) AS day,
	puzzle_number,
	step,
	source,
	sum(calls) AS calls,
	sum(ups) AS ups,
	sum(correct) AS correct,
	sum(staked_cents) AS staked_cents,
	sum(delta_cents) AS delta_cents
FROM crowd_hourly
GROUP BY day, puzzle_number, step, source
WITH NO DATA;
--> statement-breakpoint
SELECT add_continuous_aggregate_policy('crowd_daily',
	start_offset => INTERVAL '7 days',
	end_offset => INTERVAL '1 hour',
	schedule_interval => INTERVAL '5 minutes');
--> statement-breakpoint

-- finals_hourly: how games end. Built on the last call of each game (step 5), with a
-- Toolkit percentile sketch so the median and percentiles of final balances can be read
-- (and rolled up across any time range) without scanning games.
CREATE MATERIALIZED VIEW finals_hourly
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT
	time_bucket(INTERVAL '1 hour', ts) AS bucket,
	puzzle_number,
	source,
	count(*) AS games,
	sum(balance_after_cents) AS balance_sum_cents,
	count(*) FILTER (WHERE balance_after_cents > 10000) AS in_profit,
	min(balance_after_cents) AS worst_cents,
	max(balance_after_cents) AS best_cents,
	percentile_agg(balance_after_cents::double precision) AS balance_pct
FROM guesses
WHERE step = 5
GROUP BY bucket, puzzle_number, source
WITH NO DATA;
--> statement-breakpoint
SELECT add_continuous_aggregate_policy('finals_hourly',
	start_offset => INTERVAL '3 days',
	end_offset => INTERVAL '1 minute',
	schedule_interval => INTERVAL '1 minute');
