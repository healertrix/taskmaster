import OpenAI from 'openai';
import type { createClient } from '@/utils/supabase/server';
import { decrypt } from './encryption';

export type AiProvider = 'openai' | 'deepseek';

// Smallest/cheapest model per provider — fixed on purpose, no model
// picker in the UI. One constant to bump later if that ever changes.
const MODEL_BY_PROVIDER: Record<AiProvider, string> = {
  openai: 'gpt-4o-mini',
  deepseek: 'deepseek-chat',
};

// DeepSeek's API is OpenAI-compatible, so the same `openai` SDK works for
// both providers — only the base URL (and therefore which key applies)
// differs.
const BASE_URL_BY_PROVIDER: Partial<Record<AiProvider, string>> = {
  deepseek: 'https://api.deepseek.com',
};

export function getModelFor(provider: AiProvider): string {
  return MODEL_BY_PROVIDER[provider];
}

// timeout/maxRetries are set explicitly — the SDK's defaults (10 min
// timeout, 2 retries) mean a slow/unreachable provider can leave a
// request hanging for a very long time, which just reads as "stuck
// loading forever" to the person waiting on it. 20s is generous for a
// short completion; failing fast lets the UI show a real error instead.
export function getProviderClient(provider: AiProvider, apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: BASE_URL_BY_PROVIDER[provider],
    timeout: 20_000,
    maxRetries: 1,
  });
}

// Looks up the caller's active ai_provider_keys row, decrypts it, and
// returns a ready-to-use client. Returns null (not a thrown error) when
// there's no active key — every caller treats "no key" as a normal,
// expected state (prompt the user toward Settings), not a failure.
export async function getActiveClientForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{ client: OpenAI; provider: AiProvider; model: string } | null> {
  const { data, error } = await supabase
    .from('ai_provider_keys')
    .select('provider, encrypted_key')
    .eq('profile_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;

  const provider = data.provider as AiProvider;
  const apiKey = decrypt(data.encrypted_key);

  return {
    client: getProviderClient(provider, apiKey),
    provider,
    model: getModelFor(provider),
  };
}
