'use client';

import { useEffect, useRef } from 'react';
import FeedComposer from './FeedComposer';
import FeedPost from './FeedPost';
import { useSupabase } from '@/utils/supabase/client';
import { useFeedPosts } from '@/lib/supabase/hooks';
import { useSession } from './session';

export default function FeedSection() {
  const supabase = useSupabase();
  const { user: session } = useSession();
  const me = session?.email ?? '';
  const { posts, loading, loadingMore, hasMore, loadMore } = useFeedPosts(supabase, me);
  const sentinelRef = useRef<HTMLDivElement>(null);

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
      {!posts && loading && (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--text-lighter)' }}>
          Loading feed...
        </div>
      )}
      {posts && posts.length === 0 && !loading && (
        <div className="text-center py-12" style={{ color: 'var(--text-lighter)' }}>
          <p className="text-sm">No posts yet — be the first to share something with the university.</p>
        </div>
      )}
      <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {posts?.map((post) => (
          <FeedPost key={post.id} post={post} />
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
