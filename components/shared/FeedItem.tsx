'use client';

import { useState, useCallback, useRef } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, CircleCheck, Send } from 'lucide-react';
import type { FeedItemData } from './types';
import type { UniversityPerson } from './useUniversityPeople';
import ShareModal from './ShareModal';
import PostTag from './PostTag';

interface FeedItemProps {
  item: FeedItemData;
}

export default function FeedItem({ item }: FeedItemProps) {
  const [isLiked, setIsLiked] = useState(item.isLiked ?? false);
  const [likes, setLikes] = useState(item.likes);
  const [isSaved, setIsSaved] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<string[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const commentInputRef = useRef<HTMLInputElement>(null);

  const toggleLike = useCallback(() => {
    setIsLiked(prev => { setLikes(l => prev ? l - 1 : l + 1); return !prev; });
  }, []);

  const toggleSave = useCallback(() => setIsSaved(prev => !prev), []);

  const handleComment = useCallback(() => {
    if (!commentText.trim()) return;
    setComments(prev => [...prev, commentText.trim()]);
    setCommentText('');
  }, [commentText]);

  const handleShare = useCallback((selected: UniversityPerson[]) => {
    setShareMsg(`Shared with ${selected.length} ${selected.length === 1 ? 'person' : 'people'}`);
    setTimeout(() => setShareMsg(''), 3000);
  }, []);

  return (
    <div className="flex gap-[14px] px-[22px] py-[18px] cursor-pointer transition-all hover:[background:linear-gradient(90deg,var(--surface-soft),transparent)]">
      <div
        className={`w-[42px] h-[42px] rounded-full bg-gradient-to-br ${item.author.color} flex items-center justify-center text-white font-bold shrink-0`}
        style={{ fontSize: 13, boxShadow: '0 3px 10px rgba(0,0,0,0.08)' }}
      >
        {item.author.initials}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-[6px] mb-1 flex-wrap">
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{item.author.name}</span>
          {item.isVerified && <CircleCheck size={12} style={{ color: 'var(--primary)' }} />}
          <span style={{ fontSize: 12, color: 'var(--text-lighter)', fontWeight: 500 }}>
            {item.author.role && `${item.author.role} \u2022 `}{item.timeAgo}
          </span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text)', marginTop: 5, lineHeight: 1.6 }}>{item.content}</div>
        {item.image && (
          <div
            className="mt-3 overflow-hidden flex justify-center"
            style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
          >
            <img src={item.image} alt="" className="max-w-full h-auto" style={{ maxHeight: 480, objectFit: 'contain' }} />
          </div>
        )}
        <div className="flex gap-[6px] mt-[10px] flex-wrap">
          {item.tags.map((tag, i) => (
            <PostTag key={i} label={tag.label} emoji={tag.emoji} />
          ))}
        </div>
        <div
          className="flex items-center gap-[18px] mt-3 pt-3"
          style={{ borderTop: '1px solid var(--divider)' }}
        >
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
            <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} /> {likes}
          </button>
          <button
            onClick={() => { setShowComments(prev => !prev); setTimeout(() => commentInputRef.current?.focus(), 50); }}
            className="flex items-center gap-[5px] text-xs font-semibold cursor-pointer transition-all px-2 py-1 rounded-lg"
            style={{ color: showComments ? 'var(--primary)' : 'var(--text-light)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'rgba(40, 114, 161,0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-light)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <MessageCircle size={14} /> {item.comments + comments.length}
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-[5px] text-xs font-semibold cursor-pointer transition-all px-2 py-1 rounded-lg"
            style={{ color: 'var(--text-light)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'rgba(40, 114, 161,0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-light)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Share2 size={14} /> Share
          </button>
          <button
            onClick={toggleSave}
            className="flex items-center gap-[5px] text-xs font-semibold cursor-pointer transition-all px-2 py-1 rounded-lg"
            style={{
              color: isSaved ? 'var(--warning)' : 'var(--text-light)',
              backgroundColor: isSaved ? 'rgba(245,158,11,0.12)' : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!isSaved) { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'rgba(40, 114, 161,0.12)'; }
            }}
            onMouseLeave={(e) => {
              if (!isSaved) { e.currentTarget.style.color = 'var(--text-light)'; e.currentTarget.style.backgroundColor = 'transparent'; }
            }}
          >
            <Bookmark size={14} fill={isSaved ? 'currentColor' : 'none'} /> {isSaved ? 'Saved' : 'Save'}
          </button>
        </div>

        {shareMsg && (
          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(40, 114, 161,0.1)', color: 'var(--primary)', fontSize: 12, fontWeight: 600 }}>
            {shareMsg}
          </div>
        )}

        {showComments && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--divider)' }}>
            {comments.map((c, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary-dark/80 flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 10 }}>Y</div>
                <div className="flex-1">
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--accent)' }}>You</div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{c}</div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary-dark/80 flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 10 }}>Y</div>
              <div className="flex-1 flex items-center gap-2" style={{ background: 'var(--divider)', borderRadius: 'var(--radius-md)', padding: '4px 4px 4px 12px', border: '1.5px solid var(--surface-border)' }}>
                <input
                  ref={commentInputRef}
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 bg-transparent outline-none"
                  style={{ fontSize: 13, color: 'var(--text)', border: 'none' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleComment(); }}
                />
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
          </div>
        )}
      </div>

      <ShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        onShare={handleShare}
      />
    </div>
  );
}
