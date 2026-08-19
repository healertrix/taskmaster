'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, Check, ChevronDown, Loader2, Trash2 } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MODELS_BY_PROVIDER, type AiProvider } from '@/utils/ai/models';

interface ProviderKeyState {
  provider: AiProvider;
  hasKey: boolean;
  isActive: boolean;
  updatedAt: string | null;
  model: string | null;
}

const PROVIDER_LABEL: Record<AiProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  gemini: 'Google (Gemini)',
  openrouter: 'OpenRouter',
  deepseek: 'DeepSeek',
};

const timeAgo = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

// A pill-shaped trigger + floating menu (Radix, styled to match the app's
// other popovers — see e.g. CardCustomFields' dropdowns) instead of a
// native <select>, which renders as a plain OS-chrome box that doesn't
// pick up the app's theme. Sits in the row's action cluster next to the
// active toggle, not under the provider name — it's a per-provider setting
// like the toggle/delete buttons beside it, not part of the identity line.
function ModelPicker({
  provider,
  model,
  label,
  disabled,
  onChange,
}: {
  provider: AiProvider;
  model: string | null;
  label: string;
  disabled: boolean;
  onChange: (model: string) => void;
}) {
  const models = MODELS_BY_PROVIDER[provider];
  const selected = models.find((m) => m.id === model) || models[0];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          disabled={disabled}
          aria-label={`${label} model — ${selected.label}`}
          title={selected.label}
          className='group flex items-center gap-1 max-w-[130px] sm:max-w-[160px] text-xs font-medium pl-2.5 pr-1.5 py-1.5 rounded-full bg-muted/60 hover:bg-muted border border-border/60 hover:border-primary/40 text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none'
        >
          <span className='truncate'>{selected.label}</span>
          <ChevronDown className='w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-150 group-data-[state=open]:rotate-180' />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align='end'
          sideOffset={6}
          className='min-w-[220px] bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl z-50 p-1 animate-in fade-in-0 zoom-in-95 duration-150'
        >
          {models.map((m) => (
            <DropdownMenu.Item
              key={m.id}
              onSelect={() => onChange(m.id)}
              className='flex items-center justify-between gap-3 text-xs px-2.5 py-2 rounded-md cursor-pointer outline-none data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary'
            >
              <span className='truncate'>{m.label}</span>
              {m.id === selected.id && <Check className='w-3.5 h-3.5 text-primary flex-shrink-0' />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// Settings section for BYOK AI provider keys — pasted keys are encrypted
// server-side (see utils/ai/encryption.ts) before storage and never sent
// back to the client once saved, so this UI only ever knows hasKey/isActive,
// never the key itself. At most one provider is ever active (enforced at
// the DB level, see the ai_provider_keys migration); the switch below can
// also turn the active one off entirely, leaving zero active providers.
export function AIKeysSection() {
  const [keys, setKeys] = useState<ProviderKeyState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(false);
    fetch('/api/ai/keys')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed with ${res.status}`);
        return res.json();
      })
      .then((data) => setKeys(data.keys || []))
      .catch((err) => {
        console.error('Error fetching AI keys:', err);
        setError(true);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveKey = async (provider: string) => {
    const apiKey = drafts[provider]?.trim();
    if (!apiKey) return;
    setSavingProvider(provider);
    try {
      const res = await fetch('/api/ai/keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      setDrafts((prev) => ({ ...prev, [provider]: '' }));
      load();
    } catch (err) {
      console.error('Error saving AI key:', err);
    } finally {
      setSavingProvider(null);
    }
  };

  const updateModel = async (provider: AiProvider, model: string) => {
    const previous = keys.find((k) => k.provider === provider)?.model || null;
    setKeys((prev) => prev.map((k) => (k.provider === provider ? { ...k, model } : k)));
    setSavingProvider(provider);
    try {
      const res = await fetch('/api/ai/keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model }),
      });
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
    } catch (err) {
      console.error('Error updating AI provider model:', err);
      setKeys((prev) => prev.map((k) => (k.provider === provider ? { ...k, model: previous } : k)));
    } finally {
      setSavingProvider(null);
    }
  };

  const toggleActive = async (provider: string, nextActive: boolean) => {
    setSavingProvider(provider);
    setKeys((prev) =>
      prev.map((k) => {
        if (k.provider === provider) return { ...k, isActive: nextActive };
        // Activating one provider always deactivates the other — mirrors
        // the DB's at-most-one-active constraint.
        return nextActive ? { ...k, isActive: false } : k;
      })
    );
    try {
      const res = await fetch('/api/ai/keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, active: nextActive }),
      });
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
    } catch (err) {
      console.error('Error updating AI provider active state:', err);
      load();
    } finally {
      setSavingProvider(null);
    }
  };

  const deleteKey = async (provider: string) => {
    setSavingProvider(provider);
    try {
      const res = await fetch(`/api/ai/keys?provider=${provider}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      load();
    } catch (err) {
      console.error('Error deleting AI key:', err);
    } finally {
      setSavingProvider(null);
    }
  };

  return (
    <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-5 mt-6'>
      <h2 className='text-base font-semibold text-foreground mb-1'>AI features</h2>
      <p className='text-xs text-muted-foreground mb-4'>
        Paste your own API key for OpenAI, Anthropic (Claude), Google (Gemini), OpenRouter, or
        DeepSeek to enable AI task creation and activity summaries — and pick which model that
        provider should use. Keys are encrypted before storage and never shown again once saved.
        Only one provider can be active at a time — flip it off to pause AI features without
        deleting the key.
      </p>

      {isLoading ? (
        <div className='flex justify-center py-6'>
          <Loader2 className='w-5 h-5 animate-spin text-muted-foreground' />
        </div>
      ) : error ? (
        <div className='flex flex-col items-center gap-2 py-6 text-center'>
          <p className='text-sm text-muted-foreground'>Couldn't load your AI keys.</p>
          <button
            onClick={load}
            className='text-xs font-medium text-primary hover:text-primary/80 transition-colors'
          >
            Try again
          </button>
        </div>
      ) : (
        <div className='divide-y divide-border/40'>
          {/* Configured providers first, so the ones you actually use don't
              get pushed down by a long list of untouched ones — sorted on
              render (not persisted) via a stable sort, so ties keep
              AI_PROVIDERS' order. */}
          {[...keys]
            .sort((a, b) => Number(b.hasKey) - Number(a.hasKey))
            .map((k) => (
            <div key={k.provider} className='flex items-center gap-3 py-3'>
              <div className='w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0'>
                <Bot className='w-4 h-4 text-muted-foreground' />
              </div>
              <div className='flex-1 min-w-0'>
                <p className='text-sm font-medium text-foreground'>{PROVIDER_LABEL[k.provider]}</p>
                {k.hasKey ? (
                  <p className='text-xs mt-1'>
                    <span className={k.isActive ? 'text-success font-medium' : 'text-muted-foreground font-medium'}>
                      {k.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className='text-muted-foreground'>
                      {' '}
                      · Key saved{k.updatedAt && ` · updated ${timeAgo(k.updatedAt)}`}
                    </span>
                  </p>
                ) : (
                  <div className='flex items-center gap-2 mt-1.5'>
                    <input
                      type='password'
                      value={drafts[k.provider] || ''}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [k.provider]: e.target.value }))
                      }
                      placeholder={`Paste your ${PROVIDER_LABEL[k.provider]} key`}
                      className='flex-1 min-w-0 text-xs bg-background border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30'
                    />
                    <button
                      onClick={() => saveKey(k.provider)}
                      disabled={!drafts[k.provider]?.trim() || savingProvider === k.provider}
                      className='text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex-shrink-0'
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>

              {k.hasKey && (
                <div className='flex items-center gap-2 flex-shrink-0'>
                  <ModelPicker
                    provider={k.provider}
                    model={k.model}
                    label={PROVIDER_LABEL[k.provider]}
                    disabled={savingProvider === k.provider}
                    onChange={(model) => updateModel(k.provider, model)}
                  />
                  <button
                    role='switch'
                    aria-checked={k.isActive}
                    aria-label={`${k.isActive ? 'Deactivate' : 'Activate'} ${PROVIDER_LABEL[k.provider]}`}
                    title={k.isActive ? 'Active — click to turn off' : 'Click to make active'}
                    disabled={savingProvider === k.provider}
                    onClick={() => toggleActive(k.provider, !k.isActive)}
                    className={`relative w-9 h-5 rounded-full border transition-colors flex-shrink-0 disabled:opacity-50 ${
                      k.isActive ? 'bg-primary border-primary' : 'bg-muted-foreground/40 border-border'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform ${
                        k.isActive ? 'translate-x-4 bg-primary-foreground' : 'translate-x-0 bg-white'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => deleteKey(k.provider)}
                    disabled={savingProvider === k.provider}
                    aria-label={`Remove ${PROVIDER_LABEL[k.provider]} key`}
                    title='Remove key'
                    className='p-1.5 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/10 transition-colors disabled:opacity-50'
                  >
                    <Trash2 className='w-3.5 h-3.5' />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
