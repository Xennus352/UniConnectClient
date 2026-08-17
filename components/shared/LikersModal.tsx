'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Heart, UserRound } from 'lucide-react';
import { useSupabase } from '@/utils/supabase/client';
import { useUniversityPeople } from './useUniversityPeople';

interface LikersModalProps {
  open: boolean;
  onClose: () => void;
  postId: string;
  me: string;
}

interface LikerRow {
  user_email: string;
  created_at: number;
}

export default function LikersModal({ open, onClose, postId, me }: LikersModalProps) {
  const supabase = useSupabase();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [likers, setLikers] = useState<LikerRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const { people, loading: peopleLoading } = useUniversityPeople();

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('post_likes')
      .select('user_email, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setLikers((data ?? []) as LikerRow[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [supabase, postId]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      document.body.style.overflow = 'hidden';
    } else if (!open && el.open) {
      el.close();
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = () => { document.body.style.overflow = ''; onClose(); };
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, [onClose]);

  const personOf = (email: string) => people?.find((p) => p.email.toLowerCase() === email.toLowerCase());

  return (
    <>
      <style>{`
        dialog.likers-modal::backdrop {
          background: rgba(4, 10, 16, 0.55);
          animation: lm-fade 0.2s ease-out;
        }
        dialog.likers-modal[open] {
          animation: lm-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes lm-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes lm-pop {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
      <dialog
        ref={dialogRef}
        className="likers-modal"
        onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
        style={{
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--modal-bg)',
          color: 'var(--text)',
          padding: 0,
          margin: 'auto',
          width: 'min(380px, calc(100vw - 32px))',
          maxHeight: 'min(480px, calc(100vh - 64px))',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2" style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>
              <Heart size={15} fill="currentColor" />
              Likes
              {likers !== null && (
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-lighter)' }}>
                  {likers.length}
                </span>
              )}
            </h3>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              aria-label="Close"
              className="cursor-pointer border-none flex items-center justify-center transition-transform duration-200 hover:scale-110 hover:rotate-90"
              style={{ color: 'var(--text-light)', background: 'none', padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', maxHeight: 'min(400px, calc(100vh - 150px))', padding: '8px 12px' }}>
          {loading || peopleLoading ? (
            <div className="flex flex-col gap-2 p-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg p-2 animate-pulse" style={{ background: 'var(--divider)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--divider-soft)' }} />
                  <div style={{ flex: 1, height: 10, borderRadius: 999, background: 'var(--divider-soft)' }} />
                </div>
              ))}
            </div>
          ) : likers === null || likers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8" style={{ color: 'var(--text-lighter)', fontSize: 12.5 }}>
              <UserRound size={22} />
              <span>No likes yet</span>
            </div>
          ) : (
            <div className="flex flex-col">
              {likers.map((l) => {
                const person = personOf(l.user_email);
                const name = person?.name ?? l.user_email.split('@')[0] ?? l.user_email;
                const initials = person?.initials ?? l.user_email.slice(0, 2).toUpperCase();
                const isMe = l.user_email.toLowerCase() === me.toLowerCase();
                return (
                  <div key={l.user_email} className="flex items-center gap-3 rounded-lg p-2 transition-colors" style={{}}>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold"
                      style={{
                        background: 'linear-gradient(to bottom right, var(--primary), var(--primary-dark))',
                        color: '#ffffff',
                        fontSize: 11,
                      }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        <span className="truncate">{name}</span>
                        {isMe && (
                          <span className="badge badge-xs" style={{ background: 'rgba(40, 114, 161,0.12)', color: 'var(--primary)', fontWeight: 600 }}>
                            You
                          </span>
                        )}
                      </div>
                      <div className="truncate" style={{ fontSize: 11, color: 'var(--text-lighter)' }}>{l.user_email}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}