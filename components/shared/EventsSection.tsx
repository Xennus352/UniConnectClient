'use client';

import { useMemo, useState } from 'react';
import { CalendarCheck, MapPin, Users, Plus, X, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabase } from '@/utils/supabase/client';
import { useEvents, useEventRegistrations } from '@/lib/supabase/hooks';
import { useSession } from './session';
import EventRosterModal from './EventRosterModal';
import EventDetailsModal from './EventDetailsModal';
import type { Database } from '@/utils/supabase/types';

type EventRow = Database['public']['Tables']['events']['Row'];

const CATEGORY_STYLE: Record<string, { bg: string; color: string }> = {
  Sports: { bg: 'rgba(52,211,153,0.15)', color: '#16a34a' },
  Academic: { bg: 'rgba(35,96,138,0.12)', color: '#23608a' },
  Cultural: { bg: 'rgba(217,70,239,0.14)', color: '#c026d3' },
  Other: { bg: 'rgba(107,114,128,0.15)', color: '#6b7280' },
};

const CATEGORIES = ['All Events', 'Sports', 'Academic', 'Cultural', 'My Registrations'];

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function EventsSection() {
  const supabase = useSupabase();
  const { user: session } = useSession();
  const me = session?.email ?? '';
  const role = session?.role ?? '';
  const canCreate = role === 'admin' || role === 'student-affair';

  const { events, loading, hasError, refresh } = useEvents(supabase, role);
  const eventIds = useMemo(() => (events ?? []).map((e) => e.id), [events]);
  const { registrations } = useEventRegistrations(supabase, eventIds, me);

  const [filter, setFilter] = useState('All Events');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', location: '', category: 'Other', date: '', maxAttendees: '' });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [rosterEvent, setRosterEvent] = useState<EventRow | null>(null);
  const [detailEvent, setDetailEvent] = useState<EventRow | null>(null);

  const filtered = useMemo(() => {
    const list = events ?? [];
    if (filter === 'My Registrations') {
      return list.filter((e) => registrations?.[e.id]?.registered);
    }
    if (filter === 'All Events') return list;
    return list.filter((e) => e.category === filter);
  }, [events, filter, registrations]);

  const acceptImage = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be 5MB or smaller'); return; }
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    acceptImage(file);
  };

  const handleImageDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    acceptImage(e.dataTransfer.files?.[0] ?? null);
  };

  const resetForm = () => {
    setForm({ title: '', description: '', location: '', category: 'Other', date: '', maxAttendees: '' });
    setSelectedImage(null);
    setImagePreview(null);
    setIsPrivate(false);
  };

  const handleCreate = async () => {
    const title = form.title.trim();
    const dateMs = form.date ? new Date(form.date).getTime() : NaN;
    if (!title) { toast.error('Event title is required'); return; }
    if (!Number.isFinite(dateMs)) { toast.error('Please choose an event date'); return; }
    setSaving(true);
    let uploadedPath: string | null = null;
    try {
      let imageUrl: string | null = null;
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('event-images')
          .upload(fileName, selectedImage);
        if (uploadError) throw new Error(uploadError.message || 'Could not upload cover image');
        uploadedPath = fileName;
        const { data: urlData } = supabase.storage.from('event-images').getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: form.description.trim() || undefined,
          location: form.location.trim() || undefined,
          category: form.category,
          eventDate: dateMs,
          maxAttendees: form.maxAttendees.trim() ? Number(form.maxAttendees) : undefined,
          imageUrl,
          visibility: isPrivate ? 'private' : 'public',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not create event');
      toast.success('Event created and students notified');
      setCreating(false);
      resetForm();
    } catch (err) {
      if (uploadedPath) {
        await supabase.storage.from('event-images').remove([uploadedPath]).catch(() => null);
      }
      toast.error(err instanceof Error ? err.message : 'Could not create event');
    } finally {
      setSaving(false);
    }
  };

  const handleRegister = async (id: string) => {
    try {
      const res = await fetch(`/api/events/${id}/register`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not register');
      toast.success('Registered for event');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not register');
    }
  };

  const handleUnregister = async (id: string) => {
    try {
      const res = await fetch(`/api/events/${id}/register`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not cancel registration');
      toast.success('Registration cancelled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not cancel registration');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete event');
      toast.success('Event deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete event');
    }
  };

  const handleToggleVisibility = async (id: string, next: 'public' | 'private') => {
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not update visibility');
      toast.success(next === 'private' ? 'Event is now private — hidden from students' : 'Event is now public — visible to everyone');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update visibility');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Events</h1>
          <p style={{ fontSize: 14, color: 'var(--text-light)' }}>University events and academic calendar</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setCreating(true)}
            style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(35, 96, 138,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} /> Create Event
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {CATEGORIES.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ background: filter === f ? 'linear-gradient(var(--primary), var(--primary-dark))' : 'var(--secondary-light)', color: filter === f ? '#fff' : 'var(--primary)', borderRadius: 'var(--radius-sm)', padding: '6px 14px', fontSize: 12, fontWeight: 600, border: filter === f ? 'none' : '1.5px solid var(--secondary)', cursor: 'pointer' }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', padding: 40, textAlign: 'center' }}>
          <span className="loading loading-spinner loading-md" style={{ color: 'var(--primary)' }} />
          <p style={{ color: 'var(--text-lighter)', fontSize: 14, marginTop: 10 }}>Loading events...</p>
        </div>
      )}

      {!loading && hasError && (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', padding: 40, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-light)', fontSize: 14, marginBottom: 14 }}>Could not load events — check your connection and try again.</p>
          <button
            onClick={refresh}
            className="btn btn-sm text-white border-none"
            style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !hasError && (!events || events.length === 0) && (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', padding: 40, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>
          No events yet{canCreate ? ' — create the first one' : ''}
        </div>
      )}

      {!loading && events && events.length > 0 && filtered.length === 0 && (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', padding: 40, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>
          No events match this filter
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((e) => {
            const style = CATEGORY_STYLE[e.category] ?? CATEGORY_STYLE.Other;
            const reg = registrations?.[e.id];
            const full = !!e.max_attendees && (reg?.count ?? 0) >= e.max_attendees;
            const canDelete = canCreate || e.created_by === me;
            return (
              <div key={e.id} className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                <figure
                  onClick={() => e.image_url && setDetailEvent(e)}
                  className="w-full overflow-hidden flex items-center justify-center"
                  style={{
                    borderBottom: '1px solid var(--surface)',
                    background: e.image_url ? 'var(--divider)' : 'linear-gradient(135deg, var(--secondary-light), var(--secondary-lighter))',
                    height: 150,
                    position: 'relative',
                    cursor: e.image_url ? 'pointer' : 'default',
                  }}
                >
                  {e.image_url ? (
                    <>
                      <img src={e.image_url} alt={`${e.title} cover`} className="w-full h-full object-cover" />
                      <span
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ background: 'rgba(2,6,23,0.45)', opacity: 0, transition: 'opacity 0.2s', color: '#fff', fontSize: 12.5, fontWeight: 700, letterSpacing: '0.3px', gap: 6 }}
                        onMouseEnter={(ev) => { ev.currentTarget.style.opacity = '1'; }}
                        onMouseLeave={(ev) => { ev.currentTarget.style.opacity = '0'; }}
                      >
                        View Details
                      </span>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--text-lighter)' }}>
                      <ImageIcon size={24} />
                      <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.3px' }}>NO COVER IMAGE</span>
                    </div>
                  )}
                </figure>
                <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--surface)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', background: style.bg, color: style.color }}>
                      {e.category}
                    </span>
                    {e.visibility === 'private' && (
                      <span className="badge badge-sm gap-1" style={{ background: 'rgba(251,191,36,0.14)', color: '#b45309', border: 'none', fontSize: 11, fontWeight: 700 }}>
                        🔒 Private
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {canCreate && (
                      <button
                        onClick={() => handleToggleVisibility(e.id, e.visibility === 'private' ? 'public' : 'private')}
                        title={e.visibility === 'private' ? 'Make this event public' : 'Make this event private (hidden from students)'}
                        className="btn btn-sm btn-ghost gap-1.5"
                        style={{
                          fontSize: 12,
                          color: e.visibility === 'private' ? '#b45309' : 'var(--primary)',
                          background: e.visibility === 'private' ? 'rgba(251,191,36,0.14)' : 'transparent',
                        }}
                        onMouseEnter={(ev) => { if (e.visibility !== 'private') ev.currentTarget.style.backgroundColor = 'rgba(40, 114, 161,0.12)'; }}
                        onMouseLeave={(ev) => { if (e.visibility !== 'private') ev.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        {e.visibility === 'private' ? '🔒 Make Public' : '🌐 Make Private'}
                      </button>
                    )}
                    <button
                      onClick={() => setRosterEvent(e)}
                      title="View registrants"
                      className="btn btn-sm btn-ghost gap-1.5"
                      style={{ fontSize: 12, color: 'var(--primary)' }}
                    >
                      👥 {reg?.count ?? 0} Registered
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(e.id)}
                        title="Delete event"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-lighter)', padding: 4, display: 'flex', alignItems: 'center' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ padding: '6px 22px 18px' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', margin: '12px 0 8px' }}>{e.title}</h3>
                  {e.description && <p style={{ fontSize: 13, color: 'var(--text-light)', margin: '0 0 12px', lineHeight: 1.5 }}>{e.description}</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-light)' }}>
                      <CalendarCheck size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} /> {formatDate(e.event_date)}
                    </div>
                    {e.location && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-light)' }}>
                        <MapPin size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} /> {e.location}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text-lighter)' }}>By {e.created_by_name}</span>
                    {reg?.registered ? (
                      <button
                        onClick={() => handleUnregister(e.id)}
                        style={{ background: 'var(--secondary-light)', color: 'var(--primary)', border: '1.5px solid var(--secondary)', borderRadius: 'var(--radius-sm)', padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <X size={13} /> Cancel Registration
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRegister(e.id)}
                        disabled={full}
                        style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '7px 16px', fontSize: 12, fontWeight: 600, border: 'none', cursor: full ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(35, 96, 138,0.3)', display: 'flex', alignItems: 'center', gap: 6, opacity: full ? 0.6 : 1 }}
                      >
                        <Users size={13} /> {full ? 'Event Full' : 'Register'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="bg-base-100" style={{ width: '100%', maxWidth: 520, borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarCheck size={16} /> Create Event
              </div>
              <button onClick={() => { setCreating(false); resetForm(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-lighter)' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Freshers Week"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="What is this event about?"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Location</label>
                  <input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="e.g. Main Hall"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }}
                  >
                    {['Sports', 'Academic', 'Cultural', 'Other'].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Max Attendees</label>
                  <input
                    type="number"
                    min={1}
                    value={form.maxAttendees}
                    onChange={(e) => setForm({ ...form, maxAttendees: e.target.value })}
                    placeholder="Unlimited"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }}
                  />
                </div>
              </div>
              <div className="form-control w-full" style={{ marginBottom: 14 }}>
                <label className="label" style={{ padding: 0, marginBottom: 6 }}>
                  <span className="label-text" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Event Cover Image (Optional)</span>
                </label>
                <input
                  type="file"
                  id="event-cover-input"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <label
                  htmlFor="event-cover-input"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleImageDrop}
                  className="flex flex-col items-center justify-center w-full cursor-pointer gap-1.5"
                  style={{ border: '1.5px dashed var(--secondary)', background: 'var(--secondary-lighter)', borderRadius: 'var(--radius-sm)', padding: '18px 14px', textAlign: 'center', transition: 'border-color 0.2s, background 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'rgba(35,96,138,0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--secondary)'; e.currentTarget.style.background = 'var(--secondary-lighter)'; }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--accent)' }}>
                    <ImageIcon size={16} /> Click to upload cover image
                  </span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-lighter)' }}>PNG, JPG or WebP up to 5MB — or drag &amp; drop here</span>
                </label>
                {imagePreview && (
                  <div className="relative mt-3" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--surface-border)' }}>
                    <img src={imagePreview} alt="Cover preview" className="w-full object-cover" style={{ maxHeight: 140 }} />
                    <button
                      onClick={() => { setSelectedImage(null); setImagePreview(null); }}
                      title="Remove image"
                      className="btn btn-ghost btn-circle btn-xs absolute top-2 right-2 bg-base-100"
                      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>
              <div className="form-control" style={{ marginBottom: 18 }}>
                <label className="label cursor-pointer justify-start gap-4" style={{ padding: 0 }}>
                  <span className="label-text font-semibold" style={{ fontSize: 13, color: 'var(--accent)' }}>Make Event Private (Admins/Staff Only)</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                  />
                </label>
                <span style={{ fontSize: 11.5, color: 'var(--text-lighter)', marginTop: 2 }}>
                  Private events are hidden from students and only visible to admins &amp; staff.
                </span>
              </div>
              <button
                onClick={handleCreate}
                disabled={saving}
                style={{ width: '100%', background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '10px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(35, 96, 138,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Plus size={14} /> {saving ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rosterEvent && (
        <EventRosterModal event={rosterEvent} onClose={() => setRosterEvent(null)} />
      )}

      {detailEvent && (
        <EventDetailsModal
          event={detailEvent}
          regCount={registrations?.[detailEvent.id]?.count ?? 0}
          onClose={() => setDetailEvent(null)}
        />
      )}
    </div>
  );
}
