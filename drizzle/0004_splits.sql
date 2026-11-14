CREATE TABLE "splits" (
	"ticker" text NOT NULL,
	"ts" date NOT NULL,
	"factor" double precision NOT NULL,
	CONSTRAINT "splits_ticker_ts_pk" PRIMARY KEY("ticker","ts")
);
