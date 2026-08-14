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

export function useFeedPosts(supabase: TypedSupabaseClient) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const load = async () => {
      const query = supabase
        .from('posts')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(FEED_PAGE_SIZE);
      const { data, error } = await query;
      if (error) { console.error(error); setPosts([]); setHasMore(false); }
      else { setPosts(data ?? []); setHasMore((data?.length ?? 0) === FEED_PAGE_SIZE); }
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
  }, [supabase]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !posts || posts.length === 0) return;
    setLoadingMore(true);
    const last = posts[posts.length - 1];
    const query = supabase
      .from('posts')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .lt('created_at', last.created_at)
      .limit(FEED_PAGE_SIZE);
    const { data, error } = await query;
    if (!error && data) {
      setPosts((prev) => {
        const existing = new Set((prev ?? []).map((p) => p.id));
        return [...(prev ?? []), ...data.filter((p) => !existing.has(p.id))];
      });
      setHasMore(data.length === FEED_PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, posts, supabase]);

  return { posts, loading, loadingMore, hasMore, loadMore };
}

export function useLostFoundPosts(supabase: TypedSupabaseClient) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 'approved')
        .contains('tags', [{ label: 'Lost & Found' }] as never)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) { console.error(error); setPosts([]); }
      else { setPosts(data ?? []); }
      setLoading(false);
    };
    load();

    const qualifies = (row: Post) => {
      const tags = (row.tags ?? []) as { label?: string }[];
      return row.status === 'approved' && tags.some((t) => t.label === 'Lost & Found');
    };
    const channel = supabase
      .channel(uniqueChannelName('public:posts:lostfound'))
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
  }, [supabase]);

  return { posts, loading };
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
          const mutate = (row: any) => enrichConvs(row ? [row] : [], me)[0];
          if (payload.eventType === 'INSERT') return [mutate(payload.new), ...prev];
          if (payload.eventType === 'UPDATE') return prev.map((c) => (c.id === payload.new.id ? mutate(payload.new) : c)).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
          if (payload.eventType === 'DELETE') return prev.filter((c) => c.id !== (payload.old as any)?.id);
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
          if (payload.eventType === 'INSERT') return [payload.new as Notification, ...prev];
          if (payload.eventType === 'DELETE') return prev.filter((n) => n.id !== (payload.old as Notification).id);
          return prev.map((n) => (n.id === (payload.new as Notification)?.id ? (payload.new as Notification) : n));
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, recipientEmail, role]);
  return { notifications: items, loading };
}

export type { Post, Comment, Conversation, ChatMessage, Notification, ConvMeta, ChatMeta, ParticipantMeta };
