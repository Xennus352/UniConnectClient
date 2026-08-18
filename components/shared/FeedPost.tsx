'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Heart, MessageCircle, Share2, CircleCheck, Send, Pencil, Trash2, X, Check, Reply, ImageOff, VideoOff } from 'lucide-react';
import { useSupabase } from '@/utils/supabase/client';
import { usePostImageDownload } from '@/lib/supabase/usePostImage';
import { usePostVideoDownload } from '@/lib/supabase/usePostVideo';
import PostImageDownload from './PostImageDownload';
import ImageLightbox from './ImageLightbox';
import LikersModal from './LikersModal';
import { useSession } from './session';
import { toast } from 'sonner';
import ShareModal from './ShareModal';
import PostTag from './PostTag';
import { usePostLikes, useComments, usePostShares } from '@/lib/supabase/hooks';
import type { UniversityPerson } from './useUniversityPeople';
import type { Database } from '@/utils/supabase/types';

type Post = Database['public']['Tables']['posts']['Row'];
type Comment = Database['public']['Tables']['post_comments']['Row'];

interface FeedPostProps {
  post: Post;
}

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

// The feed list intentionally does NOT select the `image` column (a single
// image can be several MB of base64; the whole feed then waits on one
// multi-MB transfer and trips the 30s request guard). Images are fetched
// lazily per post, in parallel, each with its own request budget, so slow
// images degrade gracefully instead of blanking the entire feed.
function PostImage({ postId }: { postId: string }) {
  const { src, phase, progress, attemptsLeft } = usePostImageDownload(postId);
  const [showImage, setShowImage] = useState(false);

  if (phase === 'downloading' || phase === 'retrying') {
    return <PostImageDownload height={160} progress={progress} retrying={phase === 'retrying'} attemptsLeft={attemptsLeft} />;
  }
  if (phase === 'failed') {
    return (
      <div
        className="mt-3 w-full flex flex-col items-center justify-center gap-1"
        style={{ height: 160, borderRadius: 'var(--radius-md)', border: '1px dashed var(--surface-border)', background: 'var(--divider-soft)', color: 'var(--text-lighter)', fontSize: 12 }}
      >
        <ImageOff size={18} />
        <span>Image unavailable</span>
      </div>
    );
  }
  if (phase === 'empty' || !src) return null;
  return (
    <>
      <div
        className="mt-3 overflow-hidden flex justify-center cursor-zoom-in transition-opacity duration-200 hover:opacity-90"
        style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
        onClick={() => setShowImage(true)}
      >
        <img src={src} alt="" loading="lazy" className="max-w-full h-auto" style={{ maxHeight: 480, objectFit: 'contain' }} />
      </div>
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

function PostVideo({ videoUrl }: { videoUrl: string }) {
  const { src, phase, progress, attemptsLeft } = usePostVideoDownload(videoUrl);
  return (
    <div
      className="mt-3 overflow-hidden flex justify-center"
      style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
    >
      {phase === 'done' && src ? (
        <video src={src} controls playsInline className="max-w-full" style={{ maxHeight: 480 }} />
      ) : phase === 'failed' ? (
        <div
          className="w-full flex flex-col items-center justify-center gap-1"
          style={{ height: 200, borderRadius: 'var(--radius-md)', border: '1px dashed var(--surface-border)', background: 'var(--divider-soft)', color: 'var(--text-lighter)', fontSize: 12 }}
        >
          <VideoOff size={18} />
          <span>Video unavailable</span>
        </div>
      ) : (
        <PostImageDownload height={200} progress={progress} retrying={phase === 'retrying'} attemptsLeft={attemptsLeft} label="Downloading video…" />
      )}
    </div>
  );
}

export default function FeedPost({ post }: FeedPostProps) {
  const { user: session } = useSession();
  const supabase = useSupabase();
  const me = session?.email ?? '';
  const myName = session?.name ?? me;
  const meInitials = session?.initials ?? 'U';
  const isOwner = post.author_email?.toLowerCase() === me.toLowerCase();

  const { liked, likes } = usePostLikes(supabase, post.id, me);
  const { comments, loadingMore, hasMore, loadMore } = useComments(supabase, post.id);
  const { shares } = usePostShares(supabase, post.id);

  const [showLikers, setShowLikers] = useState(false);

  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  const [optimisticLikes, setOptimisticLikes] = useState<number | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const submittingRef = useRef(false);
  const [likePulse, setLikePulse] = useState(0);

  const isMine = post.author_email === me;
  const isEdited = (post.updated_at ?? 0) > (post.created_at ?? 0);

  const isLiked = optimisticLiked ?? liked;
  const likesCount = optimisticLikes ?? likes;

  useEffect(() => {
    const id = setTimeout(() => {
      setOptimisticLiked(null);
      setOptimisticLikes(null);
    }, 2000);
    return () => clearTimeout(id);
  }, [liked, likes, isLiked, likesCount]);

  const toggleLike = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!me) return;
    const next = !isLiked;
    setLikePulse((c) => c + 1);
    setOptimisticLiked(next);
    setOptimisticLikes((c) => (next ? (c ?? 0) + 1 : (c ?? 0) - 1));
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: me }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Like failed' }))).message);
    } catch (err) {
      setOptimisticLiked(liked);
      setOptimisticLikes(likes);
      toast.error(err instanceof Error ? err.message : 'Could not update like');
    }
  }, [me, isLiked, liked, likes, post.id]);

  const handleComment = useCallback(async () => {
    if (submittingRef.current) return;
    const content = commentText.trim();
    if (!content || !me) return;
    submittingRef.current = true;
    setCommentText('');
    const ta = commentInputRef.current;
    if (ta) ta.style.height = 'auto';
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorId: me,
          authorName: myName,
          authorInitials: meInitials,
          content,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Comment failed' }))).message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add comment');
    } finally {
      submittingRef.current = false;
    }
  }, [commentText, me, myName, meInitials, post.id]);

  const handleReply = useCallback((name: string) => {
    setCommentText((prev) => (prev.trim() ? prev : `@${name} `));
    commentInputRef.current?.focus();
  }, []);

  const handleCommentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCommentText(e.target.value);
    const ta = commentInputRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }, []);

  const handleShare = useCallback(async (selected: UniversityPerson[]) => {
    if (!me || selected.length === 0) return;
    try {
      const res = await fetch(`/api/posts/${post.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: selected.map((p) => ({ email: p.email, name: p.name })) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Share failed' }))).message);
      setShareMsg(`Shared with ${selected.length} ${selected.length === 1 ? 'person' : 'people'}`);
      toast.success(`Post shared with ${selected.length} ${selected.length === 1 ? 'person' : 'people'}`);
      setTimeout(() => setShareMsg(''), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not share post');
    }
  }, [me, post.id]);

  const saveEdit = useCallback(async () => {
    const content = editText.trim();
    if (!content) return;
    if (content === post.content) {
      setEditing(false);
      return;
    }
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Edit failed' }))).message);
      setEditing(false);
      toast.success('Post updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update post');
    }
  }, [editText, post.id]);

  const deletePost = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Delete failed' }))).message);
      toast.success('Post deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete post');
    }
  }, [post.id]);

  const editComment = useCallback(async (commentId: string, content: string) => {
    const text = content.trim();
    if (!text) return;
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Edit failed' }))).message);
      toast.success('Comment updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update comment');
    }
  }, []);

  const deleteComment = useCallback(async (commentId: string) => {
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Delete failed' }))).message);
      toast.success('Comment deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete comment');
    }
  }, []);

  return (
    <div className="flex gap-[14px] px-[22px] py-[18px] cursor-pointer transition-all hover:[background:linear-gradient(90deg,var(--surface-soft),transparent)]">
      <Link
        href={`/people/${encodeURIComponent(post.author_email)}`}
        className="w-[42px] h-[42px] rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0 no-underline"
        style={{ fontSize: 13, boxShadow: '0 3px 10px rgba(0,0,0,0.08)' }}
        title={`View ${post.author_name}'s profile`}
      >
        {post.author_initials}
      </Link>
      <div className="flex-1">
        <div className="flex items-center gap-[6px] mb-1 flex-wrap">
          <Link
            href={`/people/${encodeURIComponent(post.author_email)}`}
            className="no-underline hover:underline"
            style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}
          >
            {post.author_name}
          </Link>
          <CircleCheck size={12} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-lighter)', fontWeight: 500 }}>
            {post.author_role && `${post.author_role} \u2022 `}{timeAgo(post.created_at)}
          </span>
          {isEdited && (
            <span style={{ fontSize: 12, color: 'var(--text-lighter)', fontWeight: 500 }}>• edited</span>
          )}
          {isMine && (
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => { setEditText(post.content); setEditing(true); setConfirmingDelete(false); }}
                title="Edit post"
                className="cursor-pointer border-none"
                style={{ padding: 4, borderRadius: 'var(--radius-sm)', color: 'var(--text-light)', background: 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-light)'; }}
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => { setConfirmingDelete(true); setEditing(false); }}
                title="Delete post"
                className="cursor-pointer border-none"
                style={{ padding: 4, borderRadius: 'var(--radius-sm)', color: 'var(--text-light)', background: 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-light)'; }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
        {editing ? (
          <div className="mt-3">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              className="w-full outline-none p-3"
              style={{ background: 'var(--divider)', borderRadius: 'var(--radius-md)', fontSize: 14, color: 'var(--text)', lineHeight: 1.6, fontFamily: 'inherit', resize: 'vertical' }}
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={saveEdit}
                disabled={!editText.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 font-semibold border-none disabled:opacity-40 cursor-pointer"
                style={{ borderRadius: 'var(--radius-sm)', background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', fontSize: 12 }}
              >
                <Check size={13} /> Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 font-semibold border-none cursor-pointer"
                style={{ borderRadius: 'var(--radius-sm)', background: 'var(--divider)', color: 'var(--text-light)', fontSize: 12 }}
              >
                <X size={13} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 14, color: 'var(--text)', marginTop: 5, lineHeight: 1.6 }}>{post.content}</div>
        )}
        {confirmingDelete && (
          <div className="mt-3 flex items-center gap-2" style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}>
            <span style={{ fontSize: 12.5, color: 'var(--error)', fontWeight: 600 }}>Delete this post? This cannot be undone.</span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={deletePost}
                className="px-3 py-1 font-semibold border-none cursor-pointer"
                style={{ borderRadius: 'var(--radius-sm)', background: 'linear-gradient(var(--error), var(--error-dark))', color: '#fff', fontSize: 12 }}
              >
                Yes, delete
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="px-3 py-1 font-semibold border-none cursor-pointer"
                style={{ borderRadius: 'var(--radius-sm)', background: 'var(--divider)', color: 'var(--text-light)', fontSize: 12 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {post.video_url ? (
          <PostVideo videoUrl={post.video_url} />
        ) : post.image ? (
          <div
            className="mt-3 overflow-hidden flex justify-center"
            style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
          >
            <img src={post.image} alt="" className="max-w-full h-auto" style={{ maxHeight: 480, objectFit: 'contain' }} />
          </div>
        ) : (
          <PostImage postId={post.id} />
        )}
        <div className="flex gap-[6px] mt-[10px] flex-wrap">
          {(post.item_status === 'lost' || post.item_status === 'found') && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[11px] font-bold"
              style={{
                background: post.item_status === 'lost' ? 'var(--tag-lost-bg)' : 'var(--tag-event-bg)',
                color: post.item_status === 'lost' ? 'var(--tag-lost-text)' : 'var(--tag-event-text)',
                border: `1px solid ${post.item_status === 'lost' ? 'var(--tag-lost-border)' : 'var(--tag-event-border)'}`,
                whiteSpace: 'nowrap',
              }}
            >
              {post.item_status === 'lost' ? '🔍 Lost' : '✓ Found'}
            </span>
          )}
          {post.item_location && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[11px] font-bold"
              style={{
                background: 'rgba(40, 114, 161, 0.12)',
                color: '#1c4f73',
                border: '1px solid rgba(40, 114, 161, 0.4)',
                whiteSpace: 'nowrap',
              }}
            >
              📍 {post.item_location}
            </span>
          )}
          {(post.tags as { label: string; emoji?: string }[] | null)?.map((tag, i) => (
            <PostTag key={i} label={tag.label} emoji={tag.emoji} />
          ))}
        </div>
        <div
          className="flex items-center gap-[18px] mt-3 pt-3"
          style={{ borderTop: '1px solid var(--divider)' }}
        >
          <div className="flex items-center" style={{ gap: 2 }}>
            <button
              onClick={toggleLike}
              className="flex items-center gap-[5px] text-xs font-semibold cursor-pointer transition-all px-2 py-1 rounded-lg"
              style={{
                color: isLiked ? 'var(--primary)' : 'var(--text-light)',
                backgroundColor: isLiked ? 'rgba(40, 114, 161,0.12)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isLiked) { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'rgba(40, 114, 161,0.12)'; }
              }}
              onMouseLeave={(e) => {
                if (!isLiked) { e.currentTarget.style.color = 'var(--text-light)'; e.currentTarget.style.backgroundColor = 'transparent'; }
              }}
            >
              <motion.span
                key={likePulse}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.35, 1] }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="inline-flex"
              >
                <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
              </motion.span>
            </button>
            <button
              onClick={isOwner ? () => setShowLikers(true) : toggleLike}
              title={isOwner ? 'See who liked this post' : undefined}
              className="text-xs font-semibold cursor-pointer px-2 py-1 rounded-lg transition-all duration-200 hover:scale-105"
              style={{ color: 'var(--text-light)', background: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'rgba(40, 114, 161,0.12)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-light)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {likesCount ?? '—'}
            </button>
          </div>
          <button
            onClick={() => { setShowComments(prev => !prev); setTimeout(() => commentInputRef.current?.focus(), 50); }}
            className="flex items-center gap-[5px] text-xs font-semibold cursor-pointer transition-all px-2 py-1 rounded-lg"
            style={{ color: showComments ? 'var(--primary)' : 'var(--text-light)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'rgba(40, 114, 161,0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-light)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <MessageCircle size={14} /> {comments?.length ?? post.comments_count ?? 0}
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-[5px] text-xs font-semibold cursor-pointer transition-all px-2 py-1 rounded-lg"
            style={{ color: 'var(--text-light)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'rgba(40, 114, 161,0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-light)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Share2 size={14} /> {shares ?? 0} Share
          </button>
        </div>

        {shareMsg && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            style={{ marginTop: 8, padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(40, 114, 161,0.1)', color: 'var(--primary)', fontSize: 12, fontWeight: 600 }}
          >
            {shareMsg}
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="mt-3 pt-3 overflow-hidden"
            style={{ borderTop: '1px solid var(--divider)' }}
          >
            <div className="pl-4 border-l-2 flex flex-col gap-2 mb-3" style={{ borderColor: 'var(--thread)' }}>
              {(comments ?? []).map((c) => (
                <CommentRow key={c.id} comment={c} me={me} meInitials={meInitials} onEdit={editComment} onDelete={deleteComment} onReply={handleReply} />
              ))}
              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="self-start mb-1 px-2 py-1 font-semibold border-none cursor-pointer disabled:opacity-50"
                  style={{ borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--primary)', fontSize: 12 }}
                >
                  {loadingMore ? 'Loading more comments...' : 'Load more comments'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-dark/80 flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 11 }}>
                {meInitials}
              </div>
              <div
                className="flex-1 flex items-end gap-1.5 rounded-xl px-3 py-2 backdrop-blur-md transition-shadow focus-within:ring-1 focus-within:ring-cyan-500/50"
                style={{ background: 'var(--divider)', border: '1.5px solid var(--surface-border)' }}
              >
                <textarea
                  ref={commentInputRef}
                  value={commentText}
                  maxLength={300}
                  rows={1}
                  onChange={handleCommentChange}
                  placeholder="Write a comment..."
                  className="flex-1 bg-transparent outline-none resize-none leading-snug"
                  style={{ fontSize: 13.5, color: 'var(--text)', border: 'none', padding: '4px 0', maxHeight: 120 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleComment();
                    }
                  }}
                />
                <span className="shrink-0 text-[10px] font-medium" style={{ color: commentText.length >= 300 ? 'var(--danger)' : 'var(--text-lighter)' }}>
                  {commentText.length}/300
                </span>
                <button
                  onClick={handleComment}
                  disabled={!commentText.trim()}
                  className="flex items-center justify-center cursor-pointer border-none disabled:opacity-30"
                  style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', color: 'var(--primary)', background: 'transparent' }}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        onShare={handleShare}
      />

      {showLikers && (
        <LikersModal
          open={showLikers}
          onClose={() => setShowLikers(false)}
          postId={post.id}
          me={me}
        />
      )}
    </div>
  );
}

function CommentRow({ comment, me, meInitials, onEdit, onDelete, onReply }: { comment: Comment; me: string; meInitials: string; onEdit: (id: string, content: string) => void; onDelete: (id: string) => void; onReply: (name: string) => void }) {
  const isMe = comment.author_email === me;
  const isEdited = (comment.updated_at ?? 0) > (comment.created_at ?? 0);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.content);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 backdrop-blur-md" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
      <div
        className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-dark/80 flex items-center justify-center text-white font-bold shrink-0"
        style={{ fontSize: 11 }}
      >
        {isMe ? meInitials : (comment.author_initials ?? comment.author_name?.slice(0, 2).toUpperCase())}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--accent)' }}>
            {isMe ? 'You' : comment.author_name}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-lighter)', whiteSpace: 'nowrap' }}>{timeAgo(comment.created_at)}</span>
          {isEdited && <span style={{ fontSize: 11, color: 'var(--text-lighter)' }}>• edited</span>}
          <div className="ml-auto flex items-center gap-0.5">
            <button
              onClick={() => onReply(comment.author_name ?? '')}
              title="Reply"
              className="cursor-pointer border-none transition-colors"
              style={{ padding: 3, color: 'var(--text-lighter)', background: 'transparent', borderRadius: 'var(--radius-sm)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-lighter)'; }}
            >
              <Reply size={12} />
            </button>
            {isMe && (
              <>
                <button
                  onClick={() => { setText(comment.content); setEditing(true); }}
                  title="Edit comment"
                  className="cursor-pointer border-none transition-colors"
                  style={{ padding: 3, color: 'var(--text-lighter)', background: 'transparent', borderRadius: 'var(--radius-sm)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-lighter)'; }}
                >
                  <Pencil size={12} />
                </button>
                {confirming ? (
                  <>
                    <span style={{ fontSize: 10.5, color: 'var(--error)', fontWeight: 700 }}>Delete?</span>
                    <button onClick={() => onDelete(comment.id)} className="cursor-pointer border-none" style={{ color: 'var(--error)', background: 'transparent', padding: 3 }}>
                      <Check size={12} />
                    </button>
                    <button onClick={() => setConfirming(false)} className="cursor-pointer border-none" style={{ color: 'var(--text-light)', background: 'transparent', padding: 3 }}>
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirming(true)}
                    title="Delete comment"
                    className="cursor-pointer border-none transition-colors"
                    style={{ padding: 3, color: 'var(--text-lighter)', background: 'transparent', borderRadius: 'var(--radius-sm)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-lighter)'; }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        {editing ? (
          <div className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 mt-1.5" style={{ background: 'var(--divider)', border: '1.5px solid var(--surface-border)' }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1 bg-transparent outline-none"
              style={{ fontSize: 13, color: 'var(--text)', border: 'none' }}
              onKeyDown={(e) => { if (e.key === 'Enter') { onEdit(comment.id, text); setEditing(false); } if (e.key === 'Escape') { setText(comment.content); setEditing(false); } }}
            />
            <button
              onClick={() => { onEdit(comment.id, text); setEditing(false); }}
              disabled={!text.trim()}
              className="cursor-pointer border-none disabled:opacity-30"
              style={{ color: 'var(--primary)', background: 'transparent' }}
              title="Save edit"
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => { setText(comment.content); setEditing(false); }}
              className="cursor-pointer border-none"
              style={{ color: 'var(--text-light)', background: 'transparent' }}
              title="Cancel edit"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, marginTop: 2, wordBreak: 'break-word' }}>{comment.content}</div>
        )}
      </div>
    </div>
  );
}
