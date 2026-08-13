'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, Loader2, Trash2 } from 'lucide-react';

interface ProviderKeyState {
  provider: 'openai' | 'deepseek';
  hasKey: boolean;
  isActive: boolean;
  updatedAt: string | null;
}

const PROVIDER_LABEL: Record<string, string> = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
};

const timeAgo = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

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
        Paste your own OpenAI or DeepSeek API key to enable AI task creation and activity
        summaries. Keys are encrypted before storage and never shown again once saved. Only one
        provider can be active at a time — flip it off to pause AI features without deleting the key.
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
          {keys.map((k) => (
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
