'use client';

import { useState, useEffect } from 'react';
import { Bell, Heart, MessageSquare, Share2, UserPlus, CalendarCheck, ShieldCheck, CheckCheck, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/utils/supabase/client';
import { useNotifications } from '@/lib/supabase/hooks';
import { useSession } from './session';
import type { Notification } from '@/lib/supabase/hooks';

const TYPE_META: Record<string, { icon: React.ReactNode; bg: string; color: string }> = {
  like: { icon: <Heart size={15} />, bg: 'rgba(248,113,113,0.12)', color: '#f87171' },
  comment: { icon: <MessageSquare size={15} />, bg: 'rgba(14, 165, 233,0.12)', color: 'var(--primary)' },
  message: { icon: <MessageSquare size={15} />, bg: 'rgba(14, 165, 233,0.12)', color: 'var(--primary)' },
  share: { icon: <Share2 size={15} />, bg: 'rgba(52,211,153,0.12)', color: '#34d399' },
  moderation: { icon: <ShieldCheck size={15} />, bg: 'rgba(167,139,250,0.14)', color: '#a78bfa' },
  event: { icon: <CalendarCheck size={15} />, bg: 'rgba(251,191,36,0.14)', color: '#fbbf24' },
  follow: { icon: <UserPlus size={15} />, bg: 'rgba(52,211,153,0.12)', color: '#34d399' },
  'exam-result': { icon: <FileText size={15} />, bg: 'rgba(251,191,36,0.14)', color: '#fbbf24' },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function NotificationsSection() {
  const { user: session } = useSession();
  const supabase = useSupabase();
  const router = useRouter();
  const me = session?.email ?? '';
  const myRole = session?.role ?? '';

  const { notifications, loading } = useNotifications(supabase, me, myRole);
  const [localRead, setLocalRead] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/notifications/cleanup', { method: 'POST' }).catch(() => {});
  }, []);

  const isRead = (n: Notification) => n.read || localRead.has(n.id);
  const unreadCount = (notifications ?? []).filter((n) => !isRead(n)).length;

  const markRead = (id: string) => {
    setLocalRead((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    fetch(`/api/notifications/${id}`, { method: 'PATCH' }).catch(() => {});
  };

  const handleMarkAll = async () => {
    if (notifications) setLocalRead(new Set(notifications.map((n) => n.id)));
    await fetch('/api/notifications', { method: 'PATCH' }).catch(() => {});
  };

  const resolveConversationId = async (actorEmail: string): Promise<string | null> => {
    const { data } = (await supabase
      .from('conversations')
      .select('*')
      .contains('participant_ids', [me])) as unknown as { data: Array<{ id: string; participant_ids: string[] }> | null };
    const conv = (data ?? []).find(
      (c) => (c.participant_ids ?? []).length === 2 && c.participant_ids.includes(actorEmail.toLowerCase()),
    );
    return conv?.id ?? null;
  };

  const handleClick = (n: Notification) => {
    if (!isRead(n)) markRead(n.id);
    const base = `/${myRole || 'student'}`;
    if (n.type === 'message') {
      if (n.conversation_id) {
        router.push(`${base}/messages?conv=${n.conversation_id}`);
        return;
      }
      if (n.actor_email) {
        resolveConversationId(n.actor_email).then((cid) =>
          router.push(cid ? `${base}/messages?conv=${cid}` : `${base}/messages`),
        );
        return;
      }
      router.push(`${base}/messages`);
      return;
    }
    if (['like', 'comment', 'share'].includes(n.type)) {
      router.push(n.post_id ? `${base}/feed?post=${n.post_id}` : `${base}/feed`);
      return;
    }
    if (n.type === 'moderation') {
      if (n.post_id) router.push(`${base}/feed?post=${n.post_id}`);
      else if (myRole === 'admin' || myRole === 'student-affair') router.push(`${base}/moderation`);
      return;
    }
    if (n.type === 'follow' && n.actor_email) {
      router.push(`/people/${encodeURIComponent(n.actor_email)}`);
      return;
    }
    if (n.type === 'event') {
      router.push(`${base}/events`);
      return;
    }
    if (n.type === 'exam-result') {
      router.push(`${base}/inbox`);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2.5" style={{ color: 'var(--accent)' }}>
            <Bell size={20} style={{ color: 'var(--primary)' }} /> Notifications
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-lighter)' }}>
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'You are all caught up'}
          </p>
        </div>
        <button
          onClick={handleMarkAll}
          className="btn btn-ghost btn-sm gap-2"
          style={{ color: 'var(--primary)', border: '1.5px solid var(--surface-border)' }}
        >
          <CheckCheck size={15} /> Mark all as read
        </button>
      </div>

      <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {loading && (
          <div className="text-center py-16 text-sm" style={{ color: 'var(--text-lighter)' }}>Loading...</div>
        )}
        {!loading && notifications && notifications.length === 0 && (
          <div className="text-center py-16" style={{ color: 'var(--text-lighter)' }}>
            <Bell size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No notifications yet</p>
          </div>
        )}
        {notifications?.map((n, i) => {
          const meta = TYPE_META[n.type] ?? TYPE_META.event;
          const read = isRead(n);
          return (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className="w-full flex items-start gap-4 px-5 py-4 text-left cursor-pointer transition-colors duration-150 hover:bg-(--surface-soft)"
              style={{ borderBottom: i < (notifications?.length ?? 0) - 1 ? '1px solid var(--surface)' : 'none', background: read ? 'transparent' : 'rgba(14, 165, 233,0.04)' }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: meta.bg, color: meta.color }}
              >
                {meta.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm" style={{ color: read ? 'var(--text-light)' : 'var(--accent)', fontWeight: read ? 400 : 600 }}>
                  {n.message}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-lighter)' }}>{timeAgo(n.created_at)}</p>
              </div>
              {!read && (
                <span className="mt-1.5 shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
