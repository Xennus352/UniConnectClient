'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, X, Image as ImageIcon, Send } from 'lucide-react';
import { toast } from 'sonner';
import FeedPost from './FeedPost';
import { useSupabase } from '@/utils/supabase/client';
import { useLostFoundPosts } from '@/lib/supabase/hooks';

const PRESET_LOCATIONS = ['Library', 'CS Building', 'Cafeteria'];

export default function LostFoundSection() {
  const supabase = useSupabase();
  const { posts, loading, hasError, refresh } = useLostFoundPosts(supabase);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All Locations');
  const [modalOpen, setModalOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [description, setDescription] = useState('');
  const [itemStatus, setItemStatus] = useState<'lost' | 'found'>('lost');
  const [location, setLocation] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (modalOpen && !el.open) { el.showModal(); document.body.style.overflow = 'hidden'; }
    else if (!modalOpen && el.open) { el.close(); document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [modalOpen]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = () => { setModalOpen(false); document.body.style.overflow = ''; };
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, []);

  const handlePhoto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (posts ?? []).filter((p) => {
      if (statusFilter !== 'All' && (p.item_status ?? '') !== statusFilter.toLowerCase()) return false;
      if (locationFilter !== 'All Locations' && (p.item_location ?? '') !== locationFilter) return false;
      if (!q) return true;
      return (
        (p.content ?? '').toLowerCase().includes(q) ||
        (p.author_name ?? '').toLowerCase().includes(q)
      );
    });
  }, [posts, query, statusFilter, locationFilter]);

  const locations = useMemo(() => {
    const set = new Set<string>(PRESET_LOCATIONS);
    (posts ?? []).forEach((p) => { if (p.item_location) set.add(p.item_location); });
    return [...set];
  }, [posts]);

  const handleSubmit = useCallback(async () => {
    if ((!description.trim() && !photo) || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: description.trim(),
          image: photo || undefined,
          tags: [{ label: 'Lost & Found', color: 'badge-warning', emoji: '🔍' }],
          item_status: itemStatus,
          item_location: location || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to submit report' }));
        throw new Error(err.message);
      }
      setDescription('');
      setPhoto(null);
      setItemStatus('lost');
      setLocation('');
      if (dialogRef.current?.open) dialogRef.current.close();
      toast.info('Report submitted — it awaits approval before appearing on the page');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [description, photo, itemStatus, location, submitting]);

  const inputStyle = {
    padding: '9px 14px',
    borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--secondary)',
    background: 'var(--surface)',
    fontSize: 14,
    color: 'var(--text)',
    outline: 'none',
  } as const;

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Lost & Found</h1>
      <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>Report and browse lost and found items on campus</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ color: 'var(--text-light)' }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items or people..."
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: 'var(--text)', width: '100%' }}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, fontWeight: 500, cursor: 'pointer', minWidth: 140 }}>
          <option>All Status</option>
          <option>Lost</option>
          <option>Found</option>
        </select>
        <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} style={{ ...inputStyle, fontWeight: 500, cursor: 'pointer', minWidth: 140 }}>
          <option>All Locations</option>
          {locations.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <button
          onClick={() => setModalOpen(true)}
          style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(2, 132, 199,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(2, 132, 199,0.4)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(2, 132, 199,0.3)'; }}
        ><Plus size={14} /> Report Item</button>
      </div>

      <div className="max-w-[860px] mx-auto">
        {loading && (
          <div className="text-center py-12">
            <span className="loading loading-spinner loading-md" style={{ color: 'var(--primary)' }} />
            <p className="mt-2 text-sm" style={{ color: 'var(--text-lighter)' }}>Loading lost &amp; found items...</p>
          </div>
        )}
        {hasError && !loading && (
          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', padding: '24px 22px', textAlign: 'center' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--text-light)' }}>Could not load lost &amp; found items — check your connection and try again.</p>
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
            <div style={{ fontSize: 12, color: 'var(--text-lighter)' }}>
              {posts && posts.length === 0 ? 'No lost &amp; found items yet' : 'No items match your search or filters'}
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
          width: 'min(440px, calc(100vw - 32px))',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>Report a Lost &amp; Found Item</h3>
            <button onClick={() => setModalOpen(false)} className="cursor-pointer border-none" style={{ color: 'var(--text-light)', background: 'none', padding: 4 }}>
              <X size={18} />
            </button>
          </div>

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>What happened?</label>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setItemStatus('lost')}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', borderColor: itemStatus === 'lost' ? 'rgba(239, 68, 68, 0.5)' : 'var(--secondary)', background: itemStatus === 'lost' ? 'rgba(239, 68, 68, 0.1)' : 'var(--surface)', color: itemStatus === 'lost' ? '#dc2626' : 'var(--text-light)' }}
            >🔍 Lost item</button>
            <button
              onClick={() => setItemStatus('found')}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', borderColor: itemStatus === 'found' ? 'rgba(34, 197, 94, 0.5)' : 'var(--secondary)', background: itemStatus === 'found' ? 'rgba(34, 197, 94, 0.1)' : 'var(--surface)', color: itemStatus === 'found' ? '#15803d' : 'var(--text-light)' }}
            >✓ Found item</button>
          </div>

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={`Describe the item (e.g. "Black backpack with laptop charger")`}
            rows={3}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)', resize: 'vertical', outline: 'none', fontFamily: 'inherit', marginBottom: 12 }}
          />

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Where?</label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={{ width: '100%', padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)', cursor: 'pointer', marginBottom: 12 }}
          >
            <option value="">Select a location...</option>
            {locations.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer font-medium transition-all border-none"
            style={{ borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--divider)', border: '1.5px solid var(--surface-border)', fontSize: 13, color: photo ? 'var(--primary)' : 'var(--text-light)', marginBottom: 12 }}
          >
            <ImageIcon size={14} /> {photo ? 'Photo Added' : 'Add Photo'}
          </button>
          {photo && (
            <div className="relative mb-2 overflow-hidden rounded-xl">
              <img src={photo} alt="Upload preview" className="w-full object-cover" style={{ maxHeight: 220 }} />
              <button
                onClick={() => setPhoto(null)}
                className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer border-none"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--surface)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={() => setModalOpen(false)}
            style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--surface-border)', background: 'transparent', color: 'var(--text-light)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={(!description.trim() && !photo) || submitting}
            className="flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <Send size={14} /> {submitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </dialog>
    </div>
  );
}
