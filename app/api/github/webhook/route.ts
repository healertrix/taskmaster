import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/service';
import { verifyGithubWebhookSignature } from '@/utils/github/verifyWebhook';
import {
  parseCardReferences,
  parseCloseDirectives,
} from '@/utils/github/parseReferences';
import {
  resolveCardByNumber,
  moveCardToDoneList,
} from '@/utils/github/resolveAndMoveCard';

// POST /api/github/webhook - receives every subscribed GitHub App event
// (push, pull_request, issue_comment, pull_request_review_comment,
// installation, installation_repositories). Processed synchronously,
// in-request (no job queue — see design conversation: realistic event
// volumes are small, and this is a v1 tradeoff, not a permanent one).
//
// Uses the service-role Supabase client throughout: there's no user
// session on a webhook delivery, so RLS can't be satisfied the normal way.
export async function POST(request: NextRequest) {
  // Signature verification needs the exact raw bytes GitHub signed — must
  // read as text BEFORE any JSON parsing.
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  let verified: boolean;
  try {
    verified = verifyGithubWebhookSignature(rawBody, signature);
  } catch (error) {
    console.error('GitHub webhook signature check failed to run:', error);
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  if (!verified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = request.headers.get('x-github-event');
  const payload = JSON.parse(rawBody);
  const supabase = createServiceClient();

  try {
    switch (event) {
      case 'ping':
        // Sent once when the webhook is first created — just confirms the
        // URL + secret are wired up correctly.
        break;

      case 'installation':
        await handleInstallationEvent(supabase, payload);
        break;

      case 'installation_repositories':
        await handleInstallationRepositoriesEvent(supabase, payload);
        break;

      case 'push':
        await handlePushEvent(supabase, payload);
        break;

      case 'pull_request':
        await handlePullRequestEvent(supabase, payload);
        break;

      case 'issue_comment':
        await handleIssueCommentEvent(supabase, payload);
        break;

      case 'pull_request_review_comment':
        await handlePullRequestReviewCommentEvent(supabase, payload);
        break;

      default:
        // Unsubscribed event type somehow reaching us — ignore, not an error.
        break;
    }
  } catch (error) {
    // Never surface a 500 for a processing error we can diagnose from logs
    // — GitHub will keep retrying a failing webhook and can eventually
    // disable it after enough consecutive failures. A malformed/edge-case
    // payload shouldn't take the whole integration offline.
    console.error(`Error processing GitHub webhook event "${event}":`, error);
  }

  return NextResponse.json({ received: true });
}

// ── Repo lookup ─────────────────────────────────────────────────────────

async function findConnectedRepo(supabase: any, githubRepoId: number) {
  const { data } = await supabase
    .from('github_repos')
    .select('id, workspace_id, installation_id')
    .eq('github_repo_id', githubRepoId)
    .maybeSingle();
  return data as { id: string; workspace_id: string; installation_id: string } | null;
}

async function getInstallationActor(supabase: any, installationRowId: string) {
  const { data } = await supabase
    .from('github_installations')
    .select('connected_by_profile_id')
    .eq('id', installationRowId)
    .maybeSingle();
  return (data?.connected_by_profile_id as string | null) ?? null;
}

// ── Link upsert ──────────────────────────────────────────────────────────
// Omitting a field (vs. passing null) matters here: Supabase's upsert only
// SETs the columns present in the object on conflict, so a comment-driven
// touch that doesn't know the PR's title/status won't clobber values a
// more authoritative `pull_request` event already wrote.

async function upsertCardLink(
  supabase: any,
  params: {
    cardId: string;
    repoId: string;
    linkType: 'commit' | 'pull_request';
    externalId: string;
    url: string;
    title?: string;
    authorLogin?: string | null;
    authorAvatarUrl?: string | null;
    status?: string | null;
  }
) {
  const row: Record<string, unknown> = {
    card_id: params.cardId,
    repo_id: params.repoId,
    link_type: params.linkType,
    external_id: params.externalId,
    url: params.url,
    updated_at: new Date().toISOString(),
  };
  if (params.title !== undefined) row.title = params.title;
  if (params.authorLogin !== undefined) row.author_login = params.authorLogin;
  if (params.authorAvatarUrl !== undefined)
    row.author_avatar_url = params.authorAvatarUrl;
  if (params.status !== undefined) row.status = params.status;

  const { error } = await supabase
    .from('card_github_links')
    .upsert(row, { onConflict: 'card_id,repo_id,link_type,external_id' });
  if (error) console.error('Failed to upsert card_github_links row:', error);
}

// ── Event handlers ───────────────────────────────────────────────────────

async function handleInstallationEvent(supabase: any, payload: any) {
  if (payload.action !== 'deleted') return;
  // Cascades to github_repos and card_github_links via FK ON DELETE CASCADE.
  await supabase
    .from('github_installations')
    .delete()
    .eq('installation_id', payload.installation.id);
}

async function handleInstallationRepositoriesEvent(supabase: any, payload: any) {
  const { data: installation } = await supabase
    .from('github_installations')
    .select('id, workspace_id')
    .eq('installation_id', payload.installation.id)
    .maybeSingle();
  if (!installation) return;

  if (payload.action === 'added') {
    for (const repo of payload.repositories_added || []) {
      const { error } = await supabase.from('github_repos').insert({
        installation_id: installation.id,
        workspace_id: installation.workspace_id,
        github_repo_id: repo.id,
        full_name: repo.full_name,
      });
      // A unique-violation here means this repo is already connected to a
      // DIFFERENT workspace (github_repo_id is globally unique) — the
      // admin granted it on GitHub's install screen, but taskmaster can't
      // honor it. No user to show an error to from a webhook, so just log
      // it; the settings UI's repo list simply won't show this repo.
      if (error && error.code !== '23505') {
        console.error('Failed to add repo from installation_repositories:', error);
      }
    }
  } else if (payload.action === 'removed') {
    const removedIds = (payload.repositories_removed || []).map((r: any) => r.id);
    if (removedIds.length > 0) {
      await supabase.from('github_repos').delete().in('github_repo_id', removedIds);
    }
  }
}

async function handlePushEvent(supabase: any, payload: any) {
  const repo = await findConnectedRepo(supabase, payload.repository.id);
  if (!repo) return;

  for (const commit of payload.commits || []) {
    const refs = parseCardReferences(commit.message || '');
    if (refs.length === 0) continue;

    for (const ref of refs) {
      const card = await resolveCardByNumber(
        supabase,
        repo.workspace_id,
        ref.boardNumber,
        ref.cardNumber
      );
      if (!card) continue;

      await upsertCardLink(supabase, {
        cardId: card.id,
        repoId: repo.id,
        linkType: 'commit',
        externalId: commit.id,
        url: commit.url,
        title: (commit.message || '').split('\n')[0].slice(0, 500),
        authorLogin: commit.author?.username || commit.author?.name || null,
      });
    }
  }
}

async function handlePullRequestEvent(supabase: any, payload: any) {
  const repo = await findConnectedRepo(supabase, payload.repository.id);
  if (!repo) return;

  const pr = payload.pull_request;
  const text = `${pr.title || ''}\n${pr.body || ''}`;
  const refs = parseCardReferences(text);
  const status = pr.merged ? 'merged' : pr.state === 'open' ? 'open' : 'closed';

  for (const ref of refs) {
    const card = await resolveCardByNumber(
      supabase,
      repo.workspace_id,
      ref.boardNumber,
      ref.cardNumber
    );
    if (!card) continue;

    await upsertCardLink(supabase, {
      cardId: card.id,
      repoId: repo.id,
      linkType: 'pull_request',
      externalId: String(pr.number),
      url: pr.html_url,
      title: pr.title,
      authorLogin: pr.user?.login || null,
      authorAvatarUrl: pr.user?.avatar_url || null,
      status,
    });
  }

  // The move-to-done automation: PR-merge only (payload.action === 'closed'
  // AND pr.merged === true — a closed-without-merge PR never triggers it).
  // Directives are scanned from title+body only, matching GitHub's own
  // native "closes #123" issue-linking behavior, which also only looks at
  // the PR body/title and never at comments.
  if (payload.action === 'closed' && pr.merged) {
    const directives = parseCloseDirectives(text);
    if (directives.length > 0) {
      const actorProfileId = await getInstallationActor(supabase, repo.installation_id);
      for (const directive of directives) {
        const card = await resolveCardByNumber(
          supabase,
          repo.workspace_id,
          directive.boardNumber,
          directive.cardNumber
        );
        if (!card) continue;

        await moveCardToDoneList(supabase, {
          card,
          overrideListName: directive.overrideListName,
          actorProfileId,
          prUrl: pr.html_url,
          prTitle: pr.title,
        });
      }
    }
  }
}

async function handleIssueCommentEvent(supabase: any, payload: any) {
  // issue_comment fires for comments on plain issues too, not just PRs —
  // only PR comments are in scope here.
  if (!payload.issue?.pull_request) return;

  const repo = await findConnectedRepo(supabase, payload.repository.id);
  if (!repo) return;

  const refs = parseCardReferences(payload.comment?.body || '');
  if (refs.length === 0) return;

  for (const ref of refs) {
    const card = await resolveCardByNumber(
      supabase,
      repo.workspace_id,
      ref.boardNumber,
      ref.cardNumber
    );
    if (!card) continue;

    await upsertCardLink(supabase, {
      cardId: card.id,
      repoId: repo.id,
      linkType: 'pull_request',
      externalId: String(payload.issue.number),
      url: payload.issue.pull_request.html_url || payload.issue.html_url,
      title: payload.issue.title,
      status: payload.issue.state === 'closed' ? 'closed' : 'open',
    });
  }
}

async function handlePullRequestReviewCommentEvent(supabase: any, payload: any) {
  const repo = await findConnectedRepo(supabase, payload.repository.id);
  if (!repo) return;

  const refs = parseCardReferences(payload.comment?.body || '');
  if (refs.length === 0) return;

  const pr = payload.pull_request;
  const status = pr.merged ? 'merged' : pr.state === 'open' ? 'open' : 'closed';

  for (const ref of refs) {
    const card = await resolveCardByNumber(
      supabase,
      repo.workspace_id,
      ref.boardNumber,
      ref.cardNumber
    );
    if (!card) continue;

    await upsertCardLink(supabase, {
      cardId: card.id,
      repoId: repo.id,
      linkType: 'pull_request',
      externalId: String(pr.number),
      url: pr.html_url,
      title: pr.title,
      status,
    });
  }
}
