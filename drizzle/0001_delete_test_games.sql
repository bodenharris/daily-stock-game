-- Games used to be tagged 'real' or 'dev' so test plays against the shared database stayed out of
-- the crowd. Local dev, previews and production now each have their own database, so the tag is
-- gone from the app. Delete the old test games (their guesses go with them) so they never count.
-- The now-unused column is dropped in the next migration, once no deployed code reads it.
DELETE FROM "games" WHERE "source" = 'dev';
