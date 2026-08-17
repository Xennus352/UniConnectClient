'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TypedSupabaseClient } from '@/utils/supabase/client';
import type { Database } from '@/utils/supabase/types';

type Post = Database['public']['Tables']['posts']['Row'];
type PostLike = Database['public']['Tables']['post_likes']['Row'];
type Comment = Database['public']['Tables']['post_comments']['Row'];
type Conversation = Database['public']['Tables']['conversations']['Row'];
type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];
type Notification = Database['public']['Tables']['notifications']['Row'];

let channelSeq = 0;
export function uniqueChannelName(base: string): string {
  channelSeq += 1;
  return `${base}:${channelSeq}`;
}

interface ParticipantMeta {
  email: string;
  name: string;
  initials: string;
}
interface ConvMeta {
  id: string;
  status: string;
  requestedBy: string;
  blockedBy: string;
  lastMessageAt: number;
  preview: string;
  unread: number;
  other: { email: string; name: string; initials: string };
}
interface ChatMeta {
  id: string;
  status: string;
  requestedBy: string;
  blockedBy: string;
  other: { email: string; name: string; initials: string };
}

const FEED_PAGE_SIZE = 10;
const PENDING_STATUSES = ['pending', 'pending_review'];

interface QueryResult {
  data: unknown;
  error: unknown;
}

// Supabase edge/gateway hiccups can return an HTTP error with an empty `{}`
// JSON body — postgrest-js then yields an error whose message/details/hint/code
// are ALL undefined, which is the "Feed fetch error: {}" seen in the console.
// PostgREST itself always includes a `message`, so `{}` means the request never
// reached PostgREST. Retrying with backoff lets the feed self-heal instead of
// wiping itself to an empty state on a transient failure.
//
// AbortError is NOT retried: it means the request was cancelled (our timeout
// guard), and re-firing it re-transfers the same multi-MB payload and fails
// identically — the abort is a symptom of a slow transfer, not a transient
// gateway blip. Surface it once and let the user retry manually.
// postgrest-js wraps fetch aborts into a PostgrestError whose only stable
// abort marker is this hint (name becomes "PostgrestError"). Match the
// underlying AbortError directly too, in case a bare error ever surfaces.
function isAbortError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { name?: unknown; hint?: unknown; code?: unknown };
  return (
    e.name === 'AbortError' ||
    e.code === 'ABORT_ERR' ||
    (typeof e.hint === 'string' && e.hint.startsWith('Request was aborted'))
  );
}

async function withRetry<T extends QueryResult>(
  fn: () => PromiseLike<T>,
  retries = 2,
  delayMs = 400
): Promise<T> {
  let last: T | null = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    last = await fn();
    if (!last.error || isAbortError(last.error)) return last;
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  return last as T;
}

function logFetchError(label: string, error: unknown) {
  const e = error as { message?: string; details?: string; hint?: string; code?: string };
  console.error(label, {
    message: e.message ?? undefined,
    details: e.details ?? undefined,
    hint: e.hint ?? undefined,
    code: e.code ?? undefined,
    keys: Object.keys(e as object),
    serialized: JSON.stringify(error),
    raw: error,
  });
}

export function usePendingPosts(supabase: TypedSupabaseClient) {
  const [pending, setPending] = useState<Post[] | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(
        'id,author_email,author_name,author_initials,author_role,content,tags,status,ai_flags,moderation_note,created_at,updated_at,likes_count,comments_count,shares_count,item_status,item_location'
      )
      .in('status', PENDING_STATUSES)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('Pending posts fetch error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        raw: error,
      });
      return;
    }
    setPending((data ?? []) as Post[]);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(
          'id,author_email,author_name,author_initials,author_role,content,tags,status,ai_flags,moderation_note,created_at,updated_at,likes_count,comments_count,shares_count,item_status,item_location'
        )
        .in('status', PENDING_STATUSES)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        console.error('Pending posts fetch error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          raw: error,
        });
        if (!cancelled) setPending((prev) => prev ?? []);
        return;
      }
      if (!cancelled) setPending((data ?? []) as Post[]);
    };
    void load();

    const channel = supabase
      .channel(uniqueChannelName('public:posts:queue'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (payload) => {
        const row = (payload.new ?? payload.old) as Partial<Post> | undefined;
        const isPending = typeof row?.status === 'string' && PENDING_STATUSES.includes(row.status);
        setPending((prev) => {
          if (!prev) return prev;
          if (payload.eventType === 'INSERT') {
            const r = payload.new as Partial<Post>;
            if (!isPending || !r.id || prev.some((p) => p.id === r.id)) return prev;
            return [r as Post, ...prev];
          }
          if (payload.eventType === 'UPDATE') {
            const r = payload.new as Partial<Post>;
            if (!r.id) return prev;
            if (isPending) {
              if (prev.some((p) => p.id === r.id)) {
                return prev.map((p) => (p.id === r.id ? { ...p, ...r } : p));
              }
              return [r as Post, ...prev];
            }
            return prev.filter((p) => p.id !== r.id);
          }
          if (payload.eventType === 'DELETE') {
            const r = payload.old as Partial<Post>;
            return prev.filter((p) => p.id !== r.id);
          }
          return prev;
        });
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [supabase]);

  const removePending = useCallback((id: string) => {
    setPending((prev) => prev?.filter((p) => p.id !== id) ?? prev);
  }, []);

  return { pending, loading: pending === null, removePending, refresh };
}

export function useFeedPosts(supabase: TypedSupabaseClient) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await withRetry(() =>
        supabase
          .from('posts')
          .select(
            'id,author_email,author_name,author_initials,author_role,content,tags,status,ai_flags,moderation_note,created_at,updated_at,likes_count,comments_count,shares_count,item_status,item_location'
          )
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(FEED_PAGE_SIZE)
      );
      if (error) {
        logFetchError('Feed fetch error (2 attempts failed):', error);
        setHasError(true);
        setPosts((prev) => prev ?? []);
        setHasMore(false);
      }
      else { setHasError(false); setPosts((data ?? []) as Post[]); setHasMore((data?.length ?? 0) === FEED_PAGE_SIZE); }
      setLoading(false);
    };
    load();

    const qualifies = (row: Post) => row.status === 'approved';
    const channel = supabase
      .channel(uniqueChannelName('public:posts:feed'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (payload) => {
        setPosts((prev) => {
          if (!prev) return prev;
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Partial<Post>;
            if (!row.id || row.status !== 'approved') return prev;
            if (prev.some((p) => p.id === row.id)) return prev;
            return [row as Post, ...prev];
          }
          if (payload.eventType === 'UPDATE') {
            const row = payload.new as Partial<Post>;
            return prev
              .map((p) => (p.id === row.id ? { ...p, ...row } : p))
              .filter((p) => qualifies(p));
          }
          if (payload.eventType === 'DELETE') {
            return prev.filter((p) => p.id !== (payload.old as Post).id);
          }
          return prev;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, attempt]);

  const refresh = useCallback(() => {
    setHasError(false);
    setLoading(true);
    setAttempt((a) => a + 1);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !posts || posts.length === 0) return;
    setLoadingMore(true);
    const last = posts[posts.length - 1];
    const { data, error } = await withRetry(
      () =>
        supabase
          .from('posts')
          .select(
            'id,author_email,author_name,author_initials,author_role,content,tags,status,ai_flags,moderation_note,created_at,updated_at,likes_count,comments_count,shares_count,item_status,item_location'
          )
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .lt('created_at', last.created_at)
          .limit(FEED_PAGE_SIZE),
      2,
      600
    );
    if (error) {
      logFetchError('Feed load-more error (2 attempts failed):', error);
    } else if (data) {
      setPosts((prev) => {
        const existing = new Set((prev ?? []).map((p) => p.id));
        return [...(prev ?? []), ...(data.filter((p) => !existing.has(p.id)) as Post[])];
      });
      setHasMore(data.length === FEED_PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, posts, supabase]);

  return { posts, loading, loadingMore, hasMore, loadMore, hasError, refresh };
}

const normalizeTag = (s: string) => s.replace(/^#/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

function postHasTag(p: { tags?: unknown; content?: string | null }, aliases: string[]): boolean {
  const tags = (p.tags ?? []) as { label?: string }[];
  if (tags.some((t) => aliases.includes(normalizeTag(t.label ?? '')))) return true;
  if (p.content) {
    for (const m of p.content.matchAll(/#[\w&]+/gi)) {
      if (aliases.includes(normalizeTag(m[0]))) return true;
    }
  }
  return false;
}

function useTaggedPosts(supabase: TypedSupabaseClient, aliases: string[], channelName: string) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await withRetry(() =>
        supabase
          .from('posts')
          .select('*')
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(50)
      );
      if (error) {
        logFetchError(`Tagged posts fetch error (${channelName}):`, error);
        setHasError(true);
        setPosts([]);
      }
      else {
        setHasError(false);
        setPosts((data ?? []).filter((p) => postHasTag(p, aliases)));
      }
      setLoading(false);
    };
    void load();

    const qualifies = (row: Post) => row.status === 'approved' && postHasTag(row, aliases);
    const channel = supabase
      .channel(uniqueChannelName(channelName))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (payload) => {
        setPosts((prev) => {
          if (!prev) return prev;
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Partial<Post>;
            if (!row.id || !qualifies(row as Post)) return prev;
            if (prev.some((p) => p.id === row.id)) return prev;
            return [row as Post, ...prev];
          }
          if (payload.eventType === 'UPDATE') {
            const row = payload.new as Partial<Post>;
            return prev
              .map((p) => (p.id === row.id ? { ...p, ...row } : p))
              .filter((p) => qualifies(p));
          }
          if (payload.eventType === 'DELETE') {
            return prev.filter((p) => p.id !== (payload.old as Post).id);
          }
          return prev;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, attempt]);

  const refresh = useCallback(() => {
    setHasError(false);
    setLoading(true);
    setAttempt((a) => a + 1);
  }, []);

  return { posts, loading, hasError, refresh };
}

export function useLostFoundPosts(supabase: TypedSupabaseClient) {
  return useTaggedPosts(supabase, ['lostfound', 'lostandfound'], 'public:posts:lostfound');
}

export function useAnnouncementPosts(supabase: TypedSupabaseClient) {
  return useTaggedPosts(supabase, ['announcement', 'announcements'], 'public:posts:announcements');
}

export function usePostShares(supabase: TypedSupabaseClient, postId: string) {  const [shares, setShares] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('posts')
      .select('shares_count')
      .eq('id', postId)
      .single()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setShares((data?.shares_count as number) ?? 0);
      });
    const channel = supabase
      .channel(uniqueChannelName(`public:posts:shares:${postId}`))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts', filter: `id=eq.${postId}` }, (payload) => {
        setShares((payload.new as Post)?.shares_count ?? 0);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); cancelled = true; };
  }, [supabase, postId]);
  return { shares, loading: shares === null };
}

export function usePostLikes(supabase: TypedSupabaseClient, postId: string, meEmail: string) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('post_likes')
      .select('user_email')
      .eq('post_id', postId)
      .then(({ data }) => {
        if (cancelled) return;
        setLikes(data?.length ?? 0);
        setLiked(data?.some((l) => l.user_email === meEmail) ?? false);
      });
    const channel = supabase
      .channel(uniqueChannelName(`public:post_likes:post:${postId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes', filter: `post_id=eq.${postId}` }, (payload) => {
        setLikes((prev) => {
          if (prev === null) return prev;
          if (payload.eventType === 'INSERT') return prev + 1;
          if (payload.eventType === 'DELETE') return Math.max(prev - 1, 0);
          return prev;
        });
        const row = payload.new as PostLike | undefined;
        if (payload.eventType === 'INSERT' && row?.user_email === meEmail) setLiked(true);
        if (payload.eventType === 'DELETE' && (payload.old as PostLike)?.user_email === meEmail) setLiked(false);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); cancelled = true; };
  }, [supabase, postId, meEmail]);
  return { liked, likes, loading: likes === null };
}

const COMMENTS_PAGE_SIZE = 20;

export function useComments(supabase: TypedSupabaseClient, postId: string) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .range(0, COMMENTS_PAGE_SIZE - 1);
      if (error) setComments([]);
      else { setComments(data ?? []); setHasMore((data?.length ?? 0) === COMMENTS_PAGE_SIZE); }
      setLoading(false);
    };
    load();
    const channel = supabase
      .channel(uniqueChannelName(`public:post_comments:post:${postId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` }, (payload) => {
        setComments((prev) => {
          if (!prev) return prev;
          if (payload.eventType === 'INSERT') {
            const c = payload.new as Comment;
            if (prev.some((x) => x.id === c.id)) return prev;
            return [...prev, c].sort((a, b) => a.created_at - b.created_at);
          }
          if (payload.eventType === 'DELETE') return prev.filter((c) => c.id !== (payload.old as Comment).id);
          return prev.map((c) => (c.id === (payload.new as Comment)?.id ? (payload.new as Comment) : c));
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, postId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !comments) return;
    setLoadingMore(true);
    const { data, error } = await supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .range(comments.length, comments.length + COMMENTS_PAGE_SIZE - 1);
    if (!error && data) {
      setComments((prev) => {
        const existing = new Set((prev ?? []).map((c) => c.id));
        return [...(prev ?? []), ...data.filter((c) => !existing.has(c.id))].sort((a, b) => a.created_at - b.created_at);
      });
      setHasMore(data.length === COMMENTS_PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, comments, supabase, postId]);

  return { comments, loading, loadingMore, hasMore, loadMore };
}

export function useConversations(supabase: TypedSupabaseClient, me: string) {
  const [items, setItems] = useState<ConvMeta[] | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .contains('participant_ids', [me])
        .order('last_message_at', { ascending: false });
      if (error) setItems([]);
      else setItems(enrichConvs(data ?? [], me));
      setLoading(false);
    };
    load();
     const channel = supabase
      .channel(uniqueChannelName('public:conversations'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, (payload) => {
        setItems((prev) => {
          if (!prev) return prev;
          const isMine = (row: any) => {
            const ids: string[] | undefined = row?.participant_ids;
            return Array.isArray(ids) && ids.includes(me);
          };
          if (payload.eventType === 'INSERT') {
            const row = payload.new;
            if (!isMine(row)) return prev;
            if (prev.some((c) => c.id === row.id)) return prev;
            return [enrichConvs([row], me)[0], ...prev];
          }
          if (payload.eventType === 'UPDATE') {
            const row = payload.new;
            if (!isMine(row)) return prev;
            return prev.map((c) => (c.id === row.id ? enrichConvs([row], me)[0] : c)).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
          }
          if (payload.eventType === 'DELETE') {
            return prev.filter((c) => c.id !== (payload.old as any)?.id);
          }
          return prev;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, me]);
  return { conversations: items, loading };
}

function enrichConvs(rows: any[], me: string): ConvMeta[] {
  return rows
    .map((conv) => {
      const meta: ParticipantMeta[] = Array.isArray(conv.participant_meta) ? conv.participant_meta : [];
      const otherEmail = (conv.participant_ids as string[]).find((p) => p !== me) || '';
      const other = meta.find((m) => m.email === otherEmail) || { email: otherEmail, name: otherEmail.split('@')[0], initials: otherEmail.slice(0, 2).toUpperCase() };
      const unreadMap = (conv.unread_map ?? {}) as Record<string, number>;
      return {
        id: conv.id,
        status: conv.status || 'active',
        requestedBy: conv.requested_by || '',
        blockedBy: conv.blocked_by || '',
        lastMessageAt: conv.last_message_at,
        preview: conv?.preview ?? 'No messages yet',
        unread: unreadMap[me] ?? 0,
        other,
      };
    })
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

// preview field: supabase can't store a computed preview; fetch the last message per conv.
export async function fetchConvPreviews(supabase: TypedSupabaseClient, me: string) {
  const { data: convs } = await supabase
    .from('conversations')
    .select('*')
    .contains('participant_ids', [me]);
  if (!convs || convs.length === 0) return {};
  const map: Record<string, string> = {};
  for (const conv of convs as any[]) {
    const { data: m } = await supabase
      .from('chat_messages')
      .select('content')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(1);
    map[conv.id] = m?.[0]?.content ?? 'No messages yet';
  }
  return map;
}

export function useMessages(supabase: TypedSupabaseClient, conversationId: string) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  useEffect(() => {
    if (!conversationId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) setMessages([]);
      else setMessages(data ?? []);
    };
    load();
    const channel = supabase
      .channel(uniqueChannelName(`public:chat_messages:conv:${conversationId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        setMessages((prev) => {
          if (!prev) return prev;
          if (payload.eventType === 'INSERT') return [...prev, payload.new as ChatMessage];
          if (payload.eventType === 'DELETE') return prev.filter((m) => m.id !== (payload.old as ChatMessage).id);
          return prev.map((m) => (m.id === (payload.new as ChatMessage)?.id ? (payload.new as ChatMessage) : m));
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, conversationId]);
  return { messages, loading: messages === null };
}

export function useConversationDetail(supabase: TypedSupabaseClient, conversationId: string) {
  const [conv, setConv] = useState<ChatMeta | null>(null);
  useEffect(() => {
    if (!conversationId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
      if (error) setConv(null);
      else setConv(mapConv(data, ''));
    };
    load();
    return () => {};
  }, [supabase, conversationId]);
  return { conv };
}

function mapConv(row: any, me: string): ChatMeta {
  const meta: ParticipantMeta[] = Array.isArray(row.participant_meta) ? row.participant_meta : [];
  const otherEmail = (row.participant_ids as string[]).find((p) => p !== me) || '';
  const other = meta.find((m) => m.email === otherEmail) || { email: otherEmail, name: otherEmail.split('@')[0], initials: otherEmail.slice(0, 2).toUpperCase() };
  return {
    id: row.id,
    status: row.status || 'active',
    requestedBy: row.requested_by || '',
    blockedBy: row.blocked_by || '',
    other,
  };
}

export function useNotifications(supabase: TypedSupabaseClient, recipientEmail: string, role: string) {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!recipientEmail) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`recipient_email.eq.${recipientEmail},recipient_role.eq.${role}`)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) setItems([]);
      else setItems(data ?? []);
      setLoading(false);
    };
    load();
     const channel = supabase
      .channel(uniqueChannelName('public:notifications'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload) => {
        setItems((prev) => {
          if (!prev) return prev;
          const isMine = (row: any) =>
            row?.recipient_email === recipientEmail ||
            (!row?.recipient_email && row?.recipient_role === role);
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Notification;
            if (!isMine(row)) return prev;
            if (prev.some((n) => n.id === row.id)) return prev;
            return [row, ...prev];
          }
          if (payload.eventType === 'DELETE') return prev.filter((n) => n.id !== (payload.old as Notification).id);
          const row = payload.new as Notification;
          if (!isMine(row)) return prev;
          return prev.map((n) => (n.id === row.id ? row : n));
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, recipientEmail, role]);
  return { notifications: items, loading };
}

export type { Post, Comment, Conversation, ChatMessage, Notification, ConvMeta, ChatMeta, ParticipantMeta };

type EventRow = Database['public']['Tables']['events']['Row'];
type EventRegistration = Database['public']['Tables']['event_registrations']['Row'];

export function useEvents(supabase: TypedSupabaseClient, role?: string) {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const studentOnly = role === 'student';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let query = supabase.from('events').select('*');
      if (studentOnly) query = query.eq('visibility', 'public');
      const { data, error } = await query.order('event_date', { ascending: true }).limit(100);
      if (cancelled) return;
      if (error) {
        setHasError(true);
        setEvents([]);
      }
      else {
        setHasError(false);
        setEvents(data ?? []);
      }
      setLoading(false);
    };
    void load();

    const channel = supabase
      .channel(uniqueChannelName('public:events'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
        setEvents((prev) => {
          if (!prev) return prev;
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Partial<EventRow>;
            if (!row.id || prev.some((e) => e.id === row.id)) return prev;
            return [...prev, row as EventRow].sort((a, b) => a.event_date - b.event_date);
          }
          if (payload.eventType === 'UPDATE') {
            const row = payload.new as Partial<EventRow>;
            return prev
              .map((e) => (e.id === row.id ? { ...e, ...row } : e))
              .sort((a, b) => a.event_date - b.event_date);
          }
          if (payload.eventType === 'DELETE') {
            return prev.filter((e) => e.id !== (payload.old as EventRow).id);
          }
          return prev;
        });
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [supabase, studentOnly, attempt]);

  const refresh = useCallback(() => {
    setHasError(false);
    setLoading(true);
    setAttempt((a) => a + 1);
  }, []);

  return { events, loading, hasError, refresh };
}

export function useEventRegistrations(supabase: TypedSupabaseClient, eventIds: string[], me: string) {
  const [regs, setRegs] = useState<Record<string, { count: number; registered: boolean }> | null>(null);
  const idsKey = eventIds.join('|');

  useEffect(() => {
    if (idsKey === '') { setRegs({}); return; }
    const ids = idsKey === '' ? [] : idsKey.split('|');
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from('event_registrations')
        .select('event_id, user_email')
        .in('event_id', ids);
      if (error) { console.error(error); if (!cancelled) setRegs({}); return; }
      if (cancelled) return;
      const map: Record<string, { count: number; registered: boolean }> = {};
      for (const id of ids) map[id] = { count: 0, registered: false };
      for (const r of data ?? []) {
        const m = map[r.event_id];
        if (m) {
          m.count += 1;
          if (r.user_email.toLowerCase() === me.toLowerCase()) m.registered = true;
        }
      }
      setRegs(map);
    };
    load();

    const channel = supabase
      .channel(uniqueChannelName('public:event_registrations'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_registrations' }, (payload) => {
        const eventId =
          (payload.new as Partial<EventRegistration>)?.event_id ??
          (payload.old as Partial<EventRegistration>)?.event_id;
        if (!eventId) {
          // With the table's default (PK-only) replica identity, realtime
          // DELETE/UPDATE payloads only carry the registration's id, so we
          // can't tell which event changed. Re-fetch instead of dropping the
          // update — otherwise a cancelled registration keeps showing
          // "Cancel Registration" until a full page refresh.
          void load();
          return;
        }
        setRegs((prev) => {
          if (!prev) return prev;
          const m = prev[eventId];
          if (!m) return prev;
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Partial<EventRegistration>;
            return {
              ...prev,
              [eventId]: {
                count: m.count + 1,
                registered: m.registered || (row.user_email ?? '').toLowerCase() === me.toLowerCase(),
              },
            };
          }
          if (payload.eventType === 'DELETE') {
            const row = payload.old as Partial<EventRegistration>;
            return {
              ...prev,
              [eventId]: {
                count: Math.max(0, m.count - 1),
                registered: m.registered && (row.user_email ?? '').toLowerCase() !== me.toLowerCase(),
              },
            };
          }
          return prev;
        });
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [supabase, idsKey, me]);

  return { registrations: regs };
}
