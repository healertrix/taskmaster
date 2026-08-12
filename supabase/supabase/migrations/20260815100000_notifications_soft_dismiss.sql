-- Dismiss used to be a hard DELETE (see app/api/notifications/[id]/route.ts,
-- pre-this-migration) — a single unconfirmed click on the X permanently
-- erased the row, unlike every mainstream app's notification history (Slack,
-- Linear, GitHub, Gmail-style archive) which never deletes on a plain
-- "clear this" action. This adds a soft-delete column so dismiss can hide a
-- notification from the lists without destroying it.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

-- Every list query (GET /api/notifications) filters WHERE dismissed_at IS
-- NULL, so this keeps that filter cheap as the table grows.
CREATE INDEX IF NOT EXISTS notifications_profile_dismissed_idx
  ON notifications (profile_id, dismissed_at);
