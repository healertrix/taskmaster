-- AI features: BYOK provider keys + the global AI chat's message log.
--
-- 1. `ai_provider_keys` — one row per (profile, provider), the API key
--    itself stored as ciphertext only (encrypted app-side via
--    utils/ai/encryption.ts, AES-256-GCM, key from the server-only
--    AI_KEY_ENCRYPTION_SECRET env var — this table never sees plaintext).
--    A user can hold a key for both providers but only one is ever
--    "active" — enforced at the DB level with a partial unique index, not
--    just app logic, and flipped atomically via set_active_ai_provider()
--    (mirrors the next_card_number() RPC pattern already used elsewhere
--    for atomic per-user/per-board state).
--
-- 2. `ai_chat_messages` — the persisted, single-continuous-per-user log
--    for the global "create a task by chatting" widget. message_type
--    distinguishes plain text from the two special turns the UI renders
--    differently: 'resolve_prompt' (bot asks which workspace/board, no
--    LLM call involved) and 'confirmation' (task was created, links to
--    it). resolved_workspace_id/resolved_board_id are stamped on every
--    row where context was actually pinned down — the chat route reads
--    the most recent non-null resolved_board_id as the "carry over from
--    last time" fallback when a new message doesn't specify one itself.

BEGIN;

CREATE TABLE IF NOT EXISTS ai_provider_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('openai', 'deepseek')),
  encrypted_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, provider)
);

-- At most one active provider per user, enforced by the DB itself.
CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_keys_one_active_per_profile
  ON ai_provider_keys (profile_id) WHERE is_active;

ALTER TABLE ai_provider_keys ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY ai_provider_keys_select_own ON ai_provider_keys
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY ai_provider_keys_insert_own ON ai_provider_keys
    FOR INSERT TO authenticated
    WITH CHECK (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY ai_provider_keys_update_own ON ai_provider_keys
    FOR UPDATE TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY ai_provider_keys_delete_own ON ai_provider_keys
    FOR DELETE TO authenticated
    USING (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Atomically makes `p_provider` the caller's one active provider. Requires
-- a key to already exist for that provider (the app always saves the key
-- first, then activates it). SECURITY DEFINER so it can update the
-- previously-active row even though RLS's own USING clause would already
-- allow it here (auth.uid() = profile_id throughout) — kept consistent
-- with the next_card_number()-style RPCs for atomicity, not because RLS
-- would otherwise block it.
CREATE OR REPLACE FUNCTION set_active_ai_provider(p_provider text)
RETURNS void AS $$
BEGIN
  IF p_provider NOT IN ('openai', 'deepseek') THEN
    RAISE EXCEPTION 'Invalid provider: %', p_provider;
  END IF;

  UPDATE ai_provider_keys
  SET is_active = false, updated_at = now()
  WHERE profile_id = auth.uid() AND is_active = true AND provider != p_provider;

  UPDATE ai_provider_keys
  SET is_active = true, updated_at = now()
  WHERE profile_id = auth.uid() AND provider = p_provider;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No % key saved for this user', p_provider;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  message_type text NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'resolve_prompt', 'confirmation')),
  content text NOT NULL,
  metadata jsonb,
  resolved_workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  resolved_board_id uuid REFERENCES boards(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_chat_messages_profile_created_idx
  ON ai_chat_messages (profile_id, created_at);

ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Log-only table: read your own history, and insert new rows as yourself
-- (the API route inserts both the user's turn and the assistant's turn,
-- always with profile_id = the signed-in caller — there's no separate
-- "assistant" identity). No update/delete policy; it's an append-only log.
DO $$ BEGIN
  CREATE POLICY ai_chat_messages_select_own ON ai_chat_messages
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY ai_chat_messages_insert_own ON ai_chat_messages
    FOR INSERT TO authenticated
    WITH CHECK (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
