'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useSupabase } from '@/utils/supabase/client';
import { useSession } from './session';

export interface PresenceEntry {
  online: boolean;
  last_seen: number;
}

interface PresenceContextValue {
  presence: Record<string, PresenceEntry>;
  getPresence: (email: string) => PresenceEntry;
}

const PresenceContext = createContext<PresenceContextValue>({
  presence: {},
  getPresence: () => ({ online: false, last_seen: 0 }),
});

const HEARTBEAT_MS = 30000;

function persistLastSeen(ts: number) {
  const body = JSON.stringify({ last_seen: ts });
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/presence', new Blob([body], { type: 'application/json' }));
  } else {
    fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const { user } = useSession();
  const me = user?.email ?? '';
  const [presence, setPresence] = useState<Record<string, PresenceEntry>>({});

  useEffect(() => {
    if (!me) return;
    const ch = supabase.channel('global-app-presence', { config: { presence: { key: me } } });

    ch
      .on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState() as Record<string, { email?: string; last_seen?: number }[]>;
        const live: Record<string, PresenceEntry> = {};
        Object.entries(state).forEach(([key, entries]) => {
          const last = entries[entries.length - 1];
          live[key] = { online: true, last_seen: last?.last_seen ?? Date.now() };
        });
        setPresence((prev) => {
          const next: Record<string, PresenceEntry> = { ...live };
          for (const [email, entry] of Object.entries(prev)) {
            if (email === me) continue;
            if (!(email in next)) next[email] = { online: false, last_seen: entry.last_seen };
          }
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const ts = Date.now();
          await ch.track({ email: me, online: true, last_seen: ts }).catch(() => {});
          fetch('/api/presence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ last_seen: ts }),
          }).catch(() => {});
        }
      });

    const heartbeat = setInterval(() => {
      ch.track({ email: me, online: true, last_seen: Date.now() }).catch(() => {});
    }, HEARTBEAT_MS);

    const onPageHide = (e: BeforeUnloadEvent | PageTransitionEvent) => {
      if (e.type === 'pagehide' || document.visibilityState === 'hidden') {
        persistLastSeen(Date.now());
      }
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onPageHide);

    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onPageHide);
      clearInterval(heartbeat);
      ch.untrack().catch(() => {});
      supabase.removeChannel(ch);
    };
  }, [supabase, me]);

  const getPresence = useCallback(
    (email: string): PresenceEntry => presence[email] ?? { online: false, last_seen: 0 },
    [presence]
  );

  return (
    <PresenceContext.Provider value={{ presence, getPresence }}>{children}</PresenceContext.Provider>
  );
}

export function usePresence(): PresenceContextValue {
  return useContext(PresenceContext);
}