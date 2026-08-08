-- Lets the board owner/members decide which list(s) count as "done",
-- instead of always assuming the rightmost list. More than one list on a
-- board can be marked — e.g. both "Done" and "Archive" — a card in either
-- counts as completed.
--
-- Backward compatible on purpose: a board where nobody has marked
-- anything (every is_done_list is false) falls back to the old
-- "rightmost list" heuristic in application code
-- (app/api/dashboard/my-tasks/route.ts) — existing boards don't suddenly
-- report zero completed tasks just because this migration ran.

ALTER TABLE lists
  ADD COLUMN IF NOT EXISTS is_done_list boolean NOT NULL DEFAULT false;
