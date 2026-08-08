-- Fixes "cannot cast type jsonb to uuid" on comment creation.
--
-- The previous migration (20260808100000_add_comment_mentions.sql) used
-- ADD COLUMN IF NOT EXISTS, which is a no-op if the column already
-- exists — it does NOT change its type. `comments.mentions` turned out to
-- already exist with some other type (uuid, going by the error), a
-- leftover from whatever originally matched the schema doc's description
-- — so every insert of a JSON array into it failed.
--
-- Since this column has never been read or written by any application
-- code until this feature, it's safe to just reset it to the correct
-- type and drop whatever was in it (nothing meaningful was ever stored
-- there).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments'
      AND column_name = 'mentions'
      AND data_type <> 'jsonb'
  ) THEN
    ALTER TABLE comments ALTER COLUMN mentions DROP DEFAULT;
    ALTER TABLE comments ALTER COLUMN mentions DROP NOT NULL;
    ALTER TABLE comments
      ALTER COLUMN mentions TYPE jsonb USING '[]'::jsonb;
    ALTER TABLE comments ALTER COLUMN mentions SET DEFAULT '[]'::jsonb;
    ALTER TABLE comments ALTER COLUMN mentions SET NOT NULL;
  END IF;
END $$;
