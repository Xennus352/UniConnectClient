'use client';

import { useEffect, useRef } from 'react';
import { useSupabase } from '@/utils/supabase/client';
import { uniqueChannelName } from '@/lib/supabase/hooks';
import { useSession } from './session';
import { toast } from 'sonner';
import { Heart, MessageSquare, UserPlus, CalendarCheck, ShieldCheck, Mail } from 'lucide-react';
import { usePathname } from 'next/navigation';

interface ToastNotification {
  id: string;
  type: string;
  message: string;
  created_at: number;
  read: boolean;
  recipient_email: string | null;
  recipient_role: string | null;
}

const TYPE_META: Record<string, { icon: React.ReactNode }> = {
  like: { icon: <Heart size={15} /> },
  comment: { icon: <MessageSquare size={15} /> },
  message: { icon: <Mail size={15} /> },
  follow: { icon: <UserPlus size={15} /> },
  event: { icon: <CalendarCheck size={15} /> },
  moderation: { icon: <ShieldCheck size={15} /> },
};

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
        if (pathname?.includes('notifications')) return;
        const meta = TYPE_META[n.type] ?? TYPE_META.event;
        toast(n.message, {
          icon: meta.icon,
          action: myRole
            ? { label: 'View', onClick: () => { window.location.href = `/${myRole}/notifications`; } }
            : undefined,
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, me, myRole, pathname]);

  return null;
}
