'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import Link from 'next/link';
import {
  MessageSquare, Send, Plus, Search, UserCheck, UserX, Ban, RotateCcw, Clock,
  Users, Check, Filter, Settings, UserMinus, Trash2, Paperclip, FileText,
  FileSpreadsheet, File, Download, Loader2, Image as ImageIcon, Share2, LogOut,
  Ellipsis, Pencil, X, CheckCheck, ArrowLeft,
} from 'lucide-react';
import { useSupabase } from '@/utils/supabase/client';
import type { Database } from '@/utils/supabase/types';
import { uniqueChannelName } from '@/lib/supabase/hooks';
import { useSession } from './session';
import { usePresence } from './PresenceProvider';
import { useUniversityPeople, useUniversityRaw } from './useUniversityPeople';
import { apiFetch, type AcademicTermRecord } from './api';
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
  hiddenAt?: number;
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

type RawAttachment = Record<string, unknown>;

function normalizeAttachments(raw: unknown): MessageAttachment[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw.map((entry) => {
    const a = (entry ?? {}) as RawAttachment;
    if (a.kind === 'post' || a.post || a.post_data) {
      const post = ((a.post ?? a.post_data) ?? {}) as RawAttachment;
      return {
        kind: 'post',
        post: {
          id: (post.id ?? a.feed_post_id ?? '') as string,
          content: (post.content ?? a.shared_content ?? '') as string,
          author_name: (post.author_name ?? '') as string,
          image: (post.image ?? null) as string | null,
          created_at: post.created_at as number | undefined,
          tags: post.tags as unknown,
        },
      } as SharedPostEntry;
    }
    return a as unknown as ChatAttachment;
  });
}

function isSharedPost(a: MessageAttachment): a is SharedPostEntry {
  const x = a as { kind?: string; post?: unknown; post_data?: unknown };
  return x.kind === 'post' || !!x.post || !!x.post_data;
}

interface ChatMessage {
  id: string;
  sender_email: string;
  sender_name: string;
  sender_initials?: string;
  content: string;
  attachments?: MessageAttachment[];
  created_at: number;
  editedAt?: number | null;
  isDeleted?: boolean;
  is_read?: boolean;
  pending?: boolean;
}

const ATTACH_ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,.csv,.zip';

type ChatMessageRow = Database['public']['Tables']['chat_messages']['Row'];

function toChatMessage(m: ChatMessageRow): ChatMessage {
  const row = m as unknown as RawAttachment;
  let attachments = normalizeAttachments(m.attachments);
  if ((!attachments || attachments.length === 0) && (row.post_data || row.feed_post_id || row.shared_content)) {
    attachments = normalizeAttachments([
      { kind: 'post', post: row.post_data ?? {}, feed_post_id: row.feed_post_id, shared_content: row.shared_content },
    ]);
  }
  const rawEdited = row.edited_at as number | string | null | undefined;
    const editedAt = typeof rawEdited === 'string' ? Date.parse(rawEdited) : (rawEdited ?? null);
    return {
    id: m.id,
    sender_email: m.sender_email,
    sender_name: m.sender_name,
    content: m.content,
    created_at: m.created_at,
    editedAt: Number.isNaN(editedAt) ? null : editedAt,
    isDeleted: (row.is_deleted as boolean | undefined) ?? false,
    is_read: m.is_read,
    attachments,
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

function lastSeenLabel(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function extractMentionTokens(text: string, memberNames: string[] = []): string[] {
  const re = buildMentionRegex([...new Set([...memberNames, 'everyone'])].filter(Boolean));
  if (!re) return [];
  return text.match(re)?.map((t) => t.slice(1).toLowerCase()) ?? [];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMentionRegex(memberNames: string[]): RegExp | null {
  const names = [...new Set(memberNames.map((n) => n.trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) return null;
  return new RegExp(`(@(?:${names.map(escapeRegex).join('|')}))(?=\\s|$|[.,!?;:…])`, 'gi');
}

interface MentionRenderOpts {
  regex: RegExp | null;
  onMention: (name: string) => void;
}

function renderMentionedContent(content: string, opts: MentionRenderOpts): ReactNode {
  if (!opts.regex) return content;
  const parts = content.split(opts.regex);
  return (
    <>
      {parts.map((part, i) => {
        if (!part.startsWith('@') || part.length === 1) return part;
        return (
          <span
            key={i}
            className="italic underline decoration-accent decoration-2 underline-offset-2 text-accent font-semibold cursor-pointer hover:text-accent-focus hover:opacity-80 transition-colors"
            title={`View ${part}'s profile`}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              opts.onMention(part.slice(1));
            }}
          >
            {part}
          </span>
        );
      })}
    </>
  );
}

export default function MessagesSection() {
  const supabase = useSupabase();
  const { user: session } = useSession();
  const me = session?.email ?? '';

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
  const [isTyping, setIsTyping] = useState(false);
  const typingChanRef = useRef<RealtimeChannel | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const draftInputRef = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef(0);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingMsg, setDeletingMsg] = useState(false);
  type MentionProfile = { kind: 'member'; email: string; name: string; initials: string } | { kind: 'group' };
  const [selectedMentionUser, setSelectedMentionUser] = useState<MentionProfile | null>(null);
  const isProfileModalOpen = selectedMentionUser !== null;
  type ConfirmState = { kind: 'hide'; conv: ConvInfo } | { kind: 'leave' } | { kind: 'deleteMsg'; messageId: string };
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [sendPulse, setSendPulse] = useState(0);
  const [readMap, setReadMap] = useState<Record<string, { email: string; readAt: number }[]>>({});
  const [readOpenFor, setReadOpenFor] = useState<string | null>(null);
  const MESSAGE_PAGE = 20;
  const [prevSelectedId, setPrevSelectedId] = useState<string | null>(selectedId);
  if (prevSelectedId !== selectedId) {
    setPrevSelectedId(selectedId);
    setMessages(null);
    setHasMoreMsgs(false);
    setMentionQuery(null);
  }

  const lastReadMarkRef = useRef(0);
  const markMessagesRead = useCallback(() => {
    if (!selectedId || !me) return;
    fetch(`/api/conversations/${selectedId}/messages`, { method: 'PATCH' }).catch(() => {});
  }, [selectedId, me]);

  const { people, loading: peopleLoading, error: peopleError, refresh: peopleRefresh } = useUniversityPeople();
  const { users, students, staff } = useUniversityRaw();

  const [termMap, setTermMap] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    if (!isProfileModalOpen || termMap) return;
    let cancelled = false;
    apiFetch<AcademicTermRecord[]>('/api/terms')
      .then((rows) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const t of rows) map[t.termId] = `Academic Year ${t.academicYear}`;
        setTermMap(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isProfileModalOpen, termMap]);

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
        const meta = (conv.participant_meta as Array<{ email: string; name: string; initials: string }>) || [];
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
          hiddenAt: ((conv.hidden_map ?? {}) as Record<string, number>)[me],
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
      .channel(uniqueChannelName(`chat-room:${selectedId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${selectedId}` }, (payload) => {
        setMessages((prev) => {
          if (!prev) return prev;
          if (payload.eventType === 'INSERT') {
            const m = toChatMessage(payload.new as ChatMessageRow);
            const existing = prev.find((x) => x.id === m.id);
            if (existing) {
              return prev.map((x) => (x.id === m.id ? { ...x, ...m, pending: false } : x));
            }
            if (m.sender_email !== me) {
              markMessagesRead();
            }
            return [...prev, m];
          }
          if (payload.eventType === 'DELETE') return prev.filter((m) => m.id !== (payload.old as ChatMessageRow).id);
          const updated = toChatMessage(payload.new as ChatMessageRow);
          return prev.map((m) =>
            m.id === updated.id
              ? { ...m, ...updated, attachments: updated.attachments ?? m.attachments }
              : m
          );
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reads', filter: `conversation_id=eq.${selectedId}` }, (payload) => {
        const nr = payload.new as { message_id: string; reader_email: string; read_at: number };
        if (!nr?.message_id || !nr.reader_email) return;
        setReadMap((prev) => {
          const list = [...(prev[nr.message_id] ?? []).filter((r) => r.email !== nr.reader_email), { email: nr.reader_email, readAt: nr.read_at }];
          return { ...prev, [nr.message_id]: list };
        });
        setMessages((prev) => prev?.map((m) => (m.id === nr.message_id ? { ...m, is_read: true } : m)) ?? prev);
      })
      .subscribe();
    fetch(`/api/conversations/${selectedId}/messages/reads`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { message_id: string; reader_email: string; read_at: number }[]) => {
        const map: Record<string, { email: string; readAt: number }[]> = {};
        for (const r of rows) {
          (map[r.message_id] ??= []).push({ email: r.reader_email, readAt: r.read_at });
        }
        setReadMap(map);
      })
      .catch(() => {});
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, selectedId, me, markMessagesRead]);

  useEffect(() => {
    if (!selectedId || !me) return;
    const t = setTimeout(() => {
      markMessagesRead();
    }, 400);
    return () => clearTimeout(t);
  }, [selectedId, me, markMessagesRead]);

  useEffect(() => {
    if (!selectedId || !me) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') markMessagesRead();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [selectedId, me, markMessagesRead]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset typing state on conversation switch
    setIsTyping(false);
    setReadOpenFor(null);
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (!selectedId || !me) return;
    const ch = supabase
      .channel(`typing:conv:${selectedId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!payload || payload.sender === me) return;
        setIsTyping(true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setIsTyping(false), 2500);
      })
      .subscribe();
    typingChanRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      typingChanRef.current = null;
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [supabase, selectedId, me]);

  const broadcastTyping = useCallback(() => {
    const ch = typingChanRef.current;
    if (!ch || ch.state !== 'joined' || !me) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 900) return;
    lastTypingSentRef.current = now;
    ch.send({ type: 'broadcast', event: 'typing', payload: { sender: me } }).catch(() => {});
  }, [me]);

  const conversationsRef = useRef(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel(uniqueChannelName('public:chat_messages:incoming'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `sender_email=neq.${me}` }, async (payload) => {
        const row = payload.new as ChatMessageRow;
        const conv = (conversationsRef.current ?? []).find((c) => c.id === row.conversation_id);
        if (!conv?.hiddenAt) return;
        fetch(`/api/conversations/${row.conversation_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unhide' }),
        }).catch(() => {});
        setConversations((prev) => prev?.map((c) => (c.id === row.conversation_id ? { ...c, hiddenAt: undefined } : c)) ?? prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, me]);

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
    const now = Date.now();
    if (now - lastReadMarkRef.current > 2000) {
      lastReadMarkRef.current = now;
      markMessagesRead();
    }
  }, [loadOlder, markMessagesRead]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selected: ConvInfo | null = selectedId
    ? (conversations?.find((c) => c.id === selectedId) ?? null)
    : null;
  const iAmRequester = selected ? selected.requestedBy === me : false;
  const selectedIsCreator = selected ? selected.creatorEmail === me : false;

  const { presence } = usePresence();
  const otherPresence = selected && !selected.isGroup ? presence[selected.other.email] : undefined;
  const otherOnline = !!otherPresence?.online;
  const [dbLastSeenByConv, setDbLastSeenByConv] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!selected || selected.isGroup) return;
    if (otherPresence?.online || otherPresence?.last_seen) return;
    if (dbLastSeenByConv[selected.id]) return;
    let cancelled = false;
    fetch(`/api/presence?email=${encodeURIComponent(selected.other.email)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.last_seen) return;
        setDbLastSeenByConv((prev) => (prev[selected.id] ? prev : { ...prev, [selected.id]: d.last_seen }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selected?.id, selected?.isGroup, otherPresence?.online, otherPresence?.last_seen, dbLastSeenByConv, selected]);
  const displayLastSeen = otherPresence?.last_seen ?? (selected ? dbLastSeenByConv[selected.id] : undefined) ?? null;

  const directCount = (conversations ?? []).filter((c) => !c.isGroup).length;
  const groupCount = (conversations ?? []).filter((c) => c.isGroup).length;
  const visibleConvs = (conversations ?? []).filter((c) =>
    convTab === 'group' ? c.isGroup && !c.hiddenAt : !c.isGroup && !c.hiddenAt
  );

  const hideConversation = async (convId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hide' }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Could not delete chat' }))).message);
      setConversations((prev) => prev?.map((c) => (c.id === convId ? { ...c, hiddenAt: Date.now() } : c)) ?? prev);
      if (selectedId === convId) setSelectedId(null);
      setConfirmState(null);
    } catch (e) {
      setConfirmState(null);
      toast.error(e instanceof Error ? e.message : 'Could not delete chat');
    }
  };

  const leaveGroup = async () => {
    if (!selectedId || !selected?.isGroup) return;
    try {
      const res = await fetch(`/api/conversations/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Could not leave group' }))).message);
      toast.success('You left the group');
      setSelectedId(null);
      setConfirmState(null);
      setShowManage(false);
    } catch (e) {
      setConfirmState(null);
      toast.error(e instanceof Error ? e.message : 'Could not leave group');
    }
  };

  const startEditMessage = (m: ChatMessage) => {
    if (m.isDeleted) return;
    setEditingId(m.id);
    setEditText(m.content);
  };

  const cancelEditMessage = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEditMessage = async () => {
    if (!editingId || !selectedId || savingEdit) return;
    const content = editText.trim();
    if (!content) return;
    const msgId = editingId;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/conversations/${selectedId}/messages/${msgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Could not edit message' }))).message);
      cancelEditMessage();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not edit message');
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteMessage = async () => {
    if (!selectedId || confirmState?.kind !== 'deleteMsg' || deletingMsg) return;
    const msgId = confirmState.messageId;
    setDeletingMsg(true);
    try {
      const res = await fetch(`/api/conversations/${selectedId}/messages/${msgId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Could not delete message' }))).message);
      setMessages((prev) => prev?.map((m) => (m.id === msgId ? { ...m, isDeleted: true, content: '' } : m)) ?? prev);
      setConfirmState(null);
    } catch (e) {
      setConfirmState(null);
      toast.error(e instanceof Error ? e.message : 'Could not delete message');
    } finally {
      setDeletingMsg(false);
    }
  };

  const normalizeName = (raw: string) => raw.toLowerCase().replace(/\s+/g, ' ').trim();

  const handleMentionClick = (rawName: string) => {
    if (!selected) return;
    const token = normalizeName(rawName);
    if (token === 'everyone') { setSelectedMentionUser({ kind: 'group' }); return; }
    const member =
      selected.members.find((m) => normalizeName(m.name) === token) ??
      people.find((p) => normalizeName(p.name) === token);
    if (member) setSelectedMentionUser({ kind: 'member', email: member.email, name: member.name, initials: member.initials });
  };

  const mentionMember = selectedMentionUser?.kind === 'member' ? selectedMentionUser : null;
  const mentionPerson = mentionMember ? people.find((p) => p.email === mentionMember.email) : undefined;
  const mentionStudent = mentionMember ? students.find((s) => s.email.toLowerCase() === mentionMember.email.toLowerCase()) : undefined;
  const mentionUserRec = mentionMember ? users.find((u) => u.email.toLowerCase() === mentionMember.email.toLowerCase()) : undefined;
  const mentionStaff = mentionMember && mentionUserRec ? staff.find((s) => s.userId === mentionUserRec.userId) : undefined;
  const profileColumns: { title: string; rows: [string, string][] }[] = [
    {
      title: 'Academic Profile',
      rows: [
        ['Roll Number', mentionStudent?.rollNo ?? ''],
        ['Batch Year', mentionStudent?.batchYear != null ? String(mentionStudent.batchYear) : mentionStaff?.batchYear != null ? String(mentionStaff.batchYear) : ''],
        ['Address', mentionStudent?.address ?? mentionStaff?.address ?? ''],
      ],
    },
    {
      title: 'Contact & Status',
      rows: [
        ['Email', mentionMember?.email ?? ''],
        ['Phone Number', mentionStudent?.phoneNo ?? mentionStaff?.phoneNo ?? ''],
        ['Academic Term', mentionStudent?.termId ? (termMap?.[mentionStudent.termId] ?? '') : ''],
      ],
    },
    {
      title: 'Program Details',
      rows: [
        ['Major', mentionStudent?.majorCode ?? ''],
        ['Semester', mentionStudent ? `Semester ${mentionStudent.semesterNo}` : ''],
        ['Section', mentionStudent?.sectionName ?? ''],
      ],
    },
  ];
  const mentionMemberOnline = mentionMember ? !!presence[mentionMember.email]?.online : false;
  const mentionMemberLastSeen = mentionMember ? (presence[mentionMember.email]?.last_seen ?? 0) : 0;
  const mentionGroupOnlineCount = selectedMentionUser?.kind === 'group'
    ? (selected?.members ?? []).filter((m) => presence[m.email]?.online).length
    : 0;

  const mentionRegex = buildMentionRegex([...(selected?.members ?? []).map((m) => m.name), 'everyone']);

  const mentionCandidates = (() => {
    if (!selected?.isGroup) return [] as { key: string; token: string; name: string; sub: string; everyone?: boolean }[];
    const q = (mentionQuery ?? '').toLowerCase();
    const out: { key: string; token: string; name: string; sub: string; everyone?: boolean }[] = [];
    if (q === '' || 'everyone'.startsWith(q)) {
      out.push({ key: 'everyone', token: 'everyone', name: '@everyone', sub: 'Notify all members', everyone: true });
    }
    const seen = new Set<string>();
    for (const m of selected.members) {
      if (m.email === me) continue;
      if (!m.name.toLowerCase().includes(q) && !m.email.toLowerCase().includes(q)) continue;
      if (seen.has(m.email)) continue;
      seen.add(m.email);
      out.push({ key: m.email, token: m.name, name: `@${m.name}`, sub: m.email });
    }
    return out.slice(0, 8);
  })();

  const handleDraftChange = (value: string, caret: number) => {
    caretRef.current = caret;
    const before = value.slice(0, caret);
    const m = /(?:^|\s)@([\w.\-]*)$/.exec(before);
    if (m && selected?.isGroup) {
      setMentionQuery(m[1]);
    } else if (selected?.isGroup) {
      const at = before.lastIndexOf('@');
      const prev = at > 0 ? before[at - 1] : ' ';
      if (at !== -1 && (at === 0 || /\s/.test(prev))) {
        const tail = before.slice(at + 1);
        if (!tail.includes('\n')) setMentionQuery(tail);
        else setMentionQuery(null);
      } else {
        setMentionQuery(null);
      }
    } else {
      setMentionQuery(null);
    }
    setDraft(value);
    if (value.trim()) broadcastTyping();
  };

  const insertMention = (token: string) => {
    const caret = caretRef.current;
    const before = draft.slice(0, caret);
    const after = draft.slice(caret);
    const m = /(?:^|\s)@([\w.\-]*)$/.exec(before);
    let start = -1;
    if (m) {
      start = caret - m[1].length - 1;
    } else {
      const at = before.lastIndexOf('@');
      if (at !== -1 && (at === 0 || /\s/.test(before[at - 1]))) start = at;
    }
    if (start < 0) { setMentionQuery(null); return; }
    const next = `${draft.slice(0, start)}@${token} ${after}`;
    setDraft(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const el = draftInputRef.current;
      if (el) {
        el.focus();
        const pos = start + token.length + 2;
        el.setSelectionRange(pos, pos);
      }
    });
  };

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
        body: JSON.stringify({
          content,
          attachments,
          mentions: selected?.isGroup
            ? [...new Set(extractMentionTokens(draft, (selected?.members ?? []).map((m) => m.name)).map((t) => {
                if (t === 'everyone') return 'everyone';
                return (selected?.members ?? []).find((m) => m.name.toLowerCase() === t)?.email ?? '';
              }).filter(Boolean))]
            : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Could not send message' }))).message);
      setSendPulse((c) => c + 1);
      const sentRow = (await res.json()) as ChatMessageRow;
      setMessages((prev) => {
        const base = prev ?? [];
        if (base.some((x) => x.id === sentRow.id)) {
          return base.map((x) => (x.id === sentRow.id ? { ...x, ...toChatMessage(sentRow), pending: false } : x));
        }
        return [...base, { ...toChatMessage(sentRow), pending: true }];
      });
      lastTypingSentRef.current = 0;
      setDraft('');
      setMentionQuery(null);
      const ta = draftInputRef.current;
      if (ta) ta.style.height = 'auto';
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
        <span className="badge badge-sm gap-1 shrink-0" style={{ background: 'rgba(251,191,36,0.15)', color: '#d97706', border: 'none' }}>
          <Clock size={10} /> Pending
        </span>
      );
    }
    if (status === 'blocked') {
      return (
        <span className="badge badge-sm gap-1 shrink-0" style={{ background: 'rgba(248,113,113,0.15)', color: '#dc2626', border: 'none' }}>
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
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-[18px] h-full min-h-0">
      <div
        className={`bg-base-100 backdrop-blur-xl flex-col max-h-[72vh] lg:max-h-none lg:h-full lg:min-h-0 ${selected ? 'hidden lg:flex' : 'flex'}`}
        style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}
      >
        <div className="flex-shrink-0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--surface)' }}>
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
        <div className="flex-shrink-0" style={{ display: 'flex', gap: 4, padding: '8px 14px 0', borderBottom: '1px solid var(--surface)' }}>
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
                  background: convTab === key ? 'rgba(40, 114, 161,0.15)' : 'var(--surface-soft)',
                  color: convTab === key ? 'var(--primary)' : 'var(--text-light)',
                }}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
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
          <AnimatePresence initial={false}>
            {visibleConvs.map((conv) => {
              const displayName = conv.isGroup ? conv.groupName : conv.other.name;
              const displayInitials = conv.isGroup ? conv.groupName.slice(0, 2).toUpperCase() : conv.other.initials;
              const hasUnread = (conv.unread ?? 0) > 0;
              const isConvUserOnline = !conv.isGroup && !!presence[conv.other.email]?.online;
              return (
                <motion.div
                  key={conv.id}
                  layout
                  initial={{ opacity: 0, x: -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -100, height: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  className="relative group"
                >
                <button
                  onClick={() => setSelectedId(conv.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-colors"
                  style={{
                    borderBottom: '1px solid var(--surface)',
                    background: selectedId === conv.id ? 'rgba(40, 114, 161,0.10)' : 'transparent',
                  }}
                >
                  <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 12 }}>
                    {conv.isGroup ? <Users size={16} /> : displayInitials}
                    {isConvUserOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full ring-2 ring-base-100" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex-1 min-w-0 truncate" style={{ fontSize: 13.5, fontWeight: hasUnread ? 700 : 600, color: 'var(--accent)' }}>{displayName}</span>
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
                        className="text-xs truncate min-w-0"
                        style={{ color: hasUnread ? 'var(--text)' : 'var(--text-lighter)', fontWeight: hasUnread ? 600 : 400 }}
                      >
                        {conv.isGroup ? `${conv.members.length + 1} members \u2022 ` : ''}{conv.preview || 'No messages yet'}
                      </div>
                      {!conv.isGroup && statusBadge(conv.status)}
                    </div>
                  </div>
                </button>
                <div className="absolute bottom-2 right-2 z-10">
                  <button
                    onClick={() => setConfirmState({ kind: 'hide', conv })}
                    className="btn btn-ghost btn-xs btn-circle text-error opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete chat"
                    style={selectedId === conv.id ? { opacity: 1 } : undefined}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        </div>
      </div>

      <div
        className={`bg-base-100 backdrop-blur-xl flex-col ${selected ? 'flex h-[calc(100dvh-100px)]' : 'hidden'} lg:flex lg:h-full lg:min-h-0`}
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
            <div className="flex-shrink-0" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--surface)' }}>
              <button
                onClick={() => setSelectedId(null)}
                className="lg:hidden flex items-center justify-center cursor-pointer border-none shrink-0"
                style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', color: 'var(--text-light)', background: 'var(--divider)', border: '1.5px solid var(--surface-border)' }}
                title="Back to conversations"
                aria-label="Back to conversations"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 12 }}>
                {selected.isGroup ? <Users size={15} /> : selected.other.initials}
                {!selected.isGroup && otherOnline && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full ring-2 ring-base-100" />
                )}
              </div>
              <div className="flex-1">
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                  {selected.isGroup ? selected.groupName : selected.other.name}
                </div>
                <div className="flex items-center gap-1.5" style={{ fontSize: 11.5, color: 'var(--text-lighter)' }}>
                  {!selected.isGroup && selected.status === 'active' && isTyping ? (
                    <>
                      typing
                      <span className="loading loading-dots loading-xs text-primary" />
                    </>
                  ) : !selected.isGroup && selected.status === 'active' && otherOnline ? (
                    <span className="text-success font-semibold">Online</span>
                  ) : !selected.isGroup && selected.status === 'active' && displayLastSeen ? (
                    `Last seen ${lastSeenLabel(displayLastSeen)}`
                  ) : selected.isGroup ? (
                    `${selected.members.length} members`
                  ) : (
                    statusBadge(selected.status) ?? 'UniConnect'
                  )}
                </div>
              </div>
              {selected.isGroup && selectedIsCreator && (
                <button
                  onClick={openGroupManage}
                  className="btn btn-ghost btn-sm gap-1.5"
                  style={{ color: 'var(--primary)', border: '1.5px solid var(--surface-border)' }}
                  title="Manage group"
                >
                  <Settings size={14} /> <span className="hidden sm:inline">Manage</span>
                </button>
              )}
              {selected.isGroup && !selectedIsCreator && (
                <button
                  onClick={() => setConfirmState({ kind: 'leave' })}
                  className="btn btn-error btn-outline btn-xs gap-1.5"
                  title="Leave group"
                >
                  <LogOut size={12} /> <span className="hidden sm:inline">Leave Group</span>
                </button>
              )}
              {!selected.isGroup && selected.status === 'active' && (
                <button
                  onClick={() => handleConversationAction('block')}
                  className="btn btn-ghost btn-sm gap-1.5"
                  style={{ color: 'var(--danger)', border: '1.5px solid var(--surface-border)' }}
                  title="Block user"
                >
                  <Ban size={14} /> <span className="hidden sm:inline">Block</span>
                </button>
              )}
              {!selected.isGroup && selected.status === 'blocked' && selected.blockedBy === me && (
                <button
                  onClick={() => handleConversationAction('unblock')}
                  className="btn btn-ghost btn-sm gap-1.5"
                  style={{ color: 'var(--primary)', border: '1.5px solid var(--surface-border)' }}
                  title="Unblock user"
                >
                  <RotateCcw size={14} /> <span className="hidden sm:inline">Unblock</span>
                </button>
              )}
              {!selected.isGroup && selected.status === 'pending' && !iAmRequester && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleConversationAction('accept')}
                    className="btn btn-sm gap-1.5 border-none text-white"
                    style={{ background: 'linear-gradient(var(--success), var(--success-dark))' }}
                  >
                    <UserCheck size={14} /> <span className="hidden sm:inline">Accept</span>
                  </button>
                  <button
                    onClick={() => handleConversationAction('reject')}
                    className="btn btn-sm gap-1.5 border-none text-white"
                    style={{ background: 'linear-gradient(var(--danger), var(--danger-dark))' }}
                  >
                    <UserX size={14} /> <span className="hidden sm:inline">Decline</span>
                  </button>
                </div>
              )}
            </div>

            <div ref={msgScrollRef} onScroll={handleMsgScroll} className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
              {loadingOlder && (
                <div className="text-center py-2 text-[11px]" style={{ color: 'var(--text-lighter)' }}>
                  Loading earlier messages...
                </div>
              )}
              {!messages && (
                <div className="text-center py-10 text-xs" style={{ color: 'var(--text-lighter)' }}>Loading...</div>
              )}
              <AnimatePresence initial={false}>
              {messages?.map((m) => {
                const mine = m.sender_email === me;
                const showSender = !mine && selected.isGroup;
                const isEditing = editingId === m.id;
                return (
                  <motion.div
                    key={m.id}
                    layout
                    initial={{ scale: 0.9, opacity: 0, y: 15 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -6 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                    className={`flex mb-3 group ${mine ? 'justify-end' : 'justify-start'}`}
                  >
                    {showSender && (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-white font-bold shrink-0 mr-2 mt-1" style={{ fontSize: 9 }}>
                        {(m.sender_name || m.sender_email).slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="relative max-w-[75%]">
                      {mine && !m.isDeleted && (
                        <div className="absolute -top-2 -right-2 z-20 dropdown dropdown-end">
                          <button
                            tabIndex={0}
                            className="btn btn-circle btn-ghost btn-xs opacity-0 group-hover:opacity-100 focus-within:opacity-100 bg-base-100/80 shadow-md transition-opacity"
                            title="Message options"
                          >
                            <Ellipsis size={14} />
                          </button>
                          <ul
                            tabIndex={0}
                            className="dropdown-content menu menu-xs bg-base-100 rounded-box z-50 w-32 shadow-lg border"
                            style={{ borderColor: 'var(--surface-border)' }}
                          >
                            <li>
                              <button onClick={() => startEditMessage(m)}>
                                <Pencil size={12} /> Edit
                              </button>
                            </li>
                            <li>
                              <button
                                onClick={() => setConfirmState({ kind: 'deleteMsg', messageId: m.id })}
                                className="text-error"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            </li>
                          </ul>
                        </div>
                      )}
                      <div
                        className="px-4 py-2.5"
                        style={{
                          borderRadius: mine ? 'var(--radius-md) 0 var(--radius-md) var(--radius-md)' : '0 var(--radius-md) var(--radius-md) var(--radius-md)',
                          background: mine ? 'linear-gradient(var(--primary), var(--primary-dark))' : 'var(--divider)',
                          color: mine ? '#fff' : 'var(--text)',
                          fontSize: 13.5,
                          lineHeight: 1.5,
                        }}
                      >
                        {m.isDeleted ? (
                          <div className="italic" style={{ opacity: 0.6, fontSize: 12.5 }}>
                            This message was deleted
                          </div>
                        ) : isEditing ? (
                          <div>
                            <textarea
                              autoFocus
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void saveEditMessage(); }
                                if (e.key === 'Escape') cancelEditMessage();
                              }}
                              rows={2}
                              className="w-full outline-none resize-none"
                              style={{
                                background: 'rgba(255,255,255,0.14)',
                                border: '1.5px solid rgba(255,255,255,0.3)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '6px 10px',
                                fontSize: 13,
                                color: '#fff',
                                lineHeight: 1.5,
                                fontFamily: 'inherit',
                              }}
                            />
                            <div className="flex items-center gap-2 mt-1.5">
                              <button
                                onClick={() => void saveEditMessage()}
                                disabled={!editText.trim() || savingEdit}
                                className="flex items-center gap-1 px-2.5 py-1 font-semibold border-none disabled:opacity-40 cursor-pointer"
                                style={{ borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 11.5 }}
                              >
                                {savingEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {savingEdit ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEditMessage}
                                className="flex items-center gap-1 px-2.5 py-1 font-semibold border-none cursor-pointer"
                                style={{ borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 11.5 }}
                              >
                                <X size={12} /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {showSender && (
                              <div className="text-[10.5px] font-semibold mb-0.5" style={{ color: 'var(--primary)' }}>{m.sender_name || m.sender_email}</div>
                            )}
                            {m.content && (
                              <div style={{ whiteSpace: 'pre-wrap' }}>
                                {renderMentionedContent(m.content, {
                                  regex: mentionRegex,
                                  onMention: handleMentionClick,
                                })}
                              </div>
                            )}
                            {m.attachments && m.attachments.length > 0 && (
                              <MessageAttachments
                                key={m.attachments.map((a) => (isSharedPost(a) ? `post:${a.post.id}` : a.path)).join('|')}
                                convId={selectedId ?? ''}
                                attachments={m.attachments}
                                mine={mine}
                              />
                            )}
                          </>
                        )}
                        <div className="text-[10px] mt-1 flex items-center gap-1.5" style={{ opacity: 0.7 }}>
                          <span>{timeLabel(m.created_at)}</span>
                          {m.editedAt && <span className="italic">(edited)</span>}
                          {mine && !m.isDeleted && !isEditing && (
                            selected.isGroup ? (
                              <span className="relative inline-flex">
                                <button
                                  onClick={() => setReadOpenFor(readOpenFor === m.id ? null : m.id)}
                                  className="inline-flex items-center cursor-pointer border-none bg-transparent p-0"
                                  title="Read by members"
                                >
                                  {m.pending ? (
                                    <Clock size={11} />
                                  ) : (readMap[m.id] ?? []).length > 0 ? (
                                    <CheckCheck size={11} style={{ color: '#9ecbe4' }} />
                                  ) : (
                                    <Check size={11} />
                                  )}
                                </button>
                                {readOpenFor === m.id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 6 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 4 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                    className="absolute bottom-full right-0 mb-1.5 z-40 w-60 rounded-xl bg-base-100 shadow-xl border p-3"
                                    style={{ borderColor: 'var(--surface-border)' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {(() => {
                                      const readers = (readMap[m.id] ?? []).filter((r) => r.email !== me);
                                      return (
                                        <>
                                          <div className="text-xs font-bold mb-2" style={{ color: 'var(--accent)' }}>
                                            {readers.length > 0
                                              ? `Read by ${readers.length} ${readers.length === 1 ? 'member' : 'members'}`
                                              : 'Not read by anyone yet'}
                                          </div>
                                          {readers.map((r) => {
                                            const member = selected.members.find((mm) => mm.email === r.email);
                                            return (
                                              <div key={r.email} className="flex items-center gap-2 mb-1.5 last:mb-0">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 8 }}>
                                                  {member?.initials ?? r.email.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                  <div className="truncate" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)' }}>
                                                    {member?.name ?? r.email}
                                                  </div>
                                                  <div style={{ fontSize: 10, opacity: 0.6, color: 'var(--text-lighter)' }}>
                                                    Read {timeLabel(r.readAt)}
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </>
                                      );
                                    })()}
                                  </motion.div>
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5">
                                {m.pending ? (
                                  <Clock size={11} />
                                ) : m.is_read ? (
                                  <CheckCheck size={11} style={{ color: '#9ecbe4' }} />
                                ) : (
                                  <Check size={11} />
                                )}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
              <div ref={endRef} />
            </div>

            <div className="flex-shrink-0 relative pb-[env(safe-area-inset-bottom)]" style={{ borderTop: '1px solid var(--surface)' }}>
              {mentionQuery !== null && mentionCandidates.length > 0 && (
                <div className="absolute bottom-full left-3 right-3 z-30 mb-1">
                  <ul
                    className="menu menu-sm bg-base-100 rounded-box w-full max-h-52 overflow-y-auto shadow-lg border"
                    style={{ borderColor: 'var(--surface-border)' }}
                  >
                    {mentionCandidates.map((opt) => (
                      <li key={opt.key}>
                        <button onClick={() => insertMention(opt.token)}>
                          <span
                            className="font-bold"
                            style={{ color: opt.everyone ? 'var(--warning)' : 'var(--primary)' }}
                          >
                            {opt.name}
                          </span>
                          <span className="text-xs opacity-70">{opt.sub}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
                    <textarea
                      ref={draftInputRef}
                      value={draft}
                      rows={1}
                      onChange={(e) => {
                        handleDraftChange(e.target.value, e.target.selectionStart ?? e.target.value.length);
                        const el = draftInputRef.current;
                        if (el) {
                          el.style.height = 'auto';
                          el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                          el.style.overflowY = el.scrollHeight > 120 ? 'auto' : 'hidden';
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') { setMentionQuery(null); return; }
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder={selected.isGroup ? 'Type a message... (use @ to mention)' : 'Type a message...'}
                      className="flex-1 bg-transparent outline-none resize-none leading-snug py-1.5"
                      style={{ fontSize: 13.5, color: 'var(--text)', border: 'none', maxHeight: 120 }}
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
                      {sending ? <Loader2 size={14} className="animate-spin" /> : (
                        <motion.span
                          key={sendPulse}
                          initial={{ y: 0, scale: 1 }}
                          animate={{ y: [0, -4, 0], scale: [1, 1.25, 1] }}
                          transition={{ duration: 0.35, ease: 'easeOut' }}
                          className="inline-flex"
                        >
                          <Send size={14} />
                        </motion.span>
                      )}
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
                        background: active ? 'rgba(40, 114, 161,0.15)' : 'var(--divider)',
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
                      style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 12, background: 'rgba(40, 114, 161,0.15)', color: 'var(--primary)', border: 'none' }}
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
                      background: isSelected ? 'rgba(40, 114, 161,0.10)' : undefined,
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-soft)'; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 11 }}>
                      {p.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent)' }}>{p.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-lighter)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
                      {subParts.length > 0 && <div style={{ fontSize: 11, color: 'var(--text-lighter)', marginTop: 1 }}>{subParts.join(' \u2022 ')}</div>}
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

      {confirmState && (
        <dialog className="modal modal-open" onClick={(e) => { if (e.target === e.currentTarget) setConfirmState(null); }}>
          <div className="modal-box">
            <h3 className="font-bold text-lg" style={{ color: 'var(--accent)' }}>
              {confirmState.kind === 'hide' ? 'Delete chat?' : confirmState.kind === 'leave' ? 'Leave group?' : 'Delete message?'}
            </h3>
            <p className="py-4 text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
              {confirmState.kind === 'hide'
                ? 'Hide this conversation? Messages will remain saved, and the chat will reopen if a new message arrives.'
                : confirmState.kind === 'leave'
                  ? `Are you sure you want to leave "${selected?.groupName ?? 'this group'}"? You will no longer see this group chat.`
                  : 'This message will be deleted for everyone in this chat. This cannot be undone.'}
            </p>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmState(null)}>
                Cancel
              </button>
              <button
                className="btn btn-error btn-sm"
                disabled={confirmState.kind === 'deleteMsg' && deletingMsg}
                onClick={() => {
                  if (confirmState.kind === 'hide') void hideConversation(confirmState.conv.id);
                  else if (confirmState.kind === 'leave') void leaveGroup();
                  else void deleteMessage();
                }}
              >
                {confirmState.kind === 'hide' ? <><Trash2 size={13} /> Delete</> : confirmState.kind === 'leave' ? <><LogOut size={13} /> Leave Group</> : <>{deletingMsg ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} {deletingMsg ? 'Deleting…' : 'Delete'}</>}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop" onClick={() => setConfirmState(null)}>
            <button onClick={() => setConfirmState(null)}>close</button>
          </form>
        </dialog>
      )}

      {isProfileModalOpen && createPortal(
        <AnimatePresence>
          {selectedMentionUser && (
          <motion.dialog
            open
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal modal-open z-[999] p-4 border-none"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
            onClick={() => setSelectedMentionUser(null)}
            onCancel={(e) => { e.preventDefault(); setSelectedMentionUser(null); }}
          >
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 8 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            className="w-[92vw] max-w-md md:max-w-4xl lg:max-w-5xl bg-[#0d131f]/90 backdrop-blur-xl border border-cyan-500/30 rounded-3xl shadow-[0_0_30px_rgba(6,182,212,0.15)] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedMentionUser.kind === 'member' ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 pt-6 pb-5 rounded-t-3xl" style={{ background: 'linear-gradient(160deg, rgba(6,182,212,0.14), transparent)' }}>
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 20, boxShadow: '0 0 18px rgba(6,182,212,0.35)' }}>
                    {selectedMentionUser.initials}
                    {mentionMemberOnline && (
                      <span className="absolute bottom-0 right-0 w-4 h-4 bg-success rounded-full ring-2 ring-[#0d131f]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="truncate font-bold text-lg" style={{ color: 'var(--text)' }}>{selectedMentionUser.name}</span>
                      {mentionPerson?.role && (
                        <span className="badge badge-info badge-sm shrink-0">{mentionPerson.role}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${mentionMemberOnline ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-slate-500'}`} />
                      <span className="text-xs font-semibold" style={{ color: mentionMemberOnline ? '#4ade80' : '#94a3b8' }}>
                        {mentionMemberOnline
                          ? 'Online'
                          : mentionMemberLastSeen
                            ? `Last seen ${lastSeenLabel(mentionMemberLastSeen)}`
                            : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-base-content/10 p-6">
                  {profileColumns.map((col) => (
                    <div key={col.title} className="min-w-0 space-y-4">
                      <div className="text-xs font-semibold text-cyan-300/80 uppercase tracking-wider">{col.title}</div>
                      {col.rows.map(([label, value]) => (
                        <div key={label} className="min-w-0">
                          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
                          <div className="text-sm font-medium text-slate-100 break-words">{value || 'N/A'}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-center gap-3 px-6 pb-6 pt-2">
                  <button className="btn btn-ghost btn-sm text-slate-300 rounded-xl px-6" onClick={() => setSelectedMentionUser(null)}>Close</button>
                  <button
                    className="btn btn-info btn-sm text-white shadow-md shadow-cyan-500/20 rounded-xl px-6 gap-1.5"
                    onClick={() => {
                      const p = selectedMentionUser;
                      setSelectedMentionUser(null);
                      openChat({ email: p.email, name: p.name, initials: p.initials });
                    }}
                  >
                    <MessageSquare size={13} /> Direct Message
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 pt-6 pb-5 rounded-t-3xl">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 20 }}>
                    <Users size={24} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-lg" style={{ color: 'var(--text)' }}>{selected?.groupName ?? 'Group'}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-light)' }}>
                      {(selected?.members.length ?? 0) + 1} members
                    </div>
                    <div className="text-xs mt-1 font-medium" style={{ color: mentionGroupOnlineCount > 0 ? '#4ade80' : '#94a3b8' }}>
                      {mentionGroupOnlineCount > 0 ? `${mentionGroupOnlineCount} online` : 'Offline'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-3 px-6 pb-6 pt-2">
                  <button className="btn btn-ghost btn-sm text-slate-300 rounded-xl px-6" onClick={() => setSelectedMentionUser(null)}>Close</button>
                </div>
              </>
            )}
          </motion.div>
        </motion.dialog>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
