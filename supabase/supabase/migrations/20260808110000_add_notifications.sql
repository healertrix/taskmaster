-- Notifications: mentions + assigned-task updates.
--
-- Two-tier by design (see conversation): a `mention` is the one type meant
-- to stand out as higher priority in the UI (you were specifically
-- tagged); the rest (`comment`, `due_date_changed`, `moved_list`) are
-- normal-priority. Everything else that happens on a card (checklists,
-- labels, attachments, member changes) intentionally does NOT create a
-- notification row — it's still visible in the existing `activities` feed,
-- it just doesn't ping anyone, to avoid the "too much notif" problem.
--
-- The schema doc (project details/database_structure.txt) already
-- described a `notifications` table, but — same situation as
-- comments.mentions — no migration in this repo ever actually created it.
-- This is the real, new table.

BEGIN;

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('mention', 'comment', 'due_date_changed', 'moved_list')),
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  card_id uuid REFERENCES cards(id) ON DELETE CASCADE,
  board_id uuid REFERENCES boards(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES comments(id) ON DELETE SET NULL,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_profile_unread_idx
  ON notifications (profile_id, is_read, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- A recipient only ever sees/manages their own notifications.
DO $$ BEGIN
  CREATE POLICY notifications_select_own ON notifications
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY notifications_update_own ON notifications
    FOR UPDATE TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY notifications_delete_own ON notifications
    FOR DELETE TO authenticated
    USING (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Insert is inherently cross-user (A comments, B gets notified) — the app
-- routes that create these rows already gate on real board/workspace
-- access before ever reaching this insert (same trust level the existing
-- `activities` table already operates at: any authenticated request can
-- write one, access control happens upstream in the API route, not here).
DO $$ BEGIN
  CREATE POLICY notifications_insert_authenticated ON notifications
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
