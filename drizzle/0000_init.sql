CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"puzzle_number" integer NOT NULL,
	"puzzle_slug" text NOT NULL,
	"step" smallint DEFAULT 0 NOT NULL,
	"balance_cents" integer NOT NULL,
	"archetype" text,
	"bonus_correct" smallint,
	"bonus_total" smallint,
	"source" text DEFAULT 'real' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "games_user_puzzle_unique" UNIQUE("user_id","puzzle_number")
);
--> statement-breakpoint
CREATE TABLE "guesses" (
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"game_id" uuid NOT NULL,
	"puzzle_number" integer NOT NULL,
	"step" smallint NOT NULL,
	"up" boolean NOT NULL,
	"stake_bp" smallint NOT NULL,
	"stake_cents" integer NOT NULL,
	"crowd_up_share" real NOT NULL,
	"multiplier" real NOT NULL,
	"correct" boolean NOT NULL,
	"delta_cents" integer NOT NULL,
	"balance_after_cents" integer NOT NULL,
	"source" text DEFAULT 'real' NOT NULL,
	CONSTRAINT "guesses_game_id_step_ts_pk" PRIMARY KEY("game_id","step","ts")
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"ticker" text NOT NULL,
	"ts" date NOT NULL,
	"open" double precision NOT NULL,
	"high" double precision NOT NULL,
	"low" double precision NOT NULL,
	"close" double precision NOT NULL,
	"volume" bigint NOT NULL,
	CONSTRAINT "prices_ticker_ts_pk" PRIMARY KEY("ticker","ts")
);
--> statement-breakpoint
CREATE TABLE "puzzles" (
	"slug" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"ticker" text NOT NULL,
	"company" text NOT NULL,
	"headline" text NOT NULL,
	"story" text NOT NULL,
	"last_context_date" date NOT NULL,
	"context_bars" integer NOT NULL,
	"step_bars" integer NOT NULL,
	"calls" smallint NOT NULL,
	CONSTRAINT "puzzles_position_unique" UNIQUE("position")
);
--> statement-breakpoint
CREATE TABLE "tickers" (
	"symbol" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"first_date" date,
	"last_date" date,
	"bars" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_anonymous" boolean DEFAULT false,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_puzzle_slug_puzzles_slug_fk" FOREIGN KEY ("puzzle_slug") REFERENCES "public"."puzzles"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guesses" ADD CONSTRAINT "guesses_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "puzzles" ADD CONSTRAINT "puzzles_ticker_tickers_symbol_fk" FOREIGN KEY ("ticker") REFERENCES "public"."tickers"("symbol") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "games_puzzle_finished_idx" ON "games" USING btree ("puzzle_number","finished_at");--> statement-breakpoint
CREATE INDEX "guesses_puzzle_step_ts_idx" ON "guesses" USING btree ("puzzle_number","step","ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");