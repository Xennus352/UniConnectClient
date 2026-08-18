'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldCheck, Check, X, Trash2, Loader2, AlertTriangle, ImageOff } from 'lucide-react';
import { useSupabase } from '@/utils/supabase/client';
import { usePostImageDownload } from '@/lib/supabase/usePostImage';
import PostImageDownload from './PostImageDownload';
import ImageLightbox from './ImageLightbox';
import { usePendingPosts } from '@/lib/supabase/hooks';
import { toast } from 'sonner';
import PostTag from './PostTag';
import type { Database } from '@/utils/supabase/types';

type PostRow = Database['public']['Tables']['posts']['Row'];

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

const TABS = ['All Pending', 'Latest', 'Lost & Found'];

// The pending list is fetched without the multi-MB `image` column (see
// FeedPost.tsx PostImage for the same rationale); images are loaded lazily
// per post so one slow transfer can't block the moderation queue.
function PendingPostImage({ postId }: { postId: string }) {
  const { src, phase, progress, attemptsLeft } = usePostImageDownload(postId);
  const [showImage, setShowImage] = useState(false);

  if (phase === 'downloading' || phase === 'retrying') {
    return <PostImageDownload height={150} progress={progress} retrying={phase === 'retrying'} attemptsLeft={attemptsLeft} />;
  }
  if (phase === 'failed') {
    return (
      <div
        className="rounded-xl w-full mt-3 flex flex-col items-center justify-center gap-1"
        style={{ height: 150, background: 'var(--divider-soft)', border: '1px dashed var(--surface-border)', color: 'var(--text-lighter)', fontSize: 11.5 }}
      >
        <ImageOff size={16} />
        <span>Image unavailable</span>
      </div>
    );
  }
  if (phase === 'empty' || !src) return null;
  return (
    <>
      <img
        src={src}
        alt=""
        loading="lazy"
        onClick={() => setShowImage(true)}
        className="rounded-xl w-full object-cover mt-3 cursor-zoom-in transition-opacity duration-200 hover:opacity-90"
        style={{ maxHeight: 150, border: '1px solid var(--surface-border)' }}
      />
      {showImage && (
        <ImageLightbox
          open={showImage}
          onClose={() => setShowImage(false)}
          src={src}
          postId={postId}
        />
      )}
    </>
  );
}

const isLostFound = (p: PostRow) =>
  Array.isArray(p.tags) &&
  (p.tags as { label?: string }[]).some((t) =>
    (t.label ?? '').replace(/^#/, '').toLowerCase() === 'lost & found'
  );

export default function PendingPostApprovals({ viewAllHref }: { viewAllHref?: string }) {
  const supabase = useSupabase();
  const { pending, loading, removePending, refresh } = usePendingPosts(supabase);
  const [tab, setTab] = useState('All Pending');
  const [rejectPost, setRejectPost] = useState<PostRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = pending ?? [];
    if (tab === 'Lost & Found') return list.filter(isLostFound);
    if (tab === 'Latest') return list.slice(0, 5);
    return list;
  }, [pending, tab]);

  const handleApprove = async (post: PostRow) => {
    setBusyId(post.id);
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      if (res.ok) {
        removePending(post.id);
        toast.success(`Post by ${post.author_name} approved and published to the feed`);
      } else {
        const err = await res.json().catch(() => ({ message: 'Failed to approve post' }));
        throw new Error(err.message || 'Failed to approve post');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve post');
      void refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (post: PostRow) => {
    setBusyId(post.id);
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      if (res.ok) {
        removePending(post.id);
        setRejectPost(null);
        toast.error(`Post by ${post.author_name} rejected`);
      } else {
        const err = await res.json().catch(() => ({ message: 'Failed to reject post' }));
        throw new Error(err.message || 'Failed to reject post');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject post');
      void refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (post: PostRow) => {
    setBusyId(post.id);
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete post');
      removePending(post.id);
      setRejectPost(null);
      toast.success(`Post by ${post.author_name} deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete post');
      void refresh();
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = pending?.length ?? 0;

  return (
    <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={16} /> Pending Post Approvals
          {!loading && pendingCount > 0 && (
            <span className="badge badge-warning badge-sm">{pendingCount} Pending</span>
          )}
        </div>
        {viewAllHref && (
          <Link href={viewAllHref} style={{ fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, textDecoration: 'none' }}>View All →</Link>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, padding: '0 22px', borderBottom: '1px solid var(--surface)' }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: tab === t ? 'var(--primary)' : 'var(--text-light)', cursor: 'pointer', borderBottom: tab === t ? '2.5px solid var(--primary)' : '2.5px solid transparent', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
            {t}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <Loader2 size={20} className="animate-spin mb-2" style={{ color: 'var(--text-lighter)' }} />
          <span style={{ fontSize: 13, color: 'var(--text-lighter)' }}>Loading pending posts...</span>
        </div>
      )}

      {!loading && pendingCount === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-14 px-6">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(34,197,94,0.12)' }}>
            <Check size={26} style={{ color: 'var(--success)' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-light)' }}>All caught up! No pending posts requiring approval.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-lighter)' }}>New Lost &amp; Found posts will appear here instantly</p>
        </div>
      )}

      {!loading && pendingCount > 0 && filtered.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 13 }}>
          {tab === 'Lost & Found' ? 'No pending Lost & Found posts' : 'No pending posts in this view'}
        </div>
      )}

      {!loading && filtered.map((post) => (
        <div key={post.id} style={{ padding: '16px 22px', borderBottom: '1px solid var(--surface)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 12 }}>
              {post.author_initials}
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--accent)' }}>{post.author_name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-lighter)' }}>
                {post.author_role} • {timeAgo(post.created_at)}
              </div>
            </div>
            {post.ai_flags && (
              <span className="badge badge-sm gap-1 shrink-0" style={{ background: 'rgba(251,191,36,0.14)', color: '#b45309', border: 'none' }}>
                <AlertTriangle size={11} /> AI: {post.ai_flags}
              </span>
            )}
          </div>

          {Array.isArray(post.tags) && (post.tags as { label?: string; emoji?: string }[]).length > 0 && (
            <div className="flex gap-[6px] mt-2.5 flex-wrap">
              {(post.tags as { label?: string; emoji?: string }[]).map((tag, i) => (
                tag.label ? <PostTag key={i} label={tag.label} emoji={tag.emoji} /> : null
              ))}
            </div>
          )}

          <p style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.55, margin: '10px 0 0' }} className="line-clamp-3">
            {post.content}
          </p>

          {post.image ? (
            <img
              src={post.image}
              alt=""
              className="rounded-xl w-full object-cover mt-3"
              style={{ maxHeight: 150, border: '1px solid var(--surface-border)' }}
            />
          ) : post.video_url ? (
            <video
              src={post.video_url}
              controls
              playsInline
              className="rounded-xl w-full object-cover mt-3"
              style={{ maxHeight: 150, border: '1px solid var(--surface-border)' }}
            />
          ) : (
            <PendingPostImage postId={post.id} />
          )}

          <div className="flex items-center gap-2 mt-3.5">
            <button
              onClick={() => void handleApprove(post)}
              disabled={busyId === post.id}
              className="btn btn-success btn-sm gap-1.5 border-none text-white"
              style={{ opacity: busyId === post.id ? 0.7 : 1 }}
            >
              {busyId === post.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {busyId === post.id ? 'Approving...' : 'Approve'}
            </button>
            <button
              onClick={() => setRejectPost(post)}
              disabled={busyId === post.id}
              className="btn btn-error btn-sm btn-outline gap-1.5"
            >
              <X size={13} /> Reject
            </button>
          </div>
        </div>
      ))}

      {rejectPost && (
        <dialog
          id="pending_reject_modal"
          className="modal modal-open z-[999]"
          open
          onCancel={(e) => { e.preventDefault(); setRejectPost(null); }}
        >
          <div className="modal-box" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.12)' }}>
                <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold" style={{ fontSize: 15, color: 'var(--accent)' }}>Reject or delete this post?</h3>
                <p className="mt-1" style={{ fontSize: 13, color: 'var(--text-light)', lineHeight: 1.5 }}>
                  "{rejectPost.content.length > 90 ? `${rejectPost.content.slice(0, 90)}…` : rejectPost.content}" — by {rejectPost.author_name}
                </p>
              </div>
            </div>
            <div className="modal-action">
              <button onClick={() => void handleReject(rejectPost)} disabled={busyId === rejectPost.id} className="btn btn-error btn-sm gap-1.5 border-none text-white">
                {busyId === rejectPost.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                {busyId === rejectPost.id ? 'Rejecting...' : 'Reject Post'}
              </button>
              <button onClick={() => void handleDelete(rejectPost)} disabled={busyId === rejectPost.id} className="btn btn-error btn-sm btn-outline gap-1.5">
                {busyId === rejectPost.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {busyId === rejectPost.id ? 'Deleting...' : 'Delete Post'}
              </button>
              <button onClick={() => setRejectPost(null)} disabled={busyId === rejectPost.id} className="btn btn-ghost btn-sm">
                Cancel
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setRejectPost(null)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}