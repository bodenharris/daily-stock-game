-- "Name it" guess. Games that existed before this step count as skipped (''), so nobody who
-- has already seen today's reveal is asked afterwards; new games start at null (not answered).
ALTER TABLE "games" ADD COLUMN "name_guess" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "name_guess" DROP DEFAULT;
