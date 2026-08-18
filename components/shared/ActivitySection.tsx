'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Heart, MessageCircle, Share2, Plus, X, Send, Play, Trash2, Music2, Clapperboard, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabase } from '@/utils/supabase/client';
import { useActivities, useActivityLikes, useActivityComments, useActivityShares } from '@/lib/supabase/hooks';
import type { Activity, ActivityComment } from '@/lib/supabase/hooks';
import { useSession } from './session';
import ShareModal from './ShareModal';
import type { UniversityPerson } from './useUniversityPeople';
import { usePostImageDownload } from '@/lib/supabase/usePostImage';

const KIND_GRADIENTS: Record<string, string> = {
  text: 'linear-gradient(160deg, #0f2027, #203a43, #2c5364)',
  photo: 'linear-gradient(160deg, #41295a, #2f0743)',
  video: 'linear-gradient(160deg, #141e30, #243b55)',
};

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

interface ActivitySlideProps {
  activity: Activity;
  playing: boolean;
  onTogglePlay: () => void;
  onOpenComments: () => void;
  canManage: boolean;
  onDelete: (id: string) => void;
  videoRef: (node: HTMLVideoElement | null) => void;
}

function ActivityMedia({ activity, videoRef }: { activity: Activity; videoRef?: (node: HTMLVideoElement | null) => void }) {
  const { src, phase } = usePostImageDownload(activity.id);

  if (activity.kind === 'video' && activity.media_url) {
    return (
      <video
        ref={videoRef}
        src={activity.media_url}
        className="w-full h-full object-cover"
        muted
        loop
        playsInline
        preload="metadata"
      />
    );
  }
  if (activity.kind === 'photo') {
    const media = src ?? activity.media_url;
    if (phase === 'downloading' || phase === 'retrying') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ background: 'linear-gradient(160deg, #41295a, #2f0743)' }}>
          <Loader2 size={22} className="animate-spin text-white/70" />
        </div>
      );
    }
    if (media) return <img src={media} alt={activity.caption ?? ''} loading="lazy" decoding="async" className="w-full h-full object-cover" />;
  }
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center px-8 text-center"
      style={{ background: KIND_GRADIENTS[activity.kind] ?? KIND_GRADIENTS.text }}
    >
      <div
        className="text-white font-bold leading-relaxed break-words"
        style={{ fontSize: 'clamp(18px, 4.2vw, 26px)', textShadow: '0 2px 14px rgba(0,0,0,0.55)', maxWidth: 420 }}
      >
        {activity.caption}
      </div>
    </div>
  );
}

function ActivitySlide({ activity, playing, onTogglePlay, onOpenComments, canManage, onDelete, videoRef }: ActivitySlideProps) {
  const supabase = useSupabase();
  const { user: session } = useSession();
  const me = session?.email ?? '';
  const { liked, likes } = useActivityLikes(supabase, activity.id, me);
  const { comments } = useActivityComments(supabase, activity.id);
  const { shares } = useActivityShares(supabase, activity.id);
  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  const [optimisticLikes, setOptimisticLikes] = useState<number | null>(null);
  const [likePulse, setLikePulse] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const [downloading, setDownloading] = useState(false);

  const downloadVideo = async () => {
    if (!activity.media_url || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(activity.media_url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-${activity.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      toast.error('Could not download video');
    } finally {
      setDownloading(false);
    }
  };

  const isLiked = optimisticLiked ?? liked;
  const likesCount = optimisticLikes ?? likes;

  useEffect(() => {
    const id = setTimeout(() => {
      setOptimisticLiked(null);
      setOptimisticLikes(null);
    }, 2000);
    return () => clearTimeout(id);
  }, [liked, likes]);

  const toggleLike = useCallback(async () => {
    if (!me) return;
    const next = !isLiked;
    setLikePulse((c) => c + 1);
    setOptimisticLiked(next);
    setOptimisticLikes((c) => (next ? (c ?? 0) + 1 : (c ?? 0) - 1));
    try {
      const res = await fetch(`/api/activities/${activity.id}/like`, {
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
  }, [me, isLiked, liked, likes, activity.id]);

  const handleShare = useCallback(async (selected: UniversityPerson[]) => {
    if (!me || selected.length === 0) return;
    try {
      const res = await fetch(`/api/activities/${activity.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: selected.map((p) => ({ email: p.email, name: p.name })) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Share failed' }))).message);
      toast.success(`Activity shared with ${selected.length} ${selected.length === 1 ? 'person' : 'people'}`);
      setShareMsg(`Shared with ${selected.length} ${selected.length === 1 ? 'person' : 'people'}`);
      setTimeout(() => setShareMsg(''), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not share activity');
    }
  }, [me, activity.id]);

  const railItem: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    color: '#fff',
    cursor: 'pointer',
    textShadow: '0 1px 6px rgba(0,0,0,0.6)',
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none" style={{ background: '#000' }}>
      <button
        type="button"
        className="absolute inset-0 w-full h-full border-none p-0 m-0 cursor-pointer"
        style={{ background: 'transparent' }}
        onClick={onTogglePlay}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        <ActivityMedia activity={activity} videoRef={videoRef} />
      </button>

      {activity.kind === 'video' && activity.media_url && (
        <button
          type="button"
          onClick={downloadVideo}
          disabled={downloading}
          title="Download video"
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
        >
          {downloading ? <Loader2 size={17} className="animate-spin text-white" /> : <Download size={17} color="#fff" />}
        </button>
      )}

      {/* Dark gradient overlays for readability */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{ height: '38%', background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)' }}
      />
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{ height: '16%', background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)' }}
      />

      {activity.kind === 'video' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <AnimatePresence>
            {!playing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
              >
                <Play size={28} fill="#fff" color="#fff" style={{ marginLeft: 3 }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Right action rail */}
      <div className="absolute bottom-20 right-3 lg:right-4 flex flex-col items-center gap-4 z-10">
        {activity.author_email ? (
          <Link
            href={`/people/${encodeURIComponent(activity.author_email)}?back=activity&activity=${activity.id}`}
            className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center font-bold text-white hover:scale-110 transition-transform"
            style={{ fontSize: 13, boxShadow: '0 2px 10px rgba(0,0,0,0.5)', background: 'rgba(0,0,0,0.25)' }}
            title={`View ${activity.author_name ?? ''}'s profile`}
          >
            {activity.author_initials}
          </Link>
        ) : (
          <div className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center font-bold text-white" style={{ fontSize: 13, boxShadow: '0 2px 10px rgba(0,0,0,0.5)', background: 'rgba(0,0,0,0.25)' }}>
            {activity.author_initials}
          </div>
        )}
        <button type="button" onClick={toggleLike} style={railItem} className="hover:scale-110 transition-transform">
          <motion.span
            key={likePulse}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="inline-flex"
          >
            <Heart size={30} fill={isLiked ? '#ff2d55' : 'none'} color={isLiked ? '#ff2d55' : '#fff'} />
          </motion.span>
          <span className="text-[11px] font-bold">{likesCount ?? 0}</span>
        </button>
        <button type="button" onClick={onOpenComments} style={railItem} className="hover:scale-110 transition-transform">
          <MessageCircle size={29} fill="#fff" color="#fff" className="opacity-90" />
          <span className="text-[11px] font-bold">{comments?.length ?? activity.comments_count ?? 0}</span>
        </button>
        <button type="button" onClick={() => setShowShare(true)} style={railItem} className="hover:scale-110 transition-transform">
          <Share2 size={28} fill="#fff" color="#fff" className="opacity-90" />
          <span className="text-[11px] font-bold">{shares ?? 0}</span>
        </button>
        {canManage && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            style={railItem}
            className="hover:scale-110 transition-transform"
            title="Delete activity"
          >
            <Trash2 size={24} color="#fff" className="opacity-90" />
          </button>
        )}
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-16 lg:right-20 px-4 pb-6 z-10 text-left">
        <div className="flex items-center gap-2 mb-1.5">
          {activity.author_email ? (
            <Link
              href={`/people/${encodeURIComponent(activity.author_email)}?back=activity&activity=${activity.id}`}
              className="font-bold text-white hover:underline no-underline"
              style={{ fontSize: 15, textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}
            >
              {activity.author_name}
            </Link>
          ) : (
            <span className="font-bold text-white" style={{ fontSize: 15, textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>
              {activity.author_name}
            </span>
          )}
          <span className="text-white/80" style={{ fontSize: 11, textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>{timeAgo(activity.created_at)}</span>
        </div>
        {activity.caption && activity.kind !== 'text' && (
          <div className="text-white mb-1.5" style={{ fontSize: 13.5, lineHeight: 1.45, textShadow: '0 1px 6px rgba(0,0,0,0.6)', maxWidth: 460, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {activity.caption}
          </div>
        )}
        <div className="flex items-center gap-1.5 overflow-hidden" style={{ maxWidth: 420 }}>
          <Music2 size={14} className="shrink-0 text-white" />
          <div className="overflow-hidden flex-1">
            <div className="activity-marquee text-white/90" style={{ fontSize: 12, textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>
              UniConnect Activity • by {activity.author_name}
            </div>
          </div>
        </div>
        {shareMsg && (
          <div className="mt-2 inline-block px-3 py-1 rounded-full text-white" style={{ fontSize: 11.5, background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)' }}>
            {shareMsg}
          </div>
        )}
      </div>

      {confirmingDelete && (
        <div className="absolute inset-x-4 bottom-24 z-20 rounded-2xl p-4 flex items-center gap-3" style={{ background: 'rgba(15,15,15,0.92)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <span className="text-white text-[13px] font-semibold flex-1">Delete this activity?</span>
          <button
            type="button"
            onClick={() => { setConfirmingDelete(false); onDelete(activity.id); }}
            className="px-3 py-1.5 rounded-lg border-none cursor-pointer text-white font-bold"
            style={{ background: 'linear-gradient(#ef4444, #b91c1c)', fontSize: 12 }}
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            className="px-3 py-1.5 rounded-lg border-none cursor-pointer text-white/80 font-semibold"
            style={{ background: 'rgba(255,255,255,0.15)', fontSize: 12 }}
          >
            Cancel
          </button>
        </div>
      )}

      <ShareModal open={showShare} onClose={() => setShowShare(false)} onShare={handleShare} />
    </div>
  );
}

function CommentsPanel({ activity, onClose }: { activity: Activity; onClose: () => void }) {
  const supabase = useSupabase();
  const { user: session } = useSession();
  const me = session?.email ?? '';
  const myName = session?.name ?? me;
  const meInitials = session?.initials ?? 'U';
  const { comments, loading } = useActivityComments(supabase, activity.id);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  const submit = useCallback(async () => {
    if (submittingRef.current) return;
    const content = text.trim();
    if (!content || !me) return;
    submittingRef.current = true;
    setText('');
    try {
      const res = await fetch(`/api/activities/${activity.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorId: me, authorName: myName, authorInitials: meInitials, content }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Comment failed' }))).message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add comment');
    } finally {
      submittingRef.current = false;
    }
  }, [text, me, myName, meInitials, activity.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 60 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      className="absolute inset-x-0 bottom-0 z-30 rounded-t-2xl flex flex-col"
      style={{ background: 'var(--modal-bg)', borderTop: '1px solid var(--surface-border)', boxShadow: '0 -12px 40px rgba(0,0,0,0.35)', maxHeight: '62%' }}
    >
      <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: '1px solid var(--surface)' }}>
        <div className="font-bold" style={{ fontSize: 14, color: 'var(--accent)' }}>
          {activity.comments_count ?? comments?.length ?? 0} Comments
        </div>
        <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm" title="Close">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5" style={{ minHeight: 120 }}>
        {loading && (
          <div className="text-center py-6 text-sm" style={{ color: 'var(--text-lighter)' }}>
            <Loader2 size={16} className="animate-spin inline-block mr-2" /> Loading comments...
          </div>
        )}
        {!loading && (!comments || comments.length === 0) && (
          <div className="text-center py-6 text-sm" style={{ color: 'var(--text-lighter)' }}>No comments yet — be the first!</div>
        )}
        {(comments ?? []).map((c, i) => (
          <motion.div
            key={c.id}
            layout
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30, delay: Math.min(i * 0.04, 0.45) }}
          >
            <CommentRow comment={c} onReply={(name) => { setText((p) => (p.trim() ? p : `@${name} `)); inputRef.current?.focus(); }} />
          </motion.div>
        ))}
      </div>
      <div className="flex items-center gap-2.5 px-4 py-3 shrink-0" style={{ borderTop: '1px solid var(--surface)' }}>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-dark/80 flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 11 }}>
          {meInitials}
        </div>
        <div className="flex-1 flex items-center gap-1.5 rounded-xl px-3 py-2" style={{ background: 'var(--divider)', border: '1.5px solid var(--surface-border)' }}>
          <input
            ref={inputRef}
            value={text}
            maxLength={300}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: 13.5, color: 'var(--text)', border: 'none' }}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />
          <button
            onClick={submit}
            disabled={!text.trim()}
            className="flex items-center justify-center cursor-pointer border-none disabled:opacity-30"
            style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', color: 'var(--primary)', background: 'transparent' }}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function CommentRow({ comment, onReply }: { comment: ActivityComment; onReply: (name: string) => void }) {
  const { user: session } = useSession();
  const isMe = comment.author_email === session?.email;
  return (
    <div className="flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-dark/80 flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 11 }}>
        {isMe ? session?.initials : (comment.author_initials ?? comment.author_name?.slice(0, 2).toUpperCase())}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold" style={{ fontSize: 12.5, color: 'var(--accent)' }}>{isMe ? 'You' : comment.author_name}</span>
          <span style={{ fontSize: 11, color: 'var(--text-lighter)', whiteSpace: 'nowrap' }}>{timeAgo(comment.created_at)}</span>
          <button
            onClick={() => onReply(comment.author_name ?? '')}
            className="ml-auto cursor-pointer border-none"
            style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'transparent' }}
          >
            Reply
          </button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, marginTop: 2, wordBreak: 'break-word' }}>{comment.content}</div>
      </div>
    </div>
  );
}

interface UploadModalProps {
  onClose: () => void;
  onPosted: () => void;
}

function UploadModal({ onClose, onPosted }: UploadModalProps) {
  const supabase = useSupabase();
  const [kind, setKind] = useState<'video' | 'photo' | 'text'>('video');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptFile = (f: File | null) => {
    if (!f) return;
    if (kind === 'video') {
      if (!f.type.startsWith('video/')) { toast.error('Please choose a video file'); return; }
      if (f.size > 100 * 1024 * 1024) { toast.error('Video must be 100MB or smaller'); return; }
    } else {
      if (!f.type.startsWith('image/')) { toast.error('Please choose an image file'); return; }
      if (f.size > 10 * 1024 * 1024) { toast.error('Image must be 10MB or smaller'); return; }
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const switchKind = (k: 'video' | 'photo' | 'text') => {
    setKind(k);
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submit = async () => {
    if (uploading) return;
    if (kind !== 'text' && !file) { toast.error(kind === 'video' ? 'Choose a video to upload' : 'Choose a photo to upload'); return; }
    if (kind === 'text' && !caption.trim()) { toast.error('Write something first'); return; }
    setUploading(true);
    let uploadedPath: string | null = null;
    try {
      let mediaUrl: string | null = null;
      if (file) {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || (kind === 'video' ? 'mp4' : 'jpg');
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('activity-media')
          .upload(fileName, file, { contentType: file.type });
        if (uploadError) throw new Error(uploadError.message || 'Could not upload media');
        uploadedPath = fileName;
        const { data: urlData } = supabase.storage.from('activity-media').getPublicUrl(fileName);
        mediaUrl = urlData.publicUrl;
      }
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          caption: caption.trim() || undefined,
          mediaUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not post activity');
      toast.success('Activity posted!');
      onPosted();
      onClose();
    } catch (err) {
      if (uploadedPath) {
        await supabase.storage.from('activity-media').remove([uploadedPath]).catch(() => null);
      }
      toast.error(err instanceof Error ? err.message : 'Could not post activity');
    } finally {
      setUploading(false);
    }
  };

  const kindBtn = (k: 'video' | 'photo' | 'text', label: string) => (
    <button
      key={k}
      type="button"
      onClick={() => switchKind(k)}
      className="flex-1 py-2 rounded-lg font-semibold cursor-pointer border-none transition-all"
      style={{
        background: kind === k ? 'linear-gradient(var(--primary), var(--primary-dark))' : 'var(--divider)',
        color: kind === k ? '#fff' : 'var(--text-light)',
        fontSize: 12.5,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.6)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-base-100 w-full"
        style={{ maxWidth: 480, borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', overflow: 'hidden' }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--surface)' }}>
          <div className="flex items-center gap-2 font-bold" style={{ fontSize: 15, color: 'var(--accent)' }}>
            <Clapperboard size={17} style={{ color: 'var(--primary)' }} /> Post an Activity
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm" title="Close">
            <X size={17} />
          </button>
        </div>
        <div className="p-5">
          <div className="flex gap-2 mb-4">
            {kindBtn('video', '🎬 Video')}
            {kindBtn('photo', '🖼️ Photo')}
            {kindBtn('text', '✍️ Text')}
          </div>

          {kind !== 'text' && (
            <div className="mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept={kind === 'video' ? 'video/*' : 'image/*'}
                className="hidden"
                onChange={(e) => { acceptFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
              />
              {preview ? (
                <div className="relative rounded-xl overflow-hidden" style={{ border: '1px solid var(--surface-border)' }}>
                  {kind === 'video' ? (
                    <video src={preview} className="w-full object-contain" style={{ maxHeight: 260 }} controls muted />
                  ) : (
                    <img src={preview} alt="Preview" className="w-full object-contain" style={{ maxHeight: 260 }} />
                  )}
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreview(null); }}
                    className="btn btn-ghost btn-circle btn-xs absolute top-2 right-2 bg-base-100"
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
                    title="Remove"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                  style={{ border: '1.5px dashed var(--secondary)', background: 'var(--secondary-lighter)', borderRadius: 'var(--radius-md)', padding: '28px 14px' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--secondary)'; }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                    {kind === 'video' ? '📹 Choose a video' : '🖼️ Choose a photo'}
                  </span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-lighter)' }}>
                    {kind === 'video' ? 'MP4 / WebM up to 100MB' : 'PNG, JPG or WebP up to 10MB'}
                  </span>
                </button>
              )}
            </div>
          )}

          <div className="mb-4">
            <label className="block font-semibold mb-1.5" style={{ fontSize: 13, color: 'var(--accent)' }}>Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={kind === 'text' ? 5 : 2}
              maxLength={500}
              placeholder={kind === 'text' ? 'What would you like to announce to the university?' : 'Describe your video/photo...'}
              className="w-full outline-none resize-none"
              style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit' }}
            />
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={uploading}
            className="w-full font-semibold border-none cursor-pointer disabled:opacity-60"
            style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '10px 16px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {uploading ? 'Posting...' : 'Post Activity'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function ActivitySection() {
  const supabase = useSupabase();
  const { user: session } = useSession();
  const role = session?.role ?? '';
  const canUpload = role === 'admin' || role === 'student-affair';

  const { activities, loading, hasError, refresh, loadMore, hasMore, loadingMore } = useActivities(supabase);
  const list = activities ?? [];
  const [showUpload, setShowUpload] = useState(false);
  const [commentsFor, setCommentsFor] = useState<Activity | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Lazy loading + autoplay on scroll.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      // Lazy loading: fetch the next page when approaching the bottom.
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
      if (atBottom && hasMore && !loadingMore) loadMore();
      const slides = el.querySelectorAll<HTMLElement>('[data-activity-slide]');
      const viewportTop = el.getBoundingClientRect().top;
      const viewportH = el.clientHeight;
      let bestId: string | null = null;
      let bestRatio = 0;
      slides.forEach((s) => {
        const r = s.getBoundingClientRect();
        const visible = Math.min(r.bottom, viewportTop + viewportH) - Math.max(r.top, viewportTop);
        const ratio = visible / r.height;
        if (ratio > bestRatio) { bestRatio = ratio; bestId = s.getAttribute('data-activity-slide'); }
      });
      const id: string | null = bestId;
      setPlayingId((prev) => {
        if (prev === id) return prev;
        return id;
      });
    };
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { el.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [activities, hasMore, loadingMore, loadMore]);

  // Lazy loading: auto-fetch the next page when the bottom sentinel scrolls into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = containerRef.current;
    if (!sentinel || !root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) loadMore();
      },
      { root, rootMargin: '120px 0px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  // Apply play/pause to videos whenever the active slide changes.
  useEffect(() => {
    videoRefs.current.forEach((v, id) => {
      if (id === playingId) {
        const p = v.play().catch(() => {});
        void p;
      } else {
        v.pause();
      }
    });
  }, [playingId]);

  const togglePlay = useCallback((id: string) => {
    const v = videoRefs.current.get(id);
    if (!v) return;
    if (v.paused) { void v.play().catch(() => {}); setPlayingId(id); }
    else { v.pause(); setPlayingId((p) => (p === id ? null : p)); }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete activity');
      toast.success('Activity deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete activity');
    }
  }, []);

  const isOwner = useCallback((a: Activity) => a.author_email?.toLowerCase() === (session?.email ?? '').toLowerCase(), [session?.email]);

  const [focusedId, setFocusedId] = useState<string | null>(null);

  // When arriving via ?activity=<id> (from a share or notification), scroll to that slide and highlight it.
  useEffect(() => {
    if (loading || list.length === 0) return;
    const focusId = new URLSearchParams(window.location.search).get('activity');
    if (!focusId) return;
    const slides = containerRef.current?.querySelectorAll<HTMLElement>('[data-activity-slide]');
    if (slides) {
      for (const s of Array.from(slides)) {
        if (s.getAttribute('data-activity-slide') === focusId) {
          s.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setFocusedId(focusId);
          break;
        }
      }
    }
    window.history.replaceState(null, '', window.location.pathname);
  }, [loading, list]);

  useEffect(() => {
    if (!focusedId) return;
    const t = setTimeout(() => setFocusedId(null), 2500);
    return () => clearTimeout(t);
  }, [focusedId]);

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        className="h-[calc(100dvh-6rem)] lg:h-[calc(100dvh-7.5rem)] max-w-[520px] mx-auto overflow-y-auto scrollbar-hide snap-y snap-proximity"
        style={{ borderRadius: 'var(--radius-lg)' }}
      >
        {/* Header overlay */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 pointer-events-none" style={{ marginBottom: '-52px' }}>
          <div className="flex items-center gap-2 pointer-events-auto">
            <span className="text-white font-extrabold tracking-tight" style={{ fontSize: 17, textShadow: '0 1px 8px rgba(0,0,0,0.7)' }}>Activity</span>
          </div>
          {canUpload && (
            <button
              type="button"
              onClick={() => setShowUpload(true)}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full font-bold border-none cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 12.5, padding: '7px 14px', backdropFilter: 'blur(8px)', boxShadow: '0 2px 10px rgba(0,0,0,0.4)' }}
            >
              <Plus size={15} /> Upload
            </button>
          )}
        </div>

        {loading && (
          <div className="h-full flex flex-col items-center justify-center gap-3" style={{ background: 'var(--surface-soft)', borderRadius: 'var(--radius-lg)' }}>
            <span className="loading loading-spinner loading-lg" style={{ color: 'var(--primary)' }} />
            <p style={{ fontSize: 13, color: 'var(--text-lighter)' }}>Loading activities...</p>
          </div>
        )}

        {!loading && hasError && (
          <div className="h-full flex flex-col items-center justify-center gap-3" style={{ background: 'var(--surface-soft)', borderRadius: 'var(--radius-lg)' }}>
            <p style={{ fontSize: 13, color: 'var(--text-light)' }}>Could not load activities — check your connection.</p>
            <button
              onClick={refresh}
              className="btn btn-sm text-white border-none"
              style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !hasError && list.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-2 px-8 text-center" style={{ background: 'var(--surface-soft)', borderRadius: 'var(--radius-lg)' }}>
            <Clapperboard size={34} style={{ color: 'var(--text-lighter)' }} />
            <p style={{ fontSize: 13.5, color: 'var(--text-light)', maxWidth: 300 }}>
              {canUpload ? 'No activities yet — upload the first video, photo or text post.' : 'No activities yet — check back soon!'}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {list.map((a) => (
            <div
              key={a.id}
              data-activity-slide={a.id}
              className="snap-start w-full h-[calc(100dvh-6.5rem)] lg:h-[calc(100dvh-8rem)] overflow-hidden relative"
              style={{ borderRadius: 'var(--radius-lg)', scrollSnapAlign: 'start', boxShadow: focusedId === a.id ? '0 0 0 3px var(--primary)' : undefined }}
            >
              <ActivitySlide
                activity={a}
                playing={playingId === a.id}
                onTogglePlay={() => togglePlay(a.id)}
                onOpenComments={() => setCommentsFor(a)}
                canManage={canUpload || isOwner(a)}
                onDelete={handleDelete}
                videoRef={(node) => {
                  if (node) videoRefs.current.set(a.id, node);
                  else videoRefs.current.delete(a.id);
                }}
              />
            </div>
          ))}
        </div>

        {hasMore && (
          <div ref={sentinelRef} className="flex items-center justify-center" style={{ height: 56 }}>
            {loadingMore ? (
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-lighter)' }} />
            ) : (
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-lighter)' }}>Loading more...</span>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {commentsFor && (
          <div className="absolute inset-0 z-30" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <button type="button" className="absolute inset-0 w-full h-full border-none cursor-pointer" style={{ background: 'transparent' }} onClick={() => setCommentsFor(null)} />
            <CommentsPanel activity={commentsFor} onClose={() => setCommentsFor(null)} />
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUpload && <UploadModal onClose={() => setShowUpload(false)} onPosted={() => refresh()} />}
      </AnimatePresence>
    </div>
  );
}
