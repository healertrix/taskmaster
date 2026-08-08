-- @ mentions in card comments.
--
-- The schema doc (project details/database_structure.txt) already
-- documents a `mentions` JSONB column on `comments`, but no migration in
-- this repo actually creates it — treating it as unconfirmed and adding it
-- defensively here (idempotent, safe to run whether or not it already
-- exists).
--
-- Shape stored: a JSON array of the mentioned profiles, e.g.
--   [{ "id": "<profile uuid>", "full_name": "Jane Doe" }, ...]
-- Denormalizing full_name alongside the id means a mention still renders
-- correctly even if the mentioned user later renames themselves — matches
-- how a mention should read as "who I tagged at the time," not "whoever
-- currently owns this id."

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS mentions jsonb NOT NULL DEFAULT '[]'::jsonb;
