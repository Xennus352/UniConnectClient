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
      return { path: `${base}/inbox` };
    case 'exam-result':
      return { path: `${base}/inbox` };
    case 'event':
      return { path: `${base}/events` };
    case 'like':
    case 'comment':
    case 'share':
      return { path: `${base}/feed` };
    case 'follow':
      return { path: `${base}/notifications` };
    case 'moderation':
      return { path: n.post_id ? `${base}/feed` : `${base}/notifications` };
    default:
      return { path: `${base}/notifications` };
  }
}

export default function RealtimeAlerts() {
  const supabase = useSupabase();
  const { user: session } = useSession();
  const me = session?.email ?? '';
  const myRole = session?.role ?? '';
  const pathname = usePathname();

  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(uniqueChannelName('public:notifications:alerts'))
       .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const n = payload.new as ToastNotification;
        const isMine = n.recipient_email === me || (myRole && n.recipient_role === myRole);
        if (!isMine) return;
        if (n.read) return;
        const key = n.id;
        if (seenRef.current.has(key)) return;
        seenRef.current.add(key);
        const dest = destinationFor(n, myRole);
        if (dest && pathname === dest.path) return;
        const meta = TYPE_META[n.type] ?? TYPE_META.event;
        toast(n.message, {
          icon: meta.icon,
          action: dest
            ? { label: 'View', onClick: () => { window.location.href = dest.path; } }
            : undefined,
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, me, myRole, pathname]);

  return null;
}
