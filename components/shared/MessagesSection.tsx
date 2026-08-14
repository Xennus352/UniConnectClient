'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Send, Plus, Search, UserCheck, UserX, Ban, RotateCcw, Clock,
} from 'lucide-react';
import { useSupabase } from '@/utils/supabase/client';
import { uniqueChannelName } from '@/lib/supabase/hooks';
import { useSession } from './session';
import { useUniversityPeople } from './useUniversityPeople';
import { toast } from 'sonner';

type ConvStatus = 'pending' | 'active' | 'blocked';

interface ConvInfo {
  id: string;
  status: ConvStatus;
  requestedBy: string;
  blockedBy: string;
  lastMessageAt: number;
  preview: string;
  other: { email: string; name: string; initials: string };
}

interface ChatMessage {
  id: string;
  sender_email: string;
  sender_name: string;
  sender_initials?: string;
  content: string;
  created_at: number;
}

function timeLabel(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const d = new Date(ts);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function MessagesSection() {
  const supabase = useSupabase();
  const { user: session } = useSession();
  const me = session?.email ?? '';
  const myName = session?.name ?? me;
  const myInitials = session?.initials ?? me.slice(0, 2).toUpperCase();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConvInfo[] | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [hasMoreMsgs, setHasMoreMsgs] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [search, setSearch] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const msgScrollRef = useRef<HTMLDivElement>(null);
  const MESSAGE_PAGE = 20;
  const [prevSelectedId, setPrevSelectedId] = useState<string | null>(selectedId);
  if (prevSelectedId !== selectedId) {
    setPrevSelectedId(selectedId);
    setMessages(null);
    setHasMoreMsgs(false);
  }

  const { people } = useUniversityPeople();

  useEffect(() => {
    if (!me) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .contains('participant_ids', [me])
        .order('last_message_at', { ascending: false });
      if (error) { console.error(error); setConversations([]); return; }
      const enriched: ConvInfo[] = (data ?? []).map((conv) => {
        const meta = (conv.participant_meta as any[]) || [];
        const otherEmail = (conv.participant_ids as string[]).find((p) => p !== me) || '';
        const other = meta.find((m) => m.email === otherEmail) || { email: otherEmail, name: otherEmail, initials: otherEmail.slice(0, 2).toUpperCase() };
        return {
          id: conv.id,
          status: (conv.status as ConvStatus) || 'active',
          requestedBy: conv.requested_by || '',
          blockedBy: conv.blocked_by || '',
          lastMessageAt: conv.last_message_at || 0,
          preview: conv?.preview ?? '',
          other: { email: other.email, name: other.name, initials: other.initials },
        };
      });
      setConversations(enriched);
    };
    load();
    const ch = supabase
      .channel(uniqueChannelName('public:conversations'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, me]);

  useEffect(() => {
    if (!selectedId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', selectedId)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_PAGE);
      if (error) setMessages([]);
      else { setMessages((data ?? []).slice().reverse()); setHasMoreMsgs((data?.length ?? 0) === MESSAGE_PAGE); }
    };
    load();
    const ch = supabase
      .channel(uniqueChannelName(`public:chat_messages:conv:${selectedId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${selectedId}` }, (payload) => {
        setMessages((prev) => {
          if (!prev) return prev;
          if (payload.eventType === 'INSERT') {
            const m = payload.new as ChatMessage;
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          }
          if (payload.eventType === 'DELETE') return prev.filter((m) => m.id !== (payload.old as ChatMessage).id);
          return prev.map((m) => (m.id === (payload.new as ChatMessage)?.id ? (payload.new as ChatMessage) : m));
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, selectedId]);

  const loadOlder = useCallback(async () => {
    if (!selectedId || loadingOlder || !hasMoreMsgs || !messages || messages.length === 0) return;
    const container = msgScrollRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;
    setLoadingOlder(true);
    const oldest = messages[0];
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', selectedId)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .limit(MESSAGE_PAGE);
    if (!error && data) {
      const batch: ChatMessage[] = (data ?? []).slice().reverse();
      setMessages((prev) => {
        const existing = new Set((prev ?? []).map((m) => m.id));
        return [...batch.filter((m) => !existing.has(m.id)), ...(prev ?? [])];
      });
      setHasMoreMsgs(data.length === MESSAGE_PAGE);
      requestAnimationFrame(() => {
        const el = msgScrollRef.current;
        if (el) el.scrollTop = el.scrollHeight - prevScrollHeight + prevScrollTop;
      });
    }
    setLoadingOlder(false);
  }, [selectedId, loadingOlder, hasMoreMsgs, messages, supabase]);

  const handleMsgScroll = useCallback(() => {
    const el = msgScrollRef.current;
    if (el && el.scrollTop < 40) loadOlder();
  }, [loadOlder]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selected: ConvInfo | null = selectedId
    ? (conversations?.find((c) => c.id === selectedId) ?? null)
    : null;
  const iAmRequester = selected ? selected.requestedBy === me : false;

  const openChat = useCallback(async (other: { email: string; name: string; initials: string }) => {
    if (!me) return;
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otherEmail: other.email, otherName: other.name, otherInitials: other.initials }),
    });
    if (res.ok) {
      const { conversationId } = await res.json();
      setSelectedId(conversationId);
      setShowNewChat(false);
    } else {
      toast.error((await res.json().catch(() => ({ message: 'Could not start conversation' }))).message);
    }
  }, [me]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || !selectedId || !me) return;
    try {
      const res = await fetch(`/api/conversations/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Could not send message' }))).message);
      setDraft('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send message');
    }
  };

  const handleConversationAction = useCallback(async (action: 'accept' | 'reject' | 'block' | 'unblock') => {
    if (!selectedId || !me) return;
    try {
      const res = await fetch(`/api/conversations/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Action failed' }))).message);
      if (action === 'reject') setSelectedId(null);
      toast.success(action === 'accept' ? 'Message request accepted' : action === 'reject' ? 'Message request declined' : action === 'block' ? 'User blocked' : 'User unblocked');
    } catch {
      toast.error('Action failed');
    }
  }, [selectedId, me]);

  const otherUsers = people.filter(
    (p) => p.email !== me && p.name.toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (status: ConvStatus) => {
    if (status === 'pending') {
      return (
        <span className="badge badge-sm gap-1" style={{ background: 'rgba(251,191,36,0.15)', color: '#d97706', border: 'none' }}>
          <Clock size={10} /> Pending
        </span>
      );
    }
    if (status === 'blocked') {
      return (
        <span className="badge badge-sm gap-1" style={{ background: 'rgba(248,113,113,0.15)', color: '#dc2626', border: 'none' }}>
          <Ban size={10} /> Blocked
        </span>
      );
    }
    return null;
  };

  const composerDisabledReason = selected
    ? selected.status === 'pending'
      ? iAmRequester
        ? `Waiting for ${selected.other.name} to accept your message request`
        : `Accept this message request to start chatting`
      : selected.status === 'blocked'
        ? selected.blockedBy === me
          ? `You blocked ${selected.other.name}`
          : `${selected.other.name} blocked you`
        : null
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-[18px]">
      <div
        className="bg-base-100 backdrop-blur-xl flex flex-col"
        style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', maxHeight: '72vh' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--surface)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={16} style={{ color: 'var(--primary)' }} /> Messages
          </div>
          <button
            onClick={() => setShowNewChat(true)}
            className="flex items-center justify-center cursor-pointer border-none"
            style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff' }}
            title="New message"
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {!conversations && (
            <div className="text-center py-10 text-xs" style={{ color: 'var(--text-lighter)' }}>Loading...</div>
          )}
          {conversations && conversations.length === 0 && (
            <div className="text-center py-10 text-xs" style={{ color: 'var(--text-lighter)' }}>
              No conversations yet
            </div>
          )}
          {conversations?.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedId(conv.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-colors"
              style={{
                borderBottom: '1px solid var(--surface)',
                background: selectedId === conv.id ? 'rgba(58,139,194,0.10)' : 'transparent',
              }}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 12 }}>
                {conv.other.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent)' }}>{conv.other.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-lighter)' }}>{timeLabel(conv.lastMessageAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <div className="text-xs truncate" style={{ color: 'var(--text-lighter)' }}>{conv.preview || 'No messages yet'}</div>
                  {statusBadge(conv.status)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div
        className="bg-base-100 backdrop-blur-xl flex flex-col"
        style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', maxHeight: '72vh' }}
      >
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20" style={{ color: 'var(--text-lighter)' }}>
            <MessageSquare size={36} className="mb-3 opacity-40" />
            <p className="text-sm">Select a conversation to start chatting</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--surface)' }}>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 12 }}>
                {selected.other.initials}
              </div>
              <div className="flex-1">
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{selected.other.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-lighter)' }}>
                  {statusBadge(selected.status) ?? 'UniConnect'}
                </div>
              </div>
              {selected.status === 'active' && (
                <button
                  onClick={() => handleConversationAction('block')}
                  className="btn btn-ghost btn-sm gap-1.5"
                  style={{ color: 'var(--danger)', border: '1.5px solid var(--surface-border)' }}
                  title="Block user"
                >
                  <Ban size={14} /> Block
                </button>
              )}
              {selected.status === 'blocked' && selected.blockedBy === me && (
                <button
                  onClick={() => handleConversationAction('unblock')}
                  className="btn btn-ghost btn-sm gap-1.5"
                  style={{ color: 'var(--primary)', border: '1.5px solid var(--surface-border)' }}
                  title="Unblock user"
                >
                  <RotateCcw size={14} /> Unblock
                </button>
              )}
              {selected.status === 'pending' && !iAmRequester && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleConversationAction('accept')}
                    className="btn btn-sm gap-1.5 border-none text-white"
                    style={{ background: 'linear-gradient(var(--success), var(--success-dark))' }}
                  >
                    <UserCheck size={14} /> Accept
                  </button>
                  <button
                    onClick={() => handleConversationAction('reject')}
                    className="btn btn-sm gap-1.5 border-none text-white"
                    style={{ background: 'linear-gradient(var(--danger), var(--danger-dark))' }}
                  >
                    <UserX size={14} /> Decline
                  </button>
                </div>
              )}
            </div>

            <div ref={msgScrollRef} onScroll={handleMsgScroll} className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: 320 }}>
              {loadingOlder && (
                <div className="text-center py-2 text-[11px]" style={{ color: 'var(--text-lighter)' }}>
                  Loading earlier messages...
                </div>
              )}
              {!messages && (
                <div className="text-center py-10 text-xs" style={{ color: 'var(--text-lighter)' }}>Loading...</div>
              )}
              {messages?.map((m) => {
                const mine = m.sender_email === me;
                return (
                  <div key={m.id} className={`flex mb-3 ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className="max-w-[75%] px-4 py-2.5"
                      style={{
                        borderRadius: mine ? 'var(--radius-md) 0 var(--radius-md) var(--radius-md)' : '0 var(--radius-md) var(--radius-md) var(--radius-md)',
                        background: mine ? 'linear-gradient(var(--primary), var(--primary-dark))' : 'var(--divider)',
                        color: mine ? '#fff' : 'var(--text)',
                        fontSize: 13.5,
                        lineHeight: 1.5,
                      }}
                    >
                      {m.content}
                      <div className="text-[10px] mt-1" style={{ opacity: 0.7 }}>{timeLabel(m.created_at)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            <div className="flex items-center gap-2 p-3" style={{ borderTop: '1px solid var(--surface)' }}>
              {composerDisabledReason ? (
                <div className="flex-1 text-center text-xs py-2.5" style={{ color: 'var(--text-lighter)' }}>
                  {composerDisabledReason}
                </div>
              ) : (
                <div className="flex-1 flex items-center gap-2" style={{ background: 'var(--divider)', borderRadius: 'var(--radius-md)', padding: '4px 4px 4px 14px', border: '1.5px solid var(--surface-border)' }}>
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent outline-none"
                    style={{ fontSize: 13.5, color: 'var(--text)', border: 'none' }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!draft.trim()}
                    className="flex items-center justify-center cursor-pointer border-none disabled:opacity-30"
                    style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', color: '#fff', background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
                  >
                    <Send size={14} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--modal-bg)' }}>
          <div className="bg-base-100 w-full max-w-md" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>New Message</div>
              <button onClick={() => setShowNewChat(false)} className="btn btn-ghost btn-sm btn-circle" style={{ color: 'var(--text-light)' }}>✕</button>
            </div>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--divider)', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--surface-border)' }}>
                <Search size={14} style={{ color: 'var(--text-lighter)' }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search people..."
                  className="flex-1 bg-transparent outline-none"
                  style={{ fontSize: 13.5, color: 'var(--text)' }}
                />
              </div>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {otherUsers.length === 0 && (
                <div className="text-center py-10 text-xs" style={{ color: 'var(--text-lighter)' }}>
                  No other users found
                </div>
              )}
              {otherUsers.map((p) => (
                <button
                  key={p.email}
                  onClick={() => openChat({ email: p.email, name: p.name, initials: p.initials })}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left cursor-pointer hover:bg-(--surface-soft) transition-colors"
                  style={{ borderBottom: '1px solid var(--surface)' }}
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 11 }}>
                    {p.initials}
                  </div>
                  <div className="flex-1">
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent)' }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-lighter)' }}>{p.role}{p.sub ? ` \u2022 ${p.sub}` : ''}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
