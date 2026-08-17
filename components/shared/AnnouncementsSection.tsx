'use client';

import { useMemo, useState } from 'react';
import { Search, Megaphone } from 'lucide-react';
import FeedPost from './FeedPost';
import { useSupabase } from '@/utils/supabase/client';
import { useAnnouncementPosts } from '@/lib/supabase/hooks';

export default function AnnouncementsSection() {
  const supabase = useSupabase();
  const { posts, loading, hasError, refresh } = useAnnouncementPosts(supabase);

  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts ?? [];
    return (posts ?? []).filter(
      (p) =>
        (p.content ?? '').toLowerCase().includes(q) ||
        (p.author_name ?? '').toLowerCase().includes(q)
    );
  }, [posts, query]);

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Announcements</h1>
      <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>Official announcements and notices for the university community</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', marginBottom: 18, maxWidth: 420 }}>
        <Search size={14} style={{ color: 'var(--text-light)' }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search announcements..."
          style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: 'var(--text)', width: '100%' }}
        />
      </div>

      <div className="max-w-[860px] mx-auto">
        {loading && (
          <div className="text-center py-12">
            <span className="loading loading-spinner loading-md" style={{ color: 'var(--primary)' }} />
            <p className="mt-2 text-sm" style={{ color: 'var(--text-lighter)' }}>Loading announcements...</p>
          </div>
        )}
        {hasError && !loading && (
          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', padding: '24px 22px', textAlign: 'center' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--text-light)' }}>Could not load announcements — check your connection and try again.</p>
            <button
              onClick={refresh}
              className="btn btn-sm text-white border-none"
              style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !hasError && filtered.length === 0 && (
          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', padding: '24px 22px', textAlign: 'center' }}>
            <Megaphone size={26} style={{ color: 'var(--text-lighter)', opacity: 0.5, marginBottom: 8 }} />
            <div style={{ fontSize: 12, color: 'var(--text-lighter)' }}>
              {posts && posts.length === 0
                ? 'No announcements yet — posts tagged #Announcement will appear here'
                : 'No announcements match your search'}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-4">
          {filtered.map((post) => (
            <div
              key={post.id}
              className="bg-base-100 backdrop-blur-xl"
              style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}
            >
              <FeedPost post={post} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}