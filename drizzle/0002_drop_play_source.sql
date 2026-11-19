-- Nothing has read or written this column since 0001: every deployed version relies on its default.
ALTER TABLE "games" DROP COLUMN "source";
