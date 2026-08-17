'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import FeedComposer from './FeedComposer';
import FeedPost from './FeedPost';
import { useSupabase } from '@/utils/supabase/client';
import { useFeedPosts } from '@/lib/supabase/hooks';
import { useSession } from './session';
import type { Post } from '@/lib/supabase/hooks';

export default function FeedSection() {
  const supabase = useSupabase();
  const router = useRouter();
  const { user: session } = useSession();
  const { posts, loading, loadingMore, hasMore, loadMore, hasError, refresh } = useFeedPosts(supabase);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [focusId, setFocusId] = useState<string | null>(null);
  const [blinkId, setBlinkId] = useState<string | null>(null);
  const [injected, setInjected] = useState<Post[]>([]);
  const [hashtag, setHashtag] = useState<string | null>(null);
  const scrolledRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('post') ?? null;
    if (id) {
      const t = setTimeout(() => setFocusId(id), 0);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tag = params.get('hashtag') ?? null;
    setHashtag(tag ? tag.replace(/^#/, '') : null);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail as string;
      if (!id) return;
      scrolledRef.current = false;
      setBlinkId(null);
      setFocusId(id);
    };
    window.addEventListener('uniconnect-focus-post', handler);
    return () => window.removeEventListener('uniconnect-focus-post', handler);
  }, []);

  const clearHashtag = () => {
    setHashtag(null);
    router.replace(window.location.pathname, { scroll: false });
  };

  useEffect(() => {
    const id = focusId;
    if (!id || scrolledRef.current) return;
    if (!(posts ?? []).some((p) => p.id === id) && !injected.some((p) => p.id === id)) return;
    scrolledRef.current = true;
    const el = document.getElementById(`post-${id}`);
    if (el) {
      document.body.style.overflow = '';
      const t = setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setBlinkId(id);
      }, 80);
      return () => clearTimeout(t);
    }
  }, [posts, injected, focusId]);

  useEffect(() => {
    const id = focusId;
    if (!id || !posts) return;
    if (posts.some((p) => p.id === id) || injected.some((p) => p.id === id)) return;
    const fetchPost = async () => {
      const { data } = (await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .maybeSingle()) as unknown as { data: Post | null };
      if (data && data.status !== 'approved') return;
      if (data) setInjected((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data]));
    };
    fetchPost();
  }, [posts, injected, focusId, supabase]);

  const displayPosts = useMemo(() => {
    let base = injected.length === 0 ? posts ?? [] : [...injected, ...(posts ?? [])].sort((a, b) => b.created_at - a.created_at);
    if (hashtag) {
      base = base.filter((p) =>
        Array.isArray(p.tags) &&
        (p.tags as { label?: string }[]).some((t) =>
          (t.label ?? '').replace(/^#/, '').toLowerCase() === hashtag.toLowerCase()
        )
      );
    }
    return base;
  }, [posts, injected, hashtag]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: '400px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className="max-w-[860px] mx-auto">
      <FeedComposer avatarInitials={session?.initials} />
      {hashtag && (
        <div
          className="flex items-center justify-between gap-2 mb-4 px-4 py-2.5 bg-base-100 backdrop-blur-xl"
          style={{ borderRadius: 'var(--radius-md)', border: '1.5px solid rgba(14, 165, 233, 0.5)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>
            <span>#{hashtag}</span>
            <span style={{ color: 'var(--text-light)', fontWeight: 500, fontSize: 12 }}>
              — {displayPosts.length} {displayPosts.length === 1 ? 'post' : 'posts'}
            </span>
          </div>
          <button
            onClick={clearHashtag}
            className="cursor-pointer border-none"
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-light)', background: 'none', padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-light)'; }}
          >
            Clear ✕
          </button>
        </div>
      )}
      {loading && (
        <div className="text-center py-12">
          <span className="loading loading-spinner loading-md" style={{ color: 'var(--primary)' }} />
          <p className="mt-2 text-sm" style={{ color: 'var(--text-lighter)' }}>Loading feed...</p>
        </div>
      )}
      {hasError && !loading && (
        <div className="text-center py-12" style={{ color: 'var(--text-light)' }}>
          <p className="text-sm mb-4">Could not load the feed — check your connection and try again.</p>
          <button
            onClick={refresh}
            className="btn btn-sm text-white border-none"
            style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
          >
            Retry
          </button>
        </div>
      )}
      {displayPosts.length === 0 && !loading && !hasError && (
        <div className="text-center py-12" style={{ color: 'var(--text-lighter)' }}>
          <p className="text-sm">{hashtag ? `No posts with #${hashtag} yet.` : 'No posts yet — be the first to share something with the university.'}</p>
        </div>
      )}
      <div className="flex flex-col gap-4">
        {displayPosts.map((post) => (
          <div
            key={post.id}
            id={`post-${post.id}`}
            className={`bg-base-100 backdrop-blur-xl ${blinkId === post.id ? 'notif-blink' : ''}`}
            style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}
          >
            <FeedPost post={post} />
          </div>
        ))}
      </div>
      {hasMore && (
        <div ref={sentinelRef} className="text-center py-6 text-xs" style={{ color: 'var(--text-lighter)' }}>
          {loadingMore ? 'Loading more...' : 'Scroll for more'}
        </div>
      )}
    </div>
  );
}
