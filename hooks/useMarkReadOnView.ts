import { useCallback, useEffect, useRef } from 'react';

// Marks an unread notification read once its row has been continuously
// visible for `dwellMs` — used by both the bell dropdown and the full
// /notifications page so viewing a notification (not just clicking it) is
// enough to mark it read, matching how Slack/Linear treat "you had it open"
// as seen. This only flips is_read; it does NOT reorder the list — a
// just-read row stays exactly where it was until the caller's next fetch
// re-sorts (reopening the dropdown, the next poll, or a page reload), so
// rows never jump out from under the cursor while someone's still reading.
export function useMarkReadOnView(onRead: (id: string) => void, dwellMs = 1500) {
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const observerRef = useRef<IntersectionObserver | null>(null);
  // Always call the latest onRead — the observer/effect below is created
  // once and must not close over a stale callback from an earlier render.
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;

  useEffect(() => {
    const timers = timersRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute('data-notification-id');
          if (!id) continue;
          if (entry.isIntersecting) {
            if (timers.has(id)) continue;
            timers.set(
              id,
              setTimeout(() => {
                timers.delete(id);
                onReadRef.current(id);
              }, dwellMs)
            );
          } else {
            const t = timers.get(id);
            if (t) {
              clearTimeout(t);
              timers.delete(id);
            }
          }
        }
      },
      { threshold: 0.6 }
    );
    observerRef.current = observer;

    return () => {
      observer.disconnect();
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, [dwellMs]);

  // Ref callback to attach to an unread row's DOM node, e.g.
  // `ref={registerRef(n.id)}`. Read rows don't need this — nothing to mark.
  const registerRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      const observer = observerRef.current;
      if (!observer || !el) return;
      el.setAttribute('data-notification-id', id);
      observer.observe(el);
    },
    []
  );

  return registerRef;
}
