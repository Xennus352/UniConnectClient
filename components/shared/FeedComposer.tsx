'use client';

import { useState, useRef, useCallback } from 'react';
import { Image, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from './session';

const TAG_OPTIONS = [
  { label: 'Academic', color: 'badge-secondary', emoji: '🎓' },
  { label: 'Official', color: 'badge-info', emoji: '📢' },
  { label: 'Event', color: 'badge-success', emoji: '🎉' },
  { label: 'Finance', color: 'badge-warning', emoji: '💰' },
  { label: 'General', color: 'badge-ghost', emoji: '💬' },
];

interface FeedComposerProps {
  avatarInitials?: string;
}

export default function FeedComposer({ avatarInitials }: FeedComposerProps) {
  const { user: session } = useSession();
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  }, []);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const removeImage = useCallback(() => {
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTag((prev) => (prev === tag ? null : tag));
  }, []);

  const handlePost = useCallback(async () => {
    if ((!text.trim() && !image) || submitting) return;
    if (!session) {
      toast.error('Please sign in to post');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text.trim(),
          image: image || undefined,
          tags: selectedTag ? TAG_OPTIONS.filter((t) => t.label === selectedTag) : [],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to submit post' }));
        throw new Error(err.message);
      }
      setText('');
      setImage(null);
      setSelectedTag(null);
      const ta = textareaRef.current;
      if (ta) ta.style.height = 'auto';
      toast.info('Post submitted — the AI content filter is reviewing it');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [text, image, selectedTag, session, submitting]);


  return (
    <div className="p-[18px] mb-[18px] bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--surface-strong)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold"
          style={{
            background: 'linear-gradient(to bottom right, #CBDDE9, #a8cce0)',
            color: '#2872A1',
            fontSize: 14,
          }}
        >
          {avatarInitials || 'U'}
        </div>
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            placeholder="Share your thoughts with the university..."
            rows={1}
            className="w-full outline-none resize-none p-3 px-4"
            style={{
              border: 'none',
              backgroundColor: 'var(--divider)',
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
              minHeight: 48,
              color: 'var(--text)',
              fontFamily: 'inherit',
              lineHeight: 1.5,
            }}
          />

          {image && (
            <div className="relative mt-3 overflow-hidden rounded-xl">
              <img src={image} alt="Upload preview" className="w-full object-cover" style={{ maxHeight: 260 }} />
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer border-none"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="mt-2.5 flex gap-1.5 flex-wrap">
            {TAG_OPTIONS.map((tag) => {
              const active = selectedTag === tag.label;
              return (
                <button
                  key={tag.label}
                  onClick={() => toggleTag(tag.label)}
                  className="px-2.5 py-1 text-xs font-medium rounded-full cursor-pointer transition-all border-none"
                  style={{
                    backgroundColor: active ? 'rgba(58,139,194,0.15)' : 'var(--divider)',
                    color: active ? 'var(--primary)' : 'var(--text-light)',
                  }}
                >
                  {tag.emoji} {tag.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--surface)' }}>
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer font-medium transition-all border-none"
                style={{
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--divider)',
                  border: '1.5px solid var(--surface-border)',
                  fontSize: 13,
                  color: image ? 'var(--primary)' : 'var(--text-light)',
                }}
              >
                <Image size={14} /> {image ? 'Photo Added' : 'Add Photo'}
              </button>
            </div>
            <button
              onClick={handlePost}
              disabled={(!text.trim() && !image) || submitting}
              className="flex items-center gap-1.5 px-4 py-1.5 cursor-pointer font-semibold border-none disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                borderRadius: 'var(--radius-sm)',
                background: 'linear-gradient(var(--primary), var(--primary-dark))',
                color: '#fff',
                fontSize: 13,
                boxShadow: '0 2px 8px rgba(58,139,194,0.25)',
              }}
            >
              <Send size={14} /> {submitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}