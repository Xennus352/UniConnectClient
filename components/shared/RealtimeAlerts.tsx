'use client';

import { useEffect, useRef } from 'react';
import { useSupabase } from '@/utils/supabase/client';
import { uniqueChannelName } from '@/lib/supabase/hooks';
import { useSession } from './session';
import { toast } from 'sonner';
import { Heart, MessageSquare, Share2, UserPlus, CalendarCheck, ShieldCheck, Mail, FileText } from 'lucide-react';
import { usePathname } from 'next/navigation';

interface ToastNotification {
  id: string;
  type: string;
  message: string;
  created_at: number;
  read: boolean;
  recipient_email: string | null;
  recipient_role: string | null;
  post_id?: string | null;
  activity_id?: string | null;
}

const TYPE_META: Record<string, { icon: React.ReactNode }> = {
  like: { icon: <Heart size={15} /> },
  comment: { icon: <MessageSquare size={15} /> },
  share: { icon: <Share2 size={15} /> },
  message: { icon: <Mail size={15} /> },
  follow: { icon: <UserPlus size={15} /> },
  event: { icon: <CalendarCheck size={15} /> },
  moderation: { icon: <ShieldCheck size={15} /> },
  'exam-result': { icon: <FileText size={15} /> },
};

function destinationFor(n: ToastNotification, role: string): { path: string } | null {
  const base = `/${role || 'student'}`;
  switch (n.type) {
    case 'message':
      return { path: `${base}/messages` };
    case 'exam-result':
      return { path: `${base}/exam-results` };
    case 'event':
      return { path: `${base}/events` };
    case 'like':
    case 'comment':
    case 'share':
      if (n.type === 'share' && n.activity_id) return { path: `${base}/activity` };
      return { path: `${base}/feed` };
    case 'follow':
      return { path: `${base}/notifications` };
    case 'moderation':
      return { path: n.post_id ? `${base}/feed` : `${base}/notifications` };
    default:
      return { path: `${base}/notifications` };
  }
}

const REALTIME_CONNECT_TIMEOUT_MS = 10000;
const POLL_INTERVAL_MS = 30000;

export default function RealtimeAlerts() {
  const supabase = useSupabase();
  const { user: session } = useSession();
  const me = session?.email ?? '';
  const myRole = session?.role ?? '';
  const pathname = usePathname();

  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!me) return;

    let disposed = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let connectTimer: ReturnType<typeof setTimeout> | null = null;

    const isMine = (n: ToastNotification) =>
      n.recipient_email === me || (myRole && n.recipient_role === myRole);

    const toastNotification = (n: ToastNotification) => {
      if (!isMine(n) || n.read || seenRef.current.has(n.id)) return;
      seenRef.current.add(n.id);
      const dest = destinationFor(n, myRole);
      if (dest && pathname === dest.path) return;
      const meta = TYPE_META[n.type] ?? TYPE_META.event;
      toast(n.message, {
        icon: meta.icon,
        action: dest
          ? { label: 'View', onClick: () => { window.location.href = dest.path; } }
          : undefined,
      });
    };

    // Fallback for networks that block wss:// (or while Supabase is
    // unreachable): poll the REST endpoint so alerts still arrive.
    const startPolling = () => {
      if (disposed || pollTimer) return;
      let baselined = false;
      const tick = async () => {
        try {
          const res = await fetch('/api/notifications');
          if (!res.ok) return;
          const list = (await res.json()) as ToastNotification[];
          for (const n of list ?? []) {
            if (!baselined) { seenRef.current.add(n.id); continue; }
            toastNotification(n);
          }
        } catch {
          // Supabase unreachable — retry on next tick
        } finally {
          baselined = true;
        }
      };
      void tick();
      pollTimer = setInterval(() => void tick(), POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    };

    const channel = supabase
      .channel(uniqueChannelName('public:notifications:alerts'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        toastNotification(payload.new as ToastNotification);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
          stopPolling();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          startPolling();
        }
      });

    connectTimer = setTimeout(() => startPolling(), REALTIME_CONNECT_TIMEOUT_MS);

    return () => {
      disposed = true;
      if (connectTimer) clearTimeout(connectTimer);
      stopPolling();
      supabase.removeChannel(channel);
    };
  }, [supabase, me, myRole, pathname]);

  return null;
}
