import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import type { createClient } from '@/utils/supabase/server';
import { decrypt } from './encryption';
import { type AiProvider, getDefaultModelFor } from './models';

export type { AiProvider } from './models';
export { AI_PROVIDERS, MODELS_BY_PROVIDER, getDefaultModelFor, isValidModelFor } from './models';

// DeepSeek and OpenRouter are both OpenAI-compatible — only the base URL
// (and therefore which key applies) differs, so they share the `openai`
// SDK with plain OpenAI. Anthropic and Gemini are not OpenAI-compatible in
// the ways this app relies on (JSON mode in particular, see AiClient
// below), so they get their own SDKs.
const BASE_URL_BY_PROVIDER: Partial<Record<AiProvider, string>> = {
  deepseek: 'https://api.deepseek.com',
  openrouter: 'https://openrouter.ai/api/v1',
};

const REQUEST_TIMEOUT_MS = 20_000;

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// The entire surface every call site in this app actually needs: a plain
// completion, and a completion the caller will JSON.parse (every prompt
// that uses completeJson already instructs the model to respond with only
// JSON in its own system prompt — this only adds a provider's native JSON
// mode on top where one exists, it doesn't replace that instruction).
// getActiveClientForUser() returns one of these instead of a raw SDK
// client so callers never branch on provider themselves.
export interface AiClient {
  complete(messages: AiMessage[]): Promise<string>;
  completeJson(messages: AiMessage[]): Promise<string>;
}

// Each provider branch in getProviderClient() below builds a `build`
// function shaped (model, messages, json) => Promise<string> against that
// provider's own SDK — Anthropic's Messages API takes `system` as its own
// top-level field (not a role: "system" message) and has no JSON-mode
// param, so its completeJson relies entirely on the prompt's own "respond
// with only JSON" instruction (already present in every call site that
// uses it); Gemini's SDK takes messages as `contents` with role 'user' |
// 'model' (no 'assistant') plus a separate `systemInstruction`, and does
// have native JSON mode via responseMimeType. bindModel() closes over one
// resolved model so callers just get plain complete()/completeJson().
function bindModel(build: (model: string, messages: AiMessage[], json: boolean) => Promise<string>, model: string): AiClient {
  return {
    complete: (messages) => build(model, messages, false),
    completeJson: (messages) => build(model, messages, true),
  };
}

export function getProviderClient(provider: AiProvider, apiKey: string, model: string): AiClient {
  switch (provider) {
    case 'openai':
    case 'deepseek':
    case 'openrouter': {
      const sdk = new OpenAI({
        apiKey,
        baseURL: BASE_URL_BY_PROVIDER[provider],
        timeout: REQUEST_TIMEOUT_MS,
        maxRetries: 1,
      });
      return bindModel(async (m, messages, json) => {
        const completion = await sdk.chat.completions.create({
          model: m,
          messages,
          ...(json ? { response_format: { type: 'json_object' as const } } : {}),
        });
        return completion.choices[0]?.message?.content || '';
      }, model);
    }
    case 'anthropic': {
      const sdk = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
      return bindModel(async (m, messages) => {
        const system = messages
          .filter((msg) => msg.role === 'system')
          .map((msg) => msg.content)
          .join('\n\n');
        const conversation = messages
          .filter((msg) => msg.role !== 'system')
          .map((msg) => ({ role: msg.role as 'user' | 'assistant', content: msg.content }));

        const response = await sdk.messages.create({
          model: m,
          max_tokens: 4096,
          system: system || undefined,
          messages: conversation.length > 0 ? conversation : [{ role: 'user', content: '' }],
        });

        const textBlock = response.content.find((b) => b.type === 'text');
        return textBlock && 'text' in textBlock ? textBlock.text : '';
      }, model);
    }
    case 'gemini': {
      const sdk = new GoogleGenAI({ apiKey });
      return bindModel(async (m, messages, json) => {
        const systemInstruction = messages
          .filter((msg) => msg.role === 'system')
          .map((msg) => msg.content)
          .join('\n\n');
        const contents = messages
          .filter((msg) => msg.role !== 'system')
          .map((msg) => ({
            role: msg.role === 'assistant' ? ('model' as const) : ('user' as const),
            parts: [{ text: msg.content }],
          }));

        const response = await sdk.models.generateContent({
          model: m,
          contents,
          config: {
            ...(systemInstruction ? { systemInstruction } : {}),
            ...(json ? { responseMimeType: 'application/json' } : {}),
          },
        });

        return response.text || '';
      }, model);
    }
  }
}

// Looks up the caller's active ai_provider_keys row, decrypts it, and
// returns a ready-to-use client. Returns null (not a thrown error) when
// there's no active key — every caller treats "no key" as a normal,
// expected state (prompt the user toward Settings), not a failure.
export async function getActiveClientForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{ client: AiClient; provider: AiProvider; model: string } | null> {
  const { data, error } = await supabase
    .from('ai_provider_keys')
    .select('provider, encrypted_key, model')
    .eq('profile_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;

  const provider = data.provider as AiProvider;
  const apiKey = decrypt(data.encrypted_key);
  const model = data.model || getDefaultModelFor(provider);

  return {
    client: getProviderClient(provider, apiKey, model),
    provider,
    model,
  };
}
