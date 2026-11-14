CREATE TABLE "schedule" (
	"number" integer PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "bonus_guesses" boolean[];--> statement-breakpoint
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_slug_puzzles_slug_fk" FOREIGN KEY ("slug") REFERENCES "public"."puzzles"("slug") ON DELETE no action ON UPDATE no action;