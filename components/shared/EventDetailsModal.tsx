'use client';

import { X, CalendarCheck, MapPin, Users, User } from 'lucide-react';
import type { Database } from '@/utils/supabase/types';

type EventRow = Database['public']['Tables']['events']['Row'];

const CATEGORY_STYLE: Record<string, { bg: string; color: string }> = {
  Sports: { bg: 'rgba(52,211,153,0.15)', color: '#16a34a' },
  Academic: { bg: 'rgba(2,132,199,0.12)', color: '#0284c7' },
  Cultural: { bg: 'rgba(217,70,239,0.14)', color: '#c026d3' },
  Other: { bg: 'rgba(107,114,128,0.15)', color: '#6b7280' },
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function EventDetailsModal({
  event,
  regCount,
  onClose,
}: {
  event: EventRow;
  regCount: number;
  onClose: () => void;
}) {
  const style = CATEGORY_STYLE[event.category] ?? CATEGORY_STYLE.Other;

  return (
    <dialog
      id="event_details_modal"
      className="modal modal-open z-[999]"
      open
      onCancel={(e) => { e.preventDefault(); onClose(); }}
    >
      <div className="modal-box w-[94vw] max-w-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)', padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)', gap: 12, flexWrap: 'wrap' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: style.bg, color: style.color, fontSize: 11, fontWeight: 800 }}>
              {event.category.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold" style={{ color: 'var(--accent)', fontSize: 15 }}>{event.title}</div>
              <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: 'var(--text-light)' }}>
                {event.visibility === 'private' && <span className="badge badge-sm gap-1" style={{ background: 'rgba(251,191,36,0.14)', color: '#b45309', border: 'none', fontSize: 10, fontWeight: 700 }}>🔒 Private</span>}
                <span>{formatDate(event.event_date)}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm" title="Close">
            <X size={16} />
          </button>
        </div>

        {event.image_url && (
          <figure className="w-full overflow-hidden flex items-center justify-center" style={{ background: 'var(--divider)', borderBottom: '1px solid var(--surface)' }}>
            <img src={event.image_url} alt={`${event.title} cover`} className="w-full object-contain" style={{ maxHeight: 320, background: '#0b1220' }} />
          </figure>
        )}

        <div style={{ padding: '18px 20px' }}>
          {event.description && (
            <p style={{ fontSize: 13.5, color: 'var(--text-light)', lineHeight: 1.6, margin: '0 0 16px' }}>{event.description}</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-light)' }}>
              <CalendarCheck size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} /> {formatDate(event.event_date)}
            </div>
            {event.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-light)' }}>
                <MapPin size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} /> {event.location}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-light)' }}>
              <Users size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              {regCount} Registered{event.max_attendees ? ` / ${event.max_attendees} max` : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-light)' }}>
              <User size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} /> Organized by {event.created_by_name}
            </div>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}