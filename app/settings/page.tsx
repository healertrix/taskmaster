'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardHeader } from '../components/dashboard/header';
import { AIKeysSection } from '../components/settings/AIKeysSection';
import { useAuth } from '@/context/AuthContext';
import {
  Bell,
  BellOff,
  BellRing,
  CalendarClock,
  MessageSquare,
  Loader2,
  AtSign,
  ArrowRightLeft,
} from 'lucide-react';

// Label/description/icon for each toggleable notification type. 'mention'
// isn't here — it's always on, never shown as a toggle (see
// app/api/notification-preferences/route.ts).
const NOTIF_TYPE_META: Record<
  string,
  { label: string; description: string; icon: typeof Bell }
> = {
  comment: {
    label: 'Comments',
    description: 'When someone comments on a card you’re a member of',
    icon: MessageSquare,
  },
  comment_on_watched_card: {
    label: 'Watched cards',
    description: 'New comments on cards you’re watching',
    icon: AtSign,
  },
  due_date_changed: {
    label: 'Due dates',
    description: 'When a due date changes on a card you’re a member of',
    icon: CalendarClock,
  },
  moved_list: {
    label: 'Card moves',
    description: 'When a card you’re a member of moves to another list',
    icon: ArrowRightLeft,
  },
};

export default function SettingsPage() {
  const { user } = useAuth();

  // Notification preferences — which non-mention notification types the
  // user wants to receive. Mention is intentionally never in this list
  // (always on — see app/api/notification-preferences/route.ts).
  const [notifPrefs, setNotifPrefs] = useState<
    { type: string; enabled: boolean }[]
  >([]);
  const [isLoadingNotifPrefs, setIsLoadingNotifPrefs] = useState(true);
  const [notifPrefsError, setNotifPrefsError] = useState(false);
  const [savingNotifType, setSavingNotifType] = useState<string | null>(null);

  // Browser (in-tab) notification permission — opt-in only, never
  // auto-prompted. See NotificationBell.tsx for the polling that actually
  // fires the popups once this is granted.
  const [browserPermission, setBrowserPermission] =
    useState<NotificationPermission | null>(null);

  const loadNotifPrefs = useCallback(() => {
    setIsLoadingNotifPrefs(true);
    setNotifPrefsError(false);
    fetch('/api/notification-preferences')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed with ${res.status}`);
        return res.json();
      })
      .then((data) => setNotifPrefs(data.preferences || []))
      .catch((error) => {
        console.error('Error fetching notification preferences:', error);
        setNotifPrefsError(true);
      })
      .finally(() => setIsLoadingNotifPrefs(false));
  }, []);

  useEffect(() => {
    loadNotifPrefs();
  }, [loadNotifPrefs]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setBrowserPermission(Notification.permission);
  }, []);

  const requestBrowserPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setBrowserPermission(result);
  };

  const toggleNotifPref = async (type: string, current: boolean) => {
    const next = !current;
    setNotifPrefs((prev) =>
      prev.map((p) => (p.type === type ? { ...p, enabled: next } : p))
    );
    setSavingNotifType(type);
    try {
      const res = await fetch('/api/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, enabled: next }),
      });
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
    } catch (error) {
      console.error('Error updating notification preference:', error);
      // Revert on failure.
      setNotifPrefs((prev) =>
        prev.map((p) => (p.type === type ? { ...p, enabled: current } : p))
      );
    } finally {
      setSavingNotifType(null);
    }
  };

  if (!user) {
    return null; // Let the RouteGuard handle redirection
  }

  return (
    <div className='min-h-screen'>
      <DashboardHeader />

      <main className='container mx-auto max-w-5xl px-4 pt-24 pb-16'>
        <h1 className='text-xl sm:text-2xl font-bold text-foreground heading-enter mb-6'>
          Settings
        </h1>

        {/* Notification preferences */}
        <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-5'>
          <h2 className='text-base font-semibold text-foreground mb-1'>
            Notification preferences
          </h2>
          <p className='text-xs text-muted-foreground mb-4'>
            Choose what you get notified about. @Mentions always notify you —
            they're not listed here.
          </p>

          {/* Browser notifications toggle */}
          <div className='flex items-center gap-3 py-3 border-b border-border/40'>
            <div className='w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0'>
              {browserPermission === 'granted' ? (
                <BellRing className='w-4 h-4 text-muted-foreground' />
              ) : (
                <BellOff className='w-4 h-4 text-muted-foreground' />
              )}
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-sm font-medium text-foreground'>
                Browser notifications
              </p>
              <p className='text-xs text-muted-foreground'>
                {browserPermission === 'granted'
                  ? 'Enabled — pops up while a tab is open, even in the background.'
                  : browserPermission === 'denied'
                  ? 'Blocked in your browser settings. Re-enable it there to turn this back on.'
                  : 'Get a popup the moment something new comes in, while a tab is open.'}
              </p>
            </div>
            {browserPermission === 'granted' ? (
              <span className='text-xs font-medium text-success flex-shrink-0'>
                Enabled
              </span>
            ) : browserPermission === 'denied' ? (
              <span className='text-xs font-medium text-muted-foreground flex-shrink-0'>
                Blocked
              </span>
            ) : (
              <button
                onClick={requestBrowserPermission}
                className='text-xs font-medium text-primary hover:text-primary/80 transition-colors flex-shrink-0'
              >
                Enable
              </button>
            )}
          </div>

          {isLoadingNotifPrefs ? (
            <div className='flex justify-center py-6'>
              <Loader2 className='w-5 h-5 animate-spin text-muted-foreground' />
            </div>
          ) : notifPrefsError ? (
            <div className='flex flex-col items-center gap-2 py-6 text-center'>
              <p className='text-sm text-muted-foreground'>
                Couldn't load your preferences.
              </p>
              <button
                onClick={loadNotifPrefs}
                className='text-xs font-medium text-primary hover:text-primary/80 transition-colors'
              >
                Try again
              </button>
            </div>
          ) : (
            <div className='divide-y divide-border/40'>
              {notifPrefs.map((pref) => {
                const meta = NOTIF_TYPE_META[pref.type];
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <div key={pref.type} className='flex items-center gap-3 py-3'>
                    <div className='w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0'>
                      <Icon className='w-4 h-4 text-muted-foreground' />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium text-foreground'>
                        {meta.label}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {meta.description}
                      </p>
                    </div>
                    <button
                      role='switch'
                      aria-checked={pref.enabled}
                      disabled={savingNotifType === pref.type}
                      onClick={() => toggleNotifPref(pref.type, pref.enabled)}
                      className={`relative w-9 h-5 rounded-full border transition-colors flex-shrink-0 disabled:opacity-50 ${
                        pref.enabled
                          ? 'bg-primary border-primary'
                          : 'bg-muted-foreground/40 border-border'
                      }`}
                    >
                      {/* Thumb is dark (primary-foreground) when on, white
                          when off — NOT white in both states. `--primary`
                          in this theme is itself near-white ("Paper white"),
                          so a white-on-white thumb+track used to disappear
                          entirely in the on position. */}
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform ${
                          pref.enabled
                            ? 'translate-x-4 bg-primary-foreground'
                            : 'translate-x-0 bg-white'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <AIKeysSection />
      </main>
    </div>
  );
}
