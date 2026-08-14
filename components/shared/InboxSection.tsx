'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Inbox, UserCheck, UserX, MessageSquare, Clock, Ban } from 'lucide-react';
import { useSupabase } from '@/utils/supabase/client';
import { useConversations } from '@/lib/supabase/hooks';
import { toast } from 'sonner';
import { useSession } from './session';

interface ConvItem {
  id: string;
  status: 'pending' | 'active' | 'blocked';
  requestedBy: string;
  blockedBy: string;
  lastMessageAt: number;
  preview: string;
  unread: number;
  other: { email: string; name: string; initials: string };
}

export default function InboxSection() {
  const supabase = useSupabase();
  const { user: session } = useSession();
  const me = session?.email ?? '';

  const { conversations, loading } = useConversations(supabase, me);

  const items = (conversations as ConvItem[] | null) ?? [];
  const requests = useMemo(
    () => items.filter((c) => c.status === 'pending' && c.requestedBy !== me),
    [items, me]
  );
  const chats = useMemo(
    () => items.filter((c) => c.status !== 'pending' || c.requestedBy === me),
    [items, me]
  );

  const handleAccept = async (convId: string) => {
    const res = await fetch(`/api/conversations/${convId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept' }),
    });
    if (res.ok) toast.success('Message request accepted');
    else toast.error('Could not accept request');
  };

  const handleReject = async (convId: string) => {
    const res = await fetch(`/api/conversations/${convId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    });
    if (res.ok) toast.success('Message request declined');
    else toast.error('Could not decline request');
  };

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-5">
        <Inbox size={20} style={{ color: 'var(--primary)' }} />
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--accent)' }}>Inbox</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-lighter)' }}>
            {requests.length > 0
              ? `You have ${requests.length} pending message request${requests.length > 1 ? 's' : ''}`
              : 'No pending message requests'}
          </p>
        </div>
      </div>

      <div className="bg-base-100 backdrop-blur-xl mb-5" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
          <Clock size={16} style={{ color: 'var(--warning)' }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>Message Requests</div>
        </div>
        {requests.length === 0 && (
          <div className="text-center py-10 text-sm" style={{ color: 'var(--text-lighter)' }}>
            No message requests right now
          </div>
        )}
        {requests.map((req) => (
          <div key={req.id} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid var(--surface)' }}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 12 }}>
              {req.other.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{req.other.name}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-lighter)' }}>
                {req.other.email} wants to start a conversation with you
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleAccept(req.id)}
                className="btn btn-sm gap-1.5 border-none text-white"
                style={{ background: 'linear-gradient(var(--success), var(--success-dark))' }}
              >
                <UserCheck size={14} /> Accept
              </button>
              <button
                onClick={() => handleReject(req.id)}
                className="btn btn-sm gap-1.5 border-none text-white"
                style={{ background: 'linear-gradient(var(--danger), var(--danger-dark))' }}
              >
                <UserX size={14} /> Decline
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
          <MessageSquare size={16} style={{ color: 'var(--primary)' }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>Conversations</div>
        </div>
        {chats.length === 0 && (
          <div className="text-center py-10 text-sm" style={{ color: 'var(--text-lighter)' }}>
            No conversations yet
          </div>
        )}
        {chats.map((conv) => {
          const hasUnread = (conv.unread ?? 0) > 0;
          return (
            <Link
            key={conv.id}
            href={`/${session?.role ?? ''}/messages`}
            className="flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-(--surface-soft)"
            style={{ borderBottom: '1px solid var(--surface)', display: 'flex' }}
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 12 }}>
              {conv.other.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div style={{ fontSize: 14, fontWeight: hasUnread ? 700 : 600, color: 'var(--accent)' }}>{conv.other.name}</div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasUnread && (
                    <span
                      className="flex items-center justify-center rounded-full text-white font-bold"
                      style={{ minWidth: 18, height: 18, padding: '0 5px', fontSize: 10.5, background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
                    >
                      {conv.unread}
                    </span>
                  )}
                  {conv.status === 'blocked' && (
                    <span className="badge badge-sm gap-1" style={{ background: 'rgba(248,113,113,0.15)', color: '#dc2626', border: 'none' }}>
                      <Ban size={10} /> Blocked
                    </span>
                  )}
                </div>
              </div>
              <div
                className="text-xs mt-0.5 truncate"
                style={{ color: hasUnread ? 'var(--text)' : 'var(--text-lighter)', fontWeight: hasUnread ? 600 : 400 }}
              >
                {conv.preview}
              </div>
            </div>
          </Link>
          );
        })}
      </div>
    </div>
  );
}