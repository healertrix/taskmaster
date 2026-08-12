import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// GET /api/cards/[id]/github-links - commits/PRs linked to this card via
// #board-card mentions in GitHub (see app/api/github/webhook/route.ts for
// how these get created). Powers the card modal's "Development" panel.
// RLS (card_github_links_select_member) already scopes this to cards the
// caller's workspace membership covers.
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cardId = params.id;
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: links, error } = await supabase
    .from('card_github_links')
    .select(
      `
      id,
      link_type,
      external_id,
      url,
      title,
      author_login,
      author_avatar_url,
      status,
      created_at,
      github_repos:repo_id ( full_name )
    `
    )
    .eq('card_id', cardId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching card GitHub links:', error);
    return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
  }

  return NextResponse.json({ links: links || [] });
}
