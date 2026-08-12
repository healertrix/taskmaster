-- GitHub integration: one GitHub App installation per workspace, one repo
-- ever connected to one workspace, and per-card links to commits/PRs that
-- mention that card's #board-card id (see utils/github/parseReferences.ts).
--
-- Design decisions this schema encodes (from the design conversation):
--   - One workspace <-> one GitHub App installation (github_installations).
--   - One repo can only ever belong to one workspace, enforced by the
--     UNIQUE constraint on github_repos.github_repo_id — a second
--     workspace's admin trying to connect an already-connected repo gets
--     rejected in app code with a clear error before it'd ever hit this
--     constraint.
--   - card_github_links is a pure read-only mirror of GitHub activity: it
--     never drives anything by itself. The merge-triggered "move to done"
--     automation acts on the card directly (list_id/position), the same
--     way a human drag-and-drop or the existing /cards/[id]/move route
--     does — this table is just what powers the card's "Development" panel.

BEGIN;

CREATE TABLE IF NOT EXISTS github_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  installation_id bigint NOT NULL UNIQUE,
  account_login text NOT NULL,
  account_type text NOT NULL, -- 'User' | 'Organization', as reported by GitHub
  -- Who ran the install flow. Nullable (ON DELETE SET NULL) since a profile
  -- can be deleted later — automated, webhook-triggered card moves are
  -- attributed to this profile (see utils/github/moveCardToDoneList.ts)
  -- because activities.profile_id / notifications require a real actor;
  -- if this is null by the time an automation fires, the activity/
  -- notification side of the move is just skipped (best-effort, same
  -- try/catch convention already used for activity logging everywhere
  -- else in this app) while the card move itself still happens.
  connected_by_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS github_repos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid NOT NULL REFERENCES github_installations(id) ON DELETE CASCADE,
  -- Denormalized alongside installation_id so every query that needs "repos
  -- for this workspace" (the settings UI, RLS policies below) doesn't have
  -- to join through github_installations every time.
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  github_repo_id bigint NOT NULL UNIQUE, -- enforces one-repo-one-workspace
  full_name text NOT NULL, -- "owner/repo", for display
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS card_github_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  repo_id uuid NOT NULL REFERENCES github_repos(id) ON DELETE CASCADE,
  link_type text NOT NULL CHECK (link_type IN ('commit', 'pull_request')),
  -- Commit SHA, or PR number (as text) — together with link_type + repo_id
  -- + card_id this is what the webhook handler upserts on, so redelivered
  -- GitHub events (it retries on failure) don't create duplicate rows.
  external_id text NOT NULL,
  url text NOT NULL,
  title text, -- commit message first line, or PR title
  author_login text,
  author_avatar_url text,
  -- PRs only: 'open' | 'merged' | 'closed'. Null for commits — a commit
  -- doesn't have a lifecycle the way a PR does.
  status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, repo_id, link_type, external_id)
);

CREATE INDEX IF NOT EXISTS github_repos_workspace_idx ON github_repos (workspace_id);
CREATE INDEX IF NOT EXISTS card_github_links_card_idx ON card_github_links (card_id);

ALTER TABLE github_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_github_links ENABLE ROW LEVEL SECURITY;

-- Reads: any workspace member can see the installation/repos/links for
-- workspaces they belong to (same "member can view" bar as everything
-- else in this app — this is metadata about what's connected, not
-- sensitive per se). Writes are NOT covered by policy here on purpose:
-- the webhook handler and the install callback both use the Supabase
-- service-role key (bypasses RLS entirely) since neither runs with a
-- normal user session — see utils/supabase/service.ts.

DO $$ BEGIN
  CREATE POLICY github_installations_select_member ON github_installations
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = github_installations.workspace_id
          AND wm.profile_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY github_repos_select_member ON github_repos
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = github_repos.workspace_id
          AND wm.profile_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY card_github_links_select_member ON card_github_links
    FOR SELECT USING (
      EXISTS (
        SELECT 1
        FROM cards c
        JOIN lists l ON l.id = c.list_id
        JOIN boards b ON b.id = l.board_id
        JOIN workspace_members wm ON wm.workspace_id = b.workspace_id
        WHERE c.id = card_github_links.card_id
          AND wm.profile_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
