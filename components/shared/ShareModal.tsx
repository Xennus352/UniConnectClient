'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Search, Send } from 'lucide-react';
import { useUniversityPeople, type UniversityPerson } from './useUniversityPeople';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  onShare: (selected: UniversityPerson[]) => void;
}

export default function ShareModal({ open, onClose, onShare }: ShareModalProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UniversityPerson[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { people: allUsers, loading: loadingUsers, error: usersError, refresh: refreshUsers } = useUniversityPeople();

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) { el.showModal(); document.body.style.overflow = 'hidden'; }
    else if (!open && el.open) { el.close(); document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = () => { onClose(); setSelected([]); setSearch(''); document.body.style.overflow = ''; };
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, [onClose]);

  const users = allUsers ?? [];
  const query = search.trim().toLowerCase();
  const filtered = users.filter(u =>
    !query ||
    u.name.toLowerCase().includes(query) ||
    u.email.toLowerCase().includes(query)
  );

  const isSelected = useCallback((email: string) => selected.some((s) => s.email === email), [selected]);

  const toggleUser = useCallback((user: UniversityPerson) => {
    setSelected(prev =>
      isSelected(user.email) ? prev.filter((p) => p.email !== user.email) : [...prev, user]
    );
  }, [isSelected]);

  const handleShare = useCallback(() => {
    if (selected.length === 0) return;
    onShare(selected);
    setSelected([]);
    setSearch('');
    onClose();
  }, [selected, onShare, onClose]);

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
        width: 'min(420px, calc(100vw - 32px))',
        maxHeight: 'min(520px, calc(100vh - 64px))',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>Share with</h3>
          <button onClick={onClose} className="cursor-pointer border-none" style={{ color: 'var(--text-light)', background: 'none', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2 px-3 py-2" style={{ borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--surface-border)', background: 'var(--surface-soft)' }}>
          <Search size={14} style={{ color: 'var(--text-lighter)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="bg-transparent outline-none w-full"
            style={{ fontSize: 13, color: 'var(--text)', border: 'none' }}
          />
        </div>
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto', padding: '8px 0' }}>
        {loadingUsers && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-lighter)' }}>Loading people...</div>
        )}
        {!loadingUsers && usersError && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-lighter)' }}>
            <div style={{ marginBottom: 10 }}>Couldn&apos;t load people. Please try again.</div>
            <button
              onClick={refreshUsers}
              className="cursor-pointer"
              style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--surface-border)', background: 'transparent', color: 'var(--primary)', fontSize: 12, fontWeight: 600 }}
            >
              Retry
            </button>
          </div>
        )}
        {!loadingUsers && !usersError && filtered.map((u) => {
          const active = isSelected(u.email);
          return (
            <button
              key={u.email}
              onClick={() => toggleUser(u)}
              className="flex items-center gap-3 w-full cursor-pointer border-none text-left"
              style={{
                padding: '10px 24px',
                background: active ? 'rgba(40, 114, 161,0.1)' : 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--surface-soft)'; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold shrink-0 bg-gradient-to-br ${u.role.toLowerCase() === 'student' ? 'from-info to-info/70' : u.role.toLowerCase() === 'staff' ? 'from-success to-success/70' : 'from-primary to-secondary'}`}
                style={{ fontSize: 12 }}
              >
                {u.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{u.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-lighter)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
              </div>
              <div
                className="w-5 h-5 rounded flex items-center justify-center transition-all"
                style={{
                  border: '2px solid',
                  borderColor: active ? 'var(--primary)' : 'var(--surface-hover)',
                  background: active ? 'var(--primary)' : 'transparent',
                }}
              >
                {active && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>}
              </div>
            </button>
          );
        })}
        {!loadingUsers && !usersError && filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-lighter)' }}>No users found</div>
        )}
      </div>
      <div style={{ padding: '14px 24px', borderTop: '1px solid var(--surface)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1.5px solid var(--surface-border)',
            background: 'transparent',
            color: 'var(--text-light)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleShare}
          disabled={selected.length === 0}
          className="flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'linear-gradient(var(--primary), var(--primary-dark))',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Send size={14} /> Share {selected.length > 0 && `(${selected.length})`}
        </button>
      </div>
    </dialog>
  );
}
