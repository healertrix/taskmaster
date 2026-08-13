import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/utils/ai/encryption';

const PROVIDERS = ['openai', 'deepseek'] as const;
type Provider = (typeof PROVIDERS)[number];

// GET /api/ai/keys - which providers this user has a key saved for, and
// which one is active. Never returns the decrypted key — only Settings'
// hasKey/isActive booleans, so the key is never round-tripped back to the
// client after it's saved.
export async function GET() {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('ai_provider_keys')
      .select('provider, is_active, updated_at')
      .eq('profile_id', user.id);

    if (error) {
      console.error('Error fetching AI provider keys:', error);
      return NextResponse.json(
        { error: 'Failed to fetch keys' },
        { status: 500 }
      );
    }

    const stored = new Map((data || []).map((row) => [row.provider, row]));
    const keys = PROVIDERS.map((provider) => {
      const row = stored.get(provider);
      return {
        provider,
        hasKey: !!row,
        isActive: row?.is_active || false,
        updatedAt: row?.updated_at || null,
      };
    });

    return NextResponse.json({ keys });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/ai/keys - save/replace the key for one provider.
// Body: { provider: 'openai' | 'deepseek', apiKey: string }
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, apiKey } = body;

    if (!PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }
    if (!apiKey?.trim()) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    const { error } = await supabase.from('ai_provider_keys').upsert(
      {
        profile_id: user.id,
        provider,
        encrypted_key: encrypt(apiKey.trim()),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,provider' }
    );

    if (error) {
      console.error('Error saving AI provider key:', error);
      return NextResponse.json({ error: 'Failed to save key' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/ai/keys - make one provider active, or deactivate it.
// Body: { provider: 'openai' | 'deepseek', active?: boolean } — active
// defaults to true (existing "make active" behavior). Passing
// active: false turns that provider off directly — no atomic swap needed
// since deactivating doesn't touch any other row, unlike activating
// (which must ensure only one provider is ever active).
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, active = true } = body;

    if (!PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    if (active === false) {
      const { error } = await supabase
        .from('ai_provider_keys')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('profile_id', user.id)
        .eq('provider', provider);

      if (error) {
        console.error('Error deactivating AI provider:', error);
        return NextResponse.json({ error: 'Failed to deactivate provider' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    const { error } = await supabase.rpc('set_active_ai_provider', {
      p_provider: provider,
    });

    if (error) {
      console.error('Error activating AI provider:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to activate provider' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/ai/keys?provider=openai - remove a saved key.
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');

    if (!provider || !PROVIDERS.includes(provider as Provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    const { error } = await supabase
      .from('ai_provider_keys')
      .delete()
      .eq('profile_id', user.id)
      .eq('provider', provider);

    if (error) {
      console.error('Error deleting AI provider key:', error);
      return NextResponse.json(
        { error: 'Failed to delete key' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
