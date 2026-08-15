'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  MessageSquare, Send, Plus, Search, UserCheck, UserX, Ban, RotateCcw, Clock,
  Users, Check, Filter, Settings, UserMinus, Trash2, Paperclip, FileText,
  FileSpreadsheet, File, Download, Loader2, Image as ImageIcon, Share2,
} from 'lucide-react';
import { useSupabase } from '@/utils/supabase/client';
import type { Database } from '@/utils/supabase/types';
import { uniqueChannelName } from '@/lib/supabase/hooks';
import { useSession } from './session';
import { useUniversityPeople } from './useUniversityPeople';
import { toast } from 'sonner';

type ConvStatus = 'pending' | 'active' | 'blocked';

const GROUP_META_EMAIL = '__GROUP__';

interface QuickGroup {
  key: string;
  label: string;
  emails: string[];
  sem: string;
  sec: string;
  year: string;
}

interface ConvInfo {
  id: string;
  status: ConvStatus;
  requestedBy: string;
  blockedBy: string;
  lastMessageAt: number;
  preview: string;
  unread: number;
  isGroup: boolean;
  groupName: string;
  creatorEmail: string;
  other: { email: string; name: string; initials: string };
  members: { email: string; name: string; initials: string }[];
}

interface ChatAttachment {
  name: string;
  size: number;
  mime: string;
  path: string;
}

interface SharedPostData {
  id: string;
  content: string;
  author_name: string;
  image?: string | null;
  created_at?: number;
  tags?: unknown;
}

type SharedPostEntry = { kind: 'post'; post: SharedPostData };
type MessageAttachment = ChatAttachment | SharedPostEntry;

function isSharedPost(a: MessageAttachment): a is SharedPostEntry {
  return (a as { kind?: string }).kind === 'post';
}

interface ChatMessage {
  id: string;
  sender_email: string;
  sender_name: string;
  sender_initials?: string;
  content: string;
  attachments?: MessageAttachment[];
  created_at: number;
}

const ATTACH_ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,.csv,.zip';

type ChatMessageRow = Database['public']['Tables']['chat_messages']['Row'];

function toChatMessage(m: ChatMessageRow): ChatMessage {
  return {
    id: m.id,
    sender_email: m.sender_email,
    sender_name: m.sender_name,
    content: m.content,
    created_at: m.created_at,
    attachments: (m.attachments as MessageAttachment[] | null) ?? undefined,
  };
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime: string, name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (mime.startsWith('image/')) return <ImageIcon size={16} />;
  if (['doc', 'docx', 'odt'].includes(ext)) return <FileText size={16} />;
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return <FileSpreadsheet size={16} />;
  if (mime.includes('pdf')) return <FileText size={16} />;
  return <File size={16} />;
}

function MessageAttachments({ convId, attachments, mine }: { convId: string; attachments: MessageAttachment[]; mine: boolean }) {
  const postEntries = attachments.filter(isSharedPost);
  const fileEntries = attachments.filter((a) => !isSharedPost(a)) as ChatAttachment[];
  const [urls, setUrls] = useState<Record<string, { url: string; downloadUrl: string }> | null>(null);
  const [error, setError] = useState(false);
  const pathsKey = fileEntries.map((a) => a.path).join('\u0000');
  useEffect(() => {
    if (fileEntries.length === 0) return;
    let cancelled = false;
    fetch(`/api/conversations/${convId}/attachments?paths=${encodeURIComponent(JSON.stringify(fileEntries.map((a) => a.path)))}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((data) => { if (!cancelled) setUrls(data.urls ?? {}); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [convId, pathsKey, fileEntries]);

  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5" style={{ maxWidth: 300 }}>
      {postEntries.map((entry) => (
        <SharedPostCard key={entry.post.id} data={entry.post} mine={mine} />
      ))}
      {fileEntries.map((a) => {
        const entry = urls?.[a.path];
        const isImage = a.mime.startsWith('image/');
        if (isImage) {
          return (
            <div key={a.path}>
              {entry?.url ? (
                <a href={entry.downloadUrl} target="_blank" rel="noreferrer" title={a.name}>
                  <img
                    src={entry.url}
                    alt={a.name}
                    style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 'var(--radius-sm)', display: 'block', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }}
                  />
                </a>
              ) : (
                <div className="flex items-center gap-2" style={{ fontSize: 11, opacity: 0.75 }}>
                  {error ? 'Attachment unavailable' : <><Loader2 size={13} className="animate-spin" /> Loading…</>}
                </div>
              )}
            </div>
          );
        }
        return (
          <a
            key={a.path}
            href={entry?.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-2.5 py-2 no-underline"
            style={{ borderRadius: 'var(--radius-sm)', background: mine ? 'rgba(255,255,255,0.16)' : 'var(--surface-soft)', color: mine ? '#fff' : 'var(--text)' }}
          >
            {fileIcon(a.mime, a.name)}
            <span className="min-w-0 flex-1">
              <span className="block truncate" style={{ fontSize: 12.5, fontWeight: 600 }}>{a.name}</span>
              <span className="block" style={{ fontSize: 10.5, opacity: 0.7 }}>{formatBytes(a.size)}</span>
            </span>
            {entry?.downloadUrl && <Download size={13} />}
            {!entry?.downloadUrl && !error && <Loader2 size={13} className="animate-spin" />}
            {error && <span style={{ fontSize: 10, opacity: 0.7 }}>Failed</span>}
          </a>
        );
      })}
    </div>
  );
}

function SharedPostCard({ data, mine }: { data: SharedPostData; mine: boolean }) {
  const { user: session } = useSession();
  const href = `/${session?.role ?? ''}/feed?post=${data.id}`;
  const tags = Array.isArray(data.tags) ? (data.tags as { label: string; emoji?: string }[]) : [];
  return (
    <Link
      href={href}
      className="block no-underline overflow-hidden"
      style={{ borderRadius: 'var(--radius-sm)', border: `1px solid ${mine ? 'rgba(255,255,255,0.3)' : 'var(--surface-border)'}`, background: mine ? 'rgba(255,255,255,0.14)' : 'var(--surface-soft)' }}
    >
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5"
        style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: mine ? 'rgba(255,255,255,0.9)' : 'var(--primary)', borderBottom: `1px solid ${mine ? 'rgba(255,255,255,0.2)' : 'var(--surface)'}` }}
      >
        <Share2 size={11} /> Shared post
      </div>
      {data.image && (
        <img
          src={data.image}
          alt=""
          style={{ display: 'block', width: '100%', maxHeight: 160, objectFit: 'cover', background: 'var(--surface)' }}
        />
      )}
      <div style={{ padding: '8px 10px 6px', fontSize: 12.5, lineHeight: 1.45, color: mine ? '#fff' : 'var(--text)' }}>
        <div style={{ fontWeight: 700, fontSize: 11.5, marginBottom: 3, color: mine ? 'rgba(255,255,255,0.85)' : 'var(--text-light)' }}>
          {data.author_name}
        </div>
        <div className="line-clamp-3" style={{ wordBreak: 'break-word' }}>{data.content}</div>
        {tags.length > 0 && (
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {tags.map((tag, i) => (
              <span
                key={i}
                style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, border: `1px solid ${mine ? 'rgba(255,255,255,0.35)' : 'var(--surface-border)'}`, background: mine ? 'rgba(255,255,255,0.12)' : 'var(--divider)' }}
              >
                {tag.emoji ? `${tag.emoji} ` : ''}{tag.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: '0 10px 8px', fontSize: 10.5, fontWeight: 600, color: mine ? 'rgba(255,255,255,0.85)' : 'var(--primary)' }}>
        View post →
      </div>
    </Link>
  );
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
  const [convTab, setConvTab] = useState<'direct' | 'group'>('direct');
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
  const [activeQuick, setActiveQuick] = useState<QuickGroup | null>(null);
  const [showManage, setShowManage] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [pendingFiles, setPendingFiles] = useState<{ file: File; preview?: string; error?: string }[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
          unread: ((conv.unread_map ?? {}) as Record<string, number>)[me] ?? 0,
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
    const conv = new URLSearchParams(window.location.search).get('conv');
    if (!conv) return;
    const t = setTimeout(() => {
      setConvTab('direct');
      setSelectedId(conv);
    }, 0);
    return () => clearTimeout(t);
  }, []);

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
      else { setMessages((data ?? []).map(toChatMessage).reverse()); setHasMoreMsgs((data?.length ?? 0) === MESSAGE_PAGE); }
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
      const batch: ChatMessage[] = (data ?? []).map(toChatMessage).reverse();
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

  const directCount = (conversations ?? []).filter((c) => !c.isGroup).length;
  const groupCount = (conversations ?? []).filter((c) => c.isGroup).length;
  const visibleConvs = (conversations ?? []).filter((c) =>
    convTab === 'group' ? c.isGroup : !c.isGroup
  );

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
    if (!selectedId || !me || (!content && pendingFiles.length === 0) || sending) return;
    setSending(true);
    try {
      let attachments: ChatAttachment[] = [];
      if (pendingFiles.length > 0) {
        const fd = new FormData();
        pendingFiles.forEach((p) => fd.append('files', p.file));
        const up = await fetch(`/api/conversations/${selectedId}/attachments`, { method: 'POST', body: fd });
        if (!up.ok) throw new Error((await up.json().catch(() => ({ message: 'Upload failed' }))).message);
        attachments = ((await up.json()).attachments as ChatAttachment[]) ?? [];
      }
      const res = await fetch(`/api/conversations/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, attachments }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Could not send message' }))).message);
      setDraft('');
      setPendingFiles((prev) => {
        prev.forEach((p) => { if (p.preview) URL.revokeObjectURL(p.preview); });
        return [];
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  const addPendingFiles = (list: FileList | null) => {
    if (!list) return;
    const files = [...list];
    setPendingFiles((prev) => {
      const next = [...prev];
      for (const f of files) {
        if (next.length >= 8) break;
        next.push({ file: f, preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined });
      }
      return next;
    });
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => {
      const p = prev[index];
      if (p?.preview) URL.revokeObjectURL(p.preview);
      return prev.filter((_, i) => i !== index);
    });
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

  const quickGroups = useMemo<QuickGroup[]>(() => {
    const semNo = (s: string) => Number((s.match(/\d+/) ?? [0])[0]) || 0;
    const semMap = new Map<string, QuickGroup>();
    const secMap = new Map<string, QuickGroup>();
    const years = new Set<string>();
    for (const p of people) {
      if (p.year) years.add(p.year);
      if (!p.semester) continue;
      const y = p.year ?? '';
      const semKey = `sem:${y}|${p.semester}`;
      if (!semMap.has(semKey)) semMap.set(semKey, { key: semKey, label: p.semester, emails: [], sem: p.semester, sec: '', year: y });
      semMap.get(semKey)!.emails.push(p.email);
      if (p.section) {
        const secKey = `sec:${y}|${p.semester}|${p.section}`;
        if (!secMap.has(secKey)) secMap.set(secKey, { key: secKey, label: `${p.semester} Section ${p.section}`, emails: [], sem: p.semester, sec: p.section, year: y });
        secMap.get(secKey)!.emails.push(p.email);
      }
    }
    const multiYear = years.size > 1;
    const cmp = (a: QuickGroup, b: QuickGroup) => a.year.localeCompare(b.year) || semNo(a.sem) - semNo(b.sem) || a.sem.localeCompare(b.sem) || a.sec.localeCompare(b.sec);
    return [...semMap.values(), ...secMap.values()].sort(cmp).map((g) => ({
      ...g,
      label: `Whole ${g.sem}${g.sec ? ` · Section ${g.sec}` : ''}${multiYear && g.year ? ` · ${g.year}` : ''}`,
    }));
  }, [people]);

  const toggleQuickGroup = (g: QuickGroup) => {
    if (activeQuick?.key === g.key) {
      setSelectedMembers((prev) => prev.filter((e) => !g.emails.includes(e)));
      setYearFilter('');
      setSemesterFilter('');
      setSectionFilter('');
      setActiveQuick(null);
      return;
    }
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      g.emails.forEach((e) => next.add(e));
      return [...next];
    });
    setYearFilter(g.year);
    setSemesterFilter(g.sem);
    setSectionFilter(g.sec);
    setSearch('');
    setActiveQuick(g);
  };

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
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-[18px] h-full min-h-[520px]">
      <div
        className="bg-base-100 backdrop-blur-xl flex flex-col max-h-[72vh] lg:max-h-none lg:h-full"
        style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}
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
        <div style={{ display: 'flex', gap: 4, padding: '8px 14px 0', borderBottom: '1px solid var(--surface)' }}>
          {([
            ['direct', 'Direct', directCount, MessageSquare],
            ['group', 'Groups', groupCount, Users],
          ] as const).map(([key, label, count, Icon]) => (
            <button
              key={key}
              onClick={() => setConvTab(key)}
              style={{
                padding: '9px 12px',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                background: 'none',
                color: convTab === key ? 'var(--primary)' : 'var(--text-light)',
                border: 'none',
                borderBottom: '2.5px solid',
                borderBottomColor: convTab === key ? 'var(--primary)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: -1,
              }}
            >
              <Icon size={13} />
              {label}
              <span
                className="flex items-center justify-center rounded-full"
                style={{
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  fontSize: 10.5,
                  fontWeight: 700,
                  background: convTab === key ? 'rgba(14, 165, 233,0.15)' : 'var(--surface-soft)',
                  color: convTab === key ? 'var(--primary)' : 'var(--text-light)',
                }}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {!conversations && (
            <div className="text-center py-10 text-xs" style={{ color: 'var(--text-lighter)' }}>Loading...</div>
          )}
          {conversations && visibleConvs.length === 0 && (
            <div className="text-center py-10 px-4">
              <p className="text-xs mb-4" style={{ color: 'var(--text-lighter)' }}>
                {conversations.length === 0 ? 'No conversations yet' : convTab === 'group' ? 'No group chats yet' : 'No direct messages yet'}
              </p>
              <button
                onClick={() => setShowNewChat(true)}
                className="btn btn-sm gap-1.5 border-none text-white cursor-pointer"
                style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
              >
                <Plus size={13} /> {convTab === 'group' ? 'Create group' : 'Find people'}
              </button>
            </div>
          )}
          {visibleConvs.map((conv) => {
            const displayName = conv.isGroup ? conv.groupName : conv.other.name;
            const displayInitials = conv.isGroup ? conv.groupName.slice(0, 2).toUpperCase() : conv.other.initials;
            const hasUnread = (conv.unread ?? 0) > 0;
            return (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-colors"
                style={{
                  borderBottom: '1px solid var(--surface)',
                  background: selectedId === conv.id ? 'rgba(14, 165, 233,0.10)' : 'transparent',
                }}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 12 }}>
                  {conv.isGroup ? <Users size={16} /> : displayInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span style={{ fontSize: 13.5, fontWeight: hasUnread ? 700 : 600, color: 'var(--accent)' }}>{displayName}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {hasUnread && (
                        <span
                          className="flex items-center justify-center rounded-full text-white font-bold"
                          style={{ minWidth: 18, height: 18, padding: '0 5px', fontSize: 10.5, background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
                        >
                          {conv.unread}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text-lighter)' }}>{timeLabel(conv.lastMessageAt)}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div
                      className="text-xs truncate"
                      style={{ color: hasUnread ? 'var(--text)' : 'var(--text-lighter)', fontWeight: hasUnread ? 600 : 400 }}
                    >
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
        className="bg-base-100 backdrop-blur-xl flex flex-col max-h-[72vh] lg:max-h-none lg:h-full"
        style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}
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
                      {m.content && <div>{m.content}</div>}
                      {m.attachments && m.attachments.length > 0 && (
                        <MessageAttachments
                          key={m.attachments.map((a) => (isSharedPost(a) ? `post:${a.post.id}` : a.path)).join('|')}
                          convId={selectedId ?? ''}
                          attachments={m.attachments}
                          mine={mine}
                        />
                      )}
                      <div className="text-[10px] mt-1" style={{ opacity: 0.7 }}>{timeLabel(m.created_at)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            <div style={{ borderTop: '1px solid var(--surface)' }}>
              {!composerDisabledReason && pendingFiles.length > 0 && (
                <div className="flex flex-wrap items-end gap-2 px-3 pt-2.5">
                  {pendingFiles.map((p, i) =>
                    p.preview ? (
                      <div key={i} className="relative shrink-0" style={{ width: 64, height: 64 }}>
                        <img src={p.preview} alt={p.file.name} className="w-full h-full object-cover" style={{ borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--surface-border)' }} />
                        <button
                          onClick={() => removePendingFile(i)}
                          className="absolute -top-2 -right-2 flex items-center justify-center cursor-pointer border-none rounded-full"
                          title="Remove"
                          style={{ width: 19, height: 19, background: 'var(--danger)', color: '#fff', fontSize: 10, lineHeight: 1 }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div key={i} className="flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 600, padding: '4px 6px 4px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--divider)', border: '1.5px solid var(--surface-border)', color: 'var(--text)' }}>
                        {fileIcon(p.file.type, p.file.name)}
                        <span className="max-w-[140px] truncate">{p.file.name}</span>
                        <button onClick={() => removePendingFile(i)} className="cursor-pointer border-none bg-transparent" style={{ color: 'var(--text-light)', fontSize: 12 }} title="Remove">✕</button>
                      </div>
                    )
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 p-3">
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
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={ATTACH_ACCEPT}
                      className="hidden"
                      onChange={(e) => { addPendingFiles(e.target.files); e.target.value = ''; }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sending}
                      className="flex items-center justify-center cursor-pointer border-none disabled:opacity-40"
                      title="Attach files"
                      style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', color: 'var(--text-light)', background: 'transparent' }}
                    >
                      <Paperclip size={15} />
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={(!draft.trim() && pendingFiles.length === 0) || sending}
                      className="flex items-center justify-center cursor-pointer border-none disabled:opacity-30"
                      style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', color: '#fff', background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
                    >
                      {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                  </div>
                )}
              </div>
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
                  onClick={() => { setYearFilter(''); setSemesterFilter(''); setSectionFilter(''); setActiveQuick(null); }}
                  className="btn btn-ghost btn-xs"
                  style={{ color: 'var(--text-lighter)', fontSize: 11 }}
                >
                  Clear
                </button>
              )}
            </div>

            {chatMode === 'group' && quickGroups.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5" style={{ padding: '10px 20px 12px', borderBottom: '1px solid var(--surface)' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-light)' }}>Quick pick:</span>
                {quickGroups.map((g) => {
                  const active = activeQuick?.key === g.key;
                  return (
                    <button
                      key={g.key}
                      onClick={() => toggleQuickGroup(g)}
                      className="cursor-pointer"
                      title={`Select everyone in ${g.sem}${g.sec ? ` section ${g.sec}` : ''} (${g.emails.length} people)`}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: 14,
                        border: `1.5px solid ${active ? 'var(--primary)' : 'var(--surface-border)'}`,
                        background: active ? 'rgba(14, 165, 233,0.15)' : 'var(--divider)',
                        color: active ? 'var(--primary)' : 'var(--text)',
                      }}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            )}

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
                      style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 12, background: 'rgba(14, 165, 233,0.15)', color: 'var(--primary)', border: 'none' }}
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
                      background: isSelected ? 'rgba(14, 165, 233,0.10)' : undefined,
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
