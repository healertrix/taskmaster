import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/utils/ai/encryption';
import { AI_PROVIDERS, getDefaultModelFor, isValidModelFor, type AiProvider } from '@/utils/ai/models';

const PROVIDERS = AI_PROVIDERS;
type Provider = AiProvider;

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
      .select('provider, is_active, updated_at, model')
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
        model: row?.model || (row ? getDefaultModelFor(provider) : null),
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
// Body: { provider: AiProvider, apiKey: string }
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

    // model isn't touched on an existing row (re-pasting a key shouldn't
    // reset a model the user already picked) — only set on first insert,
    // via the column default handled below through a plain insert-only
    // field. upsert can't express "set only on insert" directly, so we
    // check for an existing row first.
    const { data: existing } = await supabase
      .from('ai_provider_keys')
      .select('model')
      .eq('profile_id', user.id)
      .eq('provider', provider)
      .maybeSingle();

    const { error } = await supabase.from('ai_provider_keys').upsert(
      {
        profile_id: user.id,
        provider,
        encrypted_key: encrypt(apiKey.trim()),
        model: existing?.model || getDefaultModelFor(provider),
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

// PATCH /api/ai/keys - change one provider's active state, its model, or
// both in one call.
// Body: { provider, active?: boolean, model?: string }
// - `active` (if present): true activates via the atomic
//   set_active_ai_provider() RPC (which deactivates whatever else was
//   active), false deactivates directly since deactivating doesn't touch
//   any other row. Omitted entirely, activation is left untouched — unlike
//   before, it no longer defaults to true, since a model-only PATCH must
//   not have the side effect of also activating that provider.
// - `model` (if present): validated against that provider's curated list
//   (see MODELS_BY_PROVIDER) and stored directly — no RPC needed, this
//   never touches another provider's row.
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
    const { provider, active, model } = body;

    if (!PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    if (model !== undefined) {
      if (typeof model !== 'string' || !isValidModelFor(provider, model)) {
        return NextResponse.json({ error: 'Invalid model for this provider' }, { status: 400 });
      }

      const { error } = await supabase
        .from('ai_provider_keys')
        .update({ model, updated_at: new Date().toISOString() })
        .eq('profile_id', user.id)
        .eq('provider', provider);

      if (error) {
        console.error('Error updating AI provider model:', error);
        return NextResponse.json({ error: 'Failed to update model' }, { status: 500 });
      }
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
    } else if (active === true) {
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
