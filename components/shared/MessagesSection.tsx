'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Send, Plus, Search, UserCheck, UserX, Ban, RotateCcw, Clock,
  Users, Check, Filter, Settings, UserMinus, Trash2,
} from 'lucide-react';
import { useSupabase } from '@/utils/supabase/client';
import { uniqueChannelName } from '@/lib/supabase/hooks';
import { useSession } from './session';
import { useUniversityPeople } from './useUniversityPeople';
import { toast } from 'sonner';

type ConvStatus = 'pending' | 'active' | 'blocked';

const GROUP_META_EMAIL = '__GROUP__';

interface ConvInfo {
  id: string;
  status: ConvStatus;
  requestedBy: string;
  blockedBy: string;
  lastMessageAt: number;
  preview: string;
  isGroup: boolean;
  groupName: string;
  creatorEmail: string;
  other: { email: string; name: string; initials: string };
  members: { email: string; name: string; initials: string }[];
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
  const [chatMode, setChatMode] = useState<'direct' | 'group'>('direct');
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [yearFilter, setYearFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [showManage, setShowManage] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const msgScrollRef = useRef<HTMLDivElement>(null);
  const MESSAGE_PAGE = 20;
  const [prevSelectedId, setPrevSelectedId] = useState<string | null>(selectedId);
  if (prevSelectedId !== selectedId) {
    setPrevSelectedId(selectedId);
    setMessages(null);
    setHasMoreMsgs(false);
  }

  const { people, loading: peopleLoading, error: peopleError, refresh: peopleRefresh } = useUniversityPeople();

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
        const participants = (conv.participant_ids as string[]) || [];
        const groupEntry = meta.find((m) => m.email === GROUP_META_EMAIL);
        const isGroup = participants.length > 2 || !!groupEntry;
        const members = meta.filter((m) => m.email && m.email !== GROUP_META_EMAIL);
        const otherEmail = participants.find((p) => p !== me) || '';
        const other = meta.find((m) => m.email === otherEmail) || { email: otherEmail, name: otherEmail, initials: otherEmail.slice(0, 2).toUpperCase() };
        const groupIdx = meta.findIndex((m) => m.email === GROUP_META_EMAIL);
        const creatorEmail = isGroup
          ? (groupIdx >= 0 ? (meta[groupIdx + 1]?.email ?? '') : '')
          : '';
        return {
          id: conv.id,
          status: (conv.status as ConvStatus) || 'active',
          requestedBy: conv.requested_by || '',
          blockedBy: conv.blocked_by || '',
          lastMessageAt: conv.last_message_at || 0,
          preview: conv?.preview ?? '',
          isGroup,
          groupName: groupEntry?.name || (isGroup ? `Group (${participants.length})` : ''),
          creatorEmail,
          other,
          members,
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
            if (m.sender_email !== me) {
              fetch(`/api/conversations/${selectedId}/messages`, { method: 'PATCH' }).catch(() => {});
            }
            return [...prev, m];
          }
          if (payload.eventType === 'DELETE') return prev.filter((m) => m.id !== (payload.old as ChatMessage).id);
          return prev.map((m) => (m.id === (payload.new as ChatMessage)?.id ? (payload.new as ChatMessage) : m));
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, selectedId]);

  useEffect(() => {
    if (!selectedId || !me) return;
    const t = setTimeout(() => {
      fetch(`/api/conversations/${selectedId}/messages`, { method: 'PATCH' }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [selectedId, me]);

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
  const selectedIsCreator = selected ? selected.creatorEmail === me : false;

  const openGroupManage = () => {
    if (!selected) return;
    setGroupNameDraft(selected.groupName);
    setAddMemberSearch('');
    setShowManage(true);
  };

  const renameGroup = async () => {
    if (!selectedId) return;
    const name = groupNameDraft.trim();
    if (!name) { toast.error('Group name cannot be empty'); return; }
    try {
      const res = await fetch(`/api/conversations/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', name }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Rename failed' }))).message);
      toast.success('Group renamed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rename failed');
    }
  };

  const addGroupMembers = async (participants: { email: string; name: string; initials: string }[]) => {
    if (!selectedId || participants.length === 0) return;
    try {
      const res = await fetch(`/api/conversations/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addMembers', participants }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Could not add members' }))).message);
      toast.success('Members added');
      setAddMemberSearch('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add members');
    }
  };

  const kickMember = async (email: string) => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/conversations/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'removeMember', email }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Could not remove member' }))).message);
      toast.success('Member removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove member');
    }
  };

  const deleteGroup = async () => {
    if (!selectedId) return;
    if (!window.confirm('Delete this group chat for everyone? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/conversations/${selectedId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Could not delete group' }))).message);
      toast.success('Group deleted');
      setSelectedId(null);
      setShowManage(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete group');
    }
  };

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

  const years = [...new Set(people.map((p) => p.year).filter((y): y is string => !!y))].sort();
  const semesters = [...new Set(people.map((p) => p.semester).filter((s): s is string => !!s))].sort();
  const sections = [...new Set(people.map((p) => p.section).filter((s): s is string => !!s))].sort();

  const filteredUsers = otherUsers.filter((p) => {
    if (yearFilter && p.year !== yearFilter) return false;
    if (semesterFilter && p.semester !== semesterFilter) return false;
    if (sectionFilter && p.section !== sectionFilter) return false;
    return true;
  });

  const hasActiveFilter = !!(yearFilter || semesterFilter || sectionFilter);

  const toggleMember = (email: string) => {
    setSelectedMembers((prev) => (prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]));
  };

  const selectAllFiltered = () => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      filteredUsers.forEach((u) => next.add(u.email));
      return [...next];
    });
  };

  const clearAllSelected = () => setSelectedMembers([]);

  const createGroup = async () => {
    const name = groupName.trim();
    if (!name) { toast.error('Give the group a name'); return; }
    if (selectedMembers.length < 1) { toast.error('Select at least one member'); return; }
    const selectedPeople = people.filter((p) => selectedMembers.includes(p.email));
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'group',
          groupName: name,
          participants: selectedPeople.map((p) => ({ email: p.email, name: p.name, initials: p.initials })),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Could not create group' }))).message);
      const { conversationId } = await res.json();
      setSelectedId(conversationId);
      setShowNewChat(false);
      setSelectedMembers([]);
      setGroupName('');
      setSearch('');
      setYearFilter('');
      setSemesterFilter('');
      setSectionFilter('');
      toast.success('Group chat created');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create group');
    }
  };

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

  const composerDisabledReason = selected && !selected.isGroup
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

  const manageMemberEmails = new Set((selected?.members ?? []).map((m) => m.email));
  const addablePeople = people.filter(
    (p) =>
      p.email !== me &&
      !manageMemberEmails.has(p.email) &&
      p.name.toLowerCase().includes(addMemberSearch.toLowerCase())
  );

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
            <div className="text-center py-10 px-4">
              <p className="text-xs mb-4" style={{ color: 'var(--text-lighter)' }}>No conversations yet</p>
              <button
                onClick={() => setShowNewChat(true)}
                className="btn btn-sm gap-1.5 border-none text-white cursor-pointer"
                style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
              >
                <Plus size={13} /> Find people
              </button>
            </div>
          )}
          {conversations?.map((conv) => {
            const displayName = conv.isGroup ? conv.groupName : conv.other.name;
            const displayInitials = conv.isGroup ? conv.groupName.slice(0, 2).toUpperCase() : conv.other.initials;
            return (
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
                  {conv.isGroup ? <Users size={16} /> : displayInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent)' }}>{displayName}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-lighter)' }}>{timeLabel(conv.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div className="text-xs truncate" style={{ color: 'var(--text-lighter)' }}>
                      {conv.isGroup ? `${conv.members.length + 1} members \u2022 ` : ''}{conv.preview || 'No messages yet'}
                    </div>
                    {!conv.isGroup && statusBadge(conv.status)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="bg-base-100 backdrop-blur-xl flex flex-col"
        style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', maxHeight: '72vh' }}
      >
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20" style={{ color: 'var(--text-lighter)' }}>
            <MessageSquare size={36} className="mb-3 opacity-40" />
            <p className="text-sm mb-4">Select a conversation to start chatting</p>
            <button
              onClick={() => setShowNewChat(true)}
              className="btn btn-sm gap-1.5 border-none text-white cursor-pointer"
              style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
            >
              <Plus size={13} /> Find people
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--surface)' }}>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 12 }}>
                {selected.isGroup ? <Users size={15} /> : selected.other.initials}
              </div>
              <div className="flex-1">
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                  {selected.isGroup ? selected.groupName : selected.other.name}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-lighter)' }}>
                  {selected.isGroup
                    ? `${selected.members.length} members`
                    : statusBadge(selected.status) ?? 'UniConnect'}
                </div>
              </div>
              {selected.isGroup && selectedIsCreator && (
                <button
                  onClick={openGroupManage}
                  className="btn btn-ghost btn-sm gap-1.5"
                  style={{ color: 'var(--primary)', border: '1.5px solid var(--surface-border)' }}
                  title="Manage group"
                >
                  <Settings size={14} /> Manage
                </button>
              )}
              {!selected.isGroup && selected.status === 'active' && (
                <button
                  onClick={() => handleConversationAction('block')}
                  className="btn btn-ghost btn-sm gap-1.5"
                  style={{ color: 'var(--danger)', border: '1.5px solid var(--surface-border)' }}
                  title="Block user"
                >
                  <Ban size={14} /> Block
                </button>
              )}
              {!selected.isGroup && selected.status === 'blocked' && selected.blockedBy === me && (
                <button
                  onClick={() => handleConversationAction('unblock')}
                  className="btn btn-ghost btn-sm gap-1.5"
                  style={{ color: 'var(--primary)', border: '1.5px solid var(--surface-border)' }}
                  title="Unblock user"
                >
                  <RotateCcw size={14} /> Unblock
                </button>
              )}
              {!selected.isGroup && selected.status === 'pending' && !iAmRequester && (
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
                const showSender = !mine && selected.isGroup;
                return (
                  <div key={m.id} className={`flex mb-3 ${mine ? 'justify-end' : 'justify-start'}`}>
                    {showSender && (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-white font-bold shrink-0 mr-2 mt-1" style={{ fontSize: 9 }}>
                        {(m.sender_name || m.sender_email).slice(0, 2).toUpperCase()}
                      </div>
                    )}
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
                      {showSender && (
                        <div className="text-[10.5px] font-semibold mb-0.5" style={{ color: 'var(--primary)' }}>{m.sender_name || m.sender_email}</div>
                      )}
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
          <div className="bg-base-100 w-full max-w-lg" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
                {chatMode === 'group' ? 'New Group Chat' : 'New Message'}
              </div>
              <button onClick={() => { setShowNewChat(false); setSearch(''); setSelectedMembers([]); setGroupName(''); setYearFilter(''); setSemesterFilter(''); setSectionFilter(''); }} className="btn btn-ghost btn-sm btn-circle" style={{ color: 'var(--text-light)' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 4, padding: '12px 20px 0', borderBottom: '1px solid var(--surface)' }}>
              {(['direct', 'group'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setChatMode(mode)}
                  style={{
                    padding: '9px 14px',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: 'none',
                    color: chatMode === mode ? 'var(--primary)' : 'var(--text-light)',
                    border: 'none',
                    borderBottom: '2.5px solid',
                    borderBottomColor: chatMode === mode ? 'var(--primary)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {mode === 'group' ? <Users size={13} /> : <MessageSquare size={13} />}
                  {mode === 'group' ? 'Group Chat' : 'Direct'}
                </button>
              ))}
            </div>

            {chatMode === 'group' && (
              <div style={{ padding: '12px 20px 0' }}>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Group name (e.g. CS101 Study Group)"
                  className="w-full outline-none"
                  style={{ padding: '9px 12px', fontSize: 13.5, color: 'var(--text)', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--surface-border)', background: 'var(--divider)' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, padding: '12px 20px', flexWrap: 'wrap', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-light)' }}>
                <Filter size={12} /> Filter:
              </div>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                style={{ padding: '6px 10px', fontSize: 12, borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--surface-border)', background: 'var(--divider)', color: 'var(--text)', cursor: 'pointer' }}
              >
                <option value="">All Years</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
                style={{ padding: '6px 10px', fontSize: 12, borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--surface-border)', background: 'var(--divider)', color: 'var(--text)', cursor: 'pointer' }}
              >
                <option value="">All Semesters</option>
                {semesters.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                style={{ padding: '6px 10px', fontSize: 12, borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--surface-border)', background: 'var(--divider)', color: 'var(--text)', cursor: 'pointer' }}
              >
                <option value="">All Sections</option>
                {sections.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {hasActiveFilter && (
                <button
                  onClick={() => { setYearFilter(''); setSemesterFilter(''); setSectionFilter(''); }}
                  className="btn btn-ghost btn-xs"
                  style={{ color: 'var(--text-lighter)', fontSize: 11 }}
                >
                  Clear
                </button>
              )}
            </div>

            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="flex-1 flex items-center gap-2 px-3 py-2" style={{ background: 'var(--divider)', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--surface-border)' }}>
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
                {chatMode === 'group' && filteredUsers.length > 0 && (
                  <button
                    onClick={selectAllFiltered}
                    className="btn btn-sm gap-1 border-none text-white shrink-0"
                    style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
                    title="Add all filtered users to the group"
                  >
                    <Check size={13} /> Select all ({filteredUsers.length})
                  </button>
                )}
              </div>
              {chatMode === 'group' && selectedMembers.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span style={{ fontSize: 11, color: 'var(--text-lighter)' }}>Selected:</span>
                  {people.filter((p) => selectedMembers.includes(p.email)).map((p) => (
                    <button
                      key={p.email}
                      onClick={() => toggleMember(p.email)}
                      className="flex items-center gap-1 cursor-pointer"
                      style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 12, background: 'rgba(58,139,194,0.15)', color: 'var(--primary)', border: 'none' }}
                    >
                      {p.name} ✕
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="max-h-[260px] overflow-y-auto">
              {peopleLoading && !peopleError && (
                <div className="text-center py-10 text-xs" style={{ color: 'var(--text-lighter)' }}>Loading people...</div>
              )}
              {!peopleLoading && peopleError && (
                <div className="text-center py-10">
                  <div className="text-xs mb-3" style={{ color: 'var(--warning)' }}>Could not load people — {peopleError}</div>
                  <button onClick={peopleRefresh} className="btn btn-ghost btn-sm" style={{ color: 'var(--primary)' }}>Retry</button>
                </div>
              )}
              {!peopleLoading && !peopleError && filteredUsers.length === 0 && (
                <div className="text-center py-10 text-xs" style={{ color: 'var(--text-lighter)' }}>
                  No users found{hasActiveFilter ? ' — try clearing the filters' : ''}
                </div>
              )}
              {filteredUsers.map((p) => {
                const isSelected = chatMode === 'group' && selectedMembers.includes(p.email);
                const subParts = [p.role, p.sub, p.year, p.semester].filter(Boolean);
                return (
                  <button
                    key={p.email}
                    onClick={() => (chatMode === 'group' ? toggleMember(p.email) : openChat({ email: p.email, name: p.name, initials: p.initials }))}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left cursor-pointer transition-colors"
                    style={{
                      borderBottom: '1px solid var(--surface)',
                      background: isSelected ? 'rgba(58,139,194,0.10)' : undefined,
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-soft)'; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 11 }}>
                      {p.initials}
                    </div>
                    <div className="flex-1">
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent)' }}>{p.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-lighter)' }}>{subParts.join(' \u2022 ')}</div>
                    </div>
                    {chatMode === 'group' && (
                      <div
                        className="flex items-center justify-center shrink-0"
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 5,
                          border: '1.5px solid',
                          borderColor: isSelected ? 'var(--primary)' : 'var(--surface-border)',
                          background: isSelected ? 'var(--primary)' : 'transparent',
                          color: '#fff',
                        }}
                      >
                        {isSelected && <Check size={12} />}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {chatMode === 'group' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--surface)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-lighter)' }}>
                  {selectedMembers.length > 0 ? `${selectedMembers.length} member${selectedMembers.length === 1 ? '' : 's'} selected` : 'Select members or use the filters'}
                </div>
                <div className="flex items-center gap-2">
                  {selectedMembers.length > 0 && (
                    <button onClick={clearAllSelected} className="btn btn-ghost btn-sm" style={{ color: 'var(--text-light)' }}>Clear</button>
                  )}
                  <button
                    onClick={createGroup}
                    disabled={!groupName.trim() || selectedMembers.length < 1}
                    className="btn btn-sm gap-1.5 border-none text-white disabled:opacity-40"
                    style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
                  >
                    <Users size={13} /> Create Group
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showManage && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--modal-bg)' }}>
          <div className="bg-base-100 w-full max-w-md" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>Manage Group</div>
              <button onClick={() => setShowManage(false)} className="btn btn-ghost btn-sm btn-circle" style={{ color: 'var(--text-light)' }}>✕</button>
            </div>

            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-light)', marginBottom: 8 }}>Group name</div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={groupNameDraft}
                  onChange={(e) => setGroupNameDraft(e.target.value)}
                  className="flex-1 outline-none"
                  style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text)', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--surface-border)', background: 'var(--divider)' }}
                />
                <button onClick={renameGroup} className="btn btn-sm border-none text-white" style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}>
                  Save
                </button>
              </div>
            </div>

            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-light)', marginBottom: 8 }}>Add members</div>
              <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--divider)', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--surface-border)' }}>
                <Search size={14} style={{ color: 'var(--text-lighter)' }} />
                <input
                  type="text"
                  value={addMemberSearch}
                  onChange={(e) => setAddMemberSearch(e.target.value)}
                  placeholder="Search people..."
                  className="flex-1 bg-transparent outline-none"
                  style={{ fontSize: 13, color: 'var(--text)' }}
                />
              </div>
              <div className="max-h-[150px] overflow-y-auto mt-2">
                {addablePeople.length === 0 && (
                  <div className="text-center py-3 text-xs" style={{ color: 'var(--text-lighter)' }}>
                    No one to add
                  </div>
                )}
                {addablePeople.slice(0, 20).map((p) => (
                  <div key={p.email} className="flex items-center gap-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 10 }}>{p.initials}</div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{p.name}</div>
                      <div className="truncate" style={{ fontSize: 11, color: 'var(--text-lighter)' }}>{p.email}</div>
                    </div>
                    <button
                      onClick={() => addGroupMembers([{ email: p.email, name: p.name, initials: p.initials }])}
                      className="btn btn-xs btn-ghost gap-1 border-none"
                      style={{ color: 'var(--primary)' }}
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-light)', marginBottom: 8 }}>
                Members ({selected.members.length})
              </div>
              <div className="max-h-[150px] overflow-y-auto">
                {selected.members.map((m) => {
                  const isCreator = m.email === selected.creatorEmail;
                  const isMe = m.email === me;
                  return (
                    <div key={m.email} className="flex items-center gap-3 py-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 10 }}>{m.initials}</div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                          {m.name}{isMe ? ' (you)' : ''}
                        </div>
                        <div className="truncate" style={{ fontSize: 11, color: 'var(--text-lighter)' }}>
                          {m.email}{isCreator ? ' • Creator' : ''}
                        </div>
                      </div>
                      {!isCreator && !isMe && (
                        <button
                          onClick={() => kickMember(m.email)}
                          className="btn btn-xs btn-ghost gap-1 border-none"
                          style={{ color: 'var(--danger)' }}
                          title="Remove from group"
                        >
                          <UserMinus size={12} /> Kick
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: '16px 20px' }}>
              <button
                onClick={deleteGroup}
                className="btn btn-sm gap-1.5 w-full border-none text-white"
                style={{ background: 'linear-gradient(var(--danger), var(--danger-dark))' }}
              >
                <Trash2 size={13} /> Delete group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
