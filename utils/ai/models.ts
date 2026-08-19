// Provider/model metadata only — no SDKs, no server-only imports (no
// `crypto`, no API clients). Safe to import from both server code
// (app/api/ai/keys/route.ts, utils/ai/client.ts) and client components
// (app/components/settings/AIKeysSection.tsx), which is exactly why this
// is split out of utils/ai/client.ts rather than living there: that file
// pulls in the AI SDKs and utils/ai/encryption.ts's use of node `crypto`,
// neither of which belong in a browser bundle.

export type AiProvider = 'openai' | 'deepseek' | 'openrouter' | 'anthropic' | 'gemini';

export const AI_PROVIDERS: AiProvider[] = ['openai', 'deepseek', 'openrouter', 'anthropic', 'gemini'];

// Curated per-provider model lists — deliberately short (2-4 entries),
// hand-maintained here rather than fetched live from each provider's
// /models endpoint. When a provider ships a new model, add one line to its
// array; no schema change or migration needed. The Settings dropdown reads
// straight from this, and the API validates any submitted model against it
// (see isValidModelFor() and app/api/ai/keys/route.ts), so a stored
// `model` is always one the dropdown can actually display. First entry in
// each list is the default applied when a key is first saved (see
// getDefaultModelFor()).
export const MODELS_BY_PROVIDER: Record<AiProvider, { id: string; label: string }[]> = {
  openai: [
    { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna (fast, cheap)' },
    { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
    { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol (flagship)' },
  ],
  deepseek: [
    { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash (fast, cheap)' },
    { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  ],
  openrouter: [
    { id: 'openai/gpt-5.6-luna', label: 'OpenAI: GPT-5.6 Luna' },
    { id: 'anthropic/claude-sonnet-5', label: 'Anthropic: Claude Sonnet 5' },
    { id: 'google/gemini-3.5-flash-lite', label: 'Google: Gemini 3.5 Flash-Lite' },
    { id: 'deepseek/deepseek-v4-flash', label: 'DeepSeek: V4 Flash' },
  ],
  anthropic: [
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (fast, cheap)' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
    { id: 'claude-opus-5', label: 'Claude Opus 5 (flagship)' },
  ],
  gemini: [
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (fast, cheap)' },
    { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
  ],
};

export function getDefaultModelFor(provider: AiProvider): string {
  return MODELS_BY_PROVIDER[provider][0].id;
}

export function isValidModelFor(provider: AiProvider, model: string): boolean {
  return MODELS_BY_PROVIDER[provider].some((m) => m.id === model);
}
