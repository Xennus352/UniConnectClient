'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Hash, Users, Newspaper, TrendingUp } from 'lucide-react';
import { useSupabase } from '@/utils/supabase/client';
import { useFeedPosts } from '@/lib/supabase/hooks';
import { useUniversityPeople } from './useUniversityPeople';

type Tab = 'posts' | 'people' | 'hashtags';

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SearchModal({ open, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('posts');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = useSupabase();
  const { posts } = useFeedPosts(supabase);
  const { people: allUsers } = useUniversityPeople();

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) { el.showModal(); document.body.style.overflow = 'hidden'; setTimeout(() => inputRef.current?.focus(), 50); }
    else if (!open && el.open) { el.close(); document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = () => { onClose(); setQuery(''); document.body.style.overflow = ''; };
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, [onClose]);

  const allPosts = posts ?? [];
  const filteredPosts = allPosts.filter((p) =>
    (p.content ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (p.author_name ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (Array.isArray(p.tags)
      ? p.tags.some((t: any) => t?.label?.toLowerCase().includes(query.toLowerCase()))
      : false)
  );

  const users = allUsers ?? [];
  const filteredPeople = users.filter(u =>
    u.name.toLowerCase().includes(query.toLowerCase())
  );

  const hashtagCounts = new Map<string, number>();
  for (const p of allPosts) {
    const tags = Array.isArray(p.tags) ? p.tags : [];
    for (const t of tags) {
      if (t && typeof t === 'object' && 'label' in t && typeof t.label === 'string') {
        const tag = t.label.replace(/^#/, '').toLowerCase();
        hashtagCounts.set(tag, (hashtagCounts.get(tag) ?? 0) + 1);
      }
    }
  }
  const filteredHashtags = Array.from(hashtagCounts.entries())
    .map(([tag, count]) => ({ tag, posts: count }))
    .sort((a, b) => b.posts - a.posts)
    .filter(h => h.tag.toLowerCase().includes(query.toLowerCase()));

  const handleSelect = useCallback(() => {
    onClose();
    setQuery('');
  }, [onClose]);

  const openProfile = useCallback((email: string) => {
    handleSelect();
    router.push(`/people/${encodeURIComponent(email)}`);
  }, [handleSelect, router]);

  return (
    <dialog
      ref={dialogRef}
      className="backdrop:bg-black/60"
      style={{
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--surface-border)',
        background: 'var(--modal-bg)',
        color: 'var(--text)',
        padding: 0,
        margin: 'auto',
        width: 'min(720px, calc(100vw - 32px))',
        maxHeight: 'min(680px, calc(100vh - 48px))',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ padding: '18px 22px 12px', borderBottom: '1px solid var(--surface)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>Search</h3>
          <button onClick={onClose} className="cursor-pointer border-none" style={{ color: 'var(--text-light)', background: 'none', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2 px-3 py-2" style={{ borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--surface-border)', background: 'var(--surface-soft)' }}>
          <Search size={14} style={{ color: 'var(--text-lighter)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts, people, hashtags..."
            className="bg-transparent outline-none w-full"
            style={{ fontSize: 13.5, color: 'var(--text)', border: 'none' }}
          />
          {query && (
            <button onClick={() => setQuery('')} className="cursor-pointer border-none" style={{ color: 'var(--text-lighter)', background: 'none', padding: 2 }}>
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-1 mt-2">
          {(['posts', 'people', 'hashtags'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full cursor-pointer border-none transition-all capitalize"
              style={{
                background: tab === t ? 'rgba(58,139,194,0.15)' : 'transparent',
                color: tab === t ? 'var(--primary)' : 'var(--text-light)',
              }}
            >
              {t === 'posts' && <Newspaper size={12} />}
              {t === 'people' && <Users size={12} />}
              {t === 'hashtags' && <Hash size={12} />}
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxHeight: 440, overflowY: 'auto', padding: '8px 0' }}>
        {!query && tab === 'hashtags' && (
          <div style={{ padding: '4px 22px 8px' }}>
            <div className="flex items-center gap-1.5 mb-2" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-lighter)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <TrendingUp size={12} /> Trending
            </div>
          </div>
        )}

        {tab === 'posts' && (
          filteredPosts.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-lighter)' }}>No posts found</div>
          ) : (
            filteredPosts.map((p) => (
              <button
                key={p.id}
                onClick={handleSelect}
                className="flex items-start gap-3 w-full text-left cursor-pointer border-none"
                style={{ padding: '10px 22px', transition: 'background 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-soft)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${p.author_role === 'student' ? 'from-info to-info/70' : p.author_role === 'lecturer' ? 'from-success to-success/70' : 'from-primary to-secondary'} flex items-center justify-center text-white font-bold shrink-0`} style={{ fontSize: 11 }}>{p.author_initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{p.author_name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-lighter)' }}>{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text)', marginTop: 2, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.content}</div>
                </div>
              </button>
            ))
          )
        )}

        {tab === 'people' && (
          filteredPeople.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-lighter)' }}>No people found</div>
          ) : (
            filteredPeople.map((u) => (
              <button
                key={u.email}
                onClick={() => openProfile(u.email)}
                className="flex items-center gap-3 w-full text-left cursor-pointer border-none"
                style={{ padding: '10px 22px', transition: 'background 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-soft)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${u.role.toLowerCase() === 'student' ? 'from-info to-info/70' : u.role.toLowerCase() === 'staff' ? 'from-success to-success/70' : 'from-primary to-secondary'} flex items-center justify-center text-white font-bold shrink-0`} style={{ fontSize: 12 }}>{u.initials}</div>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent)' }}>{u.name}</span>
                <span className="ml-auto text-xs" style={{ color: 'var(--primary)' }}>View profile →</span>
              </button>
            ))
          )
        )}

        {tab === 'hashtags' && (
          filteredHashtags.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-lighter)' }}>No hashtags found</div>
          ) : (
            filteredHashtags.map((h) => (
              <button
                key={h.tag}
                onClick={handleSelect}
                className="flex items-center gap-3 w-full text-left cursor-pointer border-none"
                style={{ padding: '10px 22px', transition: 'background 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-soft)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(58,139,194,0.1)', color: 'var(--primary)' }}>
                  <Hash size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--primary)' }}>#{h.tag}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-lighter)' }}>{h.posts} posts</div>
                </div>
              </button>
            ))
          )
        )}
      </div>
    </dialog>
  );
}
