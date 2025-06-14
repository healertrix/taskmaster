import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/profiles/search - Search profiles by name or email
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const workspaceId = searchParams.get('workspace_id');

    console.log('Search API called with:', { query, workspaceId });

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Get current user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      console.log('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;
    console.log('Current user:', user.id);

    // If workspace_id is provided, check if user has permission to add members
    if (workspaceId) {
      const { data: membership, error: membershipError } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('profile_id', user.id)
        .single();

      console.log('User membership:', membership, membershipError);

      if (membershipError || !membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Check if user has permission to add members (owner or admin)
      if (membership.role !== 'admin' && membership.role !== 'owner') {
        return NextResponse.json(
          { error: 'Insufficient permissions to search for members' },
          { status: 403 }
        );
      }
    }

    console.log('Starting profile search with regular client...');

    // Try multiple search approaches
    let allProfiles: any[] = [];

    // First try: Search by email
    console.log('Searching by email...');
    const { data: emailProfiles, error: emailError } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .ilike('email', `%${query}%`)
      .limit(10);

    console.log('Email search result:', { emailProfiles, emailError });

    if (!emailError && emailProfiles) {
      allProfiles.push(...emailProfiles);
    }

    // Second try: Search by name (only if email search didn't find enough)
    if (allProfiles.length < 5) {
      console.log('Searching by name...');
      const { data: nameProfiles, error: nameError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .ilike('full_name', `%${query}%`)
        .limit(10);

      console.log('Name search result:', { nameProfiles, nameError });

      if (!nameError && nameProfiles) {
        // Avoid duplicates
        const existingIds = allProfiles.map((p) => p.id);
        const newProfiles = nameProfiles.filter(
          (p) => !existingIds.includes(p.id)
        );
        allProfiles.push(...newProfiles);
      }
    }

    // Third try: Combined OR search as fallback
    if (allProfiles.length === 0) {
      console.log('Trying combined OR search...');
      const { data: combinedProfiles, error: combinedError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(15);

      console.log('Combined search result:', {
        combinedProfiles,
        combinedError,
      });

      if (!combinedError && combinedProfiles) {
        allProfiles = combinedProfiles;
      }
    }

    console.log('Final profiles before filtering:', allProfiles);

    // If workspace_id is provided, filter out users who are already members
    let filteredProfiles = allProfiles;

    if (workspaceId && allProfiles && allProfiles.length > 0) {
      const profileIds = allProfiles.map((p) => p.id);

      const { data: existingMembers, error: membersError } = await supabase
        .from('workspace_members')
        .select('profile_id')
        .eq('workspace_id', workspaceId)
        .in('profile_id', profileIds);

      console.log('Existing members check:', { existingMembers, membersError });

      if (!membersError && existingMembers) {
        const existingMemberIds = existingMembers.map((m) => m.profile_id);
        filteredProfiles = allProfiles.filter(
          (p) => !existingMemberIds.includes(p.id)
        );
        console.log(
          'Filtered profiles (removed existing members):',
          filteredProfiles
        );
      }
    }

    const response = {
      profiles: filteredProfiles.map((profile) => ({
        id: profile.id,
        name: profile.full_name || 'No name set',
        email: profile.email,
        avatar_url: profile.avatar_url,
      })),
    };

    console.log('API Response:', response);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/profiles/search:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
