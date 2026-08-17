'use client';

import { useEffect, useMemo, useState } from 'react';
import { Users, Search, Download, X, Loader2 } from 'lucide-react';
import { useSupabase } from '@/utils/supabase/client';
import { useUniversityRaw, initialsOf } from './useUniversityPeople';
import type { StudentRecord } from './api';
import type { Database } from '@/utils/supabase/types';

type EventRow = Database['public']['Tables']['events']['Row'];
type RegistrationRow = Database['public']['Tables']['event_registrations']['Row'];

interface RosterEntry {
  id: string;
  user_email: string;
  user_name: string;
  created_at: number;
}

const formatDate = (ts: number) =>
  new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

export default function EventRosterModal({ event, onClose }: { event: EventRow; onClose: () => void }) {
  const supabase = useSupabase();
  const { students } = useUniversityRaw();
  const [entries, setEntries] = useState<RosterEntry[] | null>(null);
  const [search, setSearch] = useState('');

  const studentsByEmail = useMemo(() => {
    const map = new Map<string, StudentRecord>();
    for (const s of students) map.set(s.email.toLowerCase(), s);
    return map;
  }, [students]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from('event_registrations')
        .select('id, user_email, user_name, created_at')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Roster fetch error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          raw: error,
        });
        if (!cancelled) setEntries([]);
        return;
      }
      if (!cancelled) setEntries((data ?? []) as RosterEntry[]);
    };
    void load();

    const channel = supabase
      .channel(`event-roster:${event.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_registrations', filter: `event_id=eq.${event.id}` },
        (payload) => {
          setEntries((prev) => {
            if (!prev) return prev;
            if (payload.eventType === 'INSERT') {
              const row = payload.new as Partial<RegistrationRow>;
              if (!row.id || prev.some((e) => e.id === row.id)) return prev;
              return [
                { id: row.id, user_email: row.user_email ?? '', user_name: row.user_name ?? '', created_at: row.created_at ?? Date.now() },
                ...prev,
              ];
            }
            if (payload.eventType === 'DELETE') {
              const old = payload.old as Partial<RegistrationRow>;
              return prev.filter((e) => e.id !== old.id);
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as Partial<RegistrationRow>;
              return prev.map((e) =>
                e.id === row.id
                  ? {
                      ...e,
                      user_email: row.user_email ?? e.user_email,
                      user_name: row.user_name ?? e.user_name,
                      created_at: row.created_at ?? e.created_at,
                    }
                  : e
              );
            }
            return prev;
          });
        }
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [supabase, event.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = entries ?? [];
    if (!q) return list;
    return list.filter((e) => {
      const student = studentsByEmail.get(e.user_email.toLowerCase());
      const hay = [e.user_name, e.user_email, student?.studentName ?? '', student?.rollNo ?? '']
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [entries, search, studentsByEmail]);

  const exportCsv = () => {
    if (!entries || entries.length === 0) return;
    const header = ['Name', 'Email', 'Roll Number', 'Department / Section', 'Semester', 'Registered At'];
    const rows = entries.map((e) => {
      const s = studentsByEmail.get(e.user_email.toLowerCase());
      return [
        e.user_name,
        e.user_email,
        s?.rollNo ?? '',
        s ? `${s.majorCode} • ${s.sectionName}` : '',
        s ? `Semester ${s.semesterNo}` : '',
        formatDate(e.created_at),
      ];
    });
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.replace(/[^a-z0-9]+/gi, '_')}_registrants.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <dialog
      id="event_roster_modal"
      className="modal modal-open z-[999]"
      open
      onCancel={(e) => { e.preventDefault(); onClose(); }}
    >
      <div className="modal-box w-[94vw] max-w-3xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)', padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)', gap: 12, flexWrap: 'wrap' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: '#fff' }}>
              <Users size={16} />
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold" style={{ color: 'var(--accent)', fontSize: 15 }}>{event.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{formatDate(event.event_date)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-primary badge-sm">{entries?.length ?? 0} Registrant{entries?.length === 1 ? '' : 's'}</span>
            <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm" title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid var(--surface)', flexWrap: 'wrap' }}>
          <div className="flex items-center gap-2" style={{ flex: '1 1 240px', minWidth: 200 }}>
            <Search size={15} style={{ color: 'var(--text-lighter)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or roll no..."
              className="input input-sm"
              style={{ width: '100%', fontSize: 12.5, background: 'var(--secondary-lighter)', borderColor: 'var(--secondary)' }}
            />
          </div>
          <button
            onClick={exportCsv}
            disabled={!entries || entries.length === 0}
            className="btn btn-sm gap-1.5 border-none text-white"
            style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', opacity: !entries || entries.length === 0 ? 0.5 : 1 }}
          >
            <Download size={13} /> Export CSV
          </button>
        </div>

        {entries === null && (
          <div className="flex flex-col items-center justify-center py-12" style={{ color: 'var(--text-lighter)' }}>
            <Loader2 size={20} className="animate-spin mb-2" />
            <span className="text-sm">Loading registrants...</span>
          </div>
        )}

        {entries !== null && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <Users size={30} style={{ color: 'var(--text-lighter)', opacity: 0.5, marginBottom: 10 }} />
            <p className="text-sm" style={{ color: 'var(--text-lighter)' }}>No students have registered for this event yet.</p>
          </div>
        )}

        {entries !== null && entries.length > 0 && (
          <>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <p className="text-sm" style={{ color: 'var(--text-lighter)' }}>No registrants match your search.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      {['Student', 'Email', 'Roll No', 'Department / Semester', 'Registered At'].map((h) => (
                        <th key={h} style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-light)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e) => {
                      const student = studentsByEmail.get(e.user_email.toLowerCase());
                      const name = student?.studentName || e.user_name;
                      return (
                        <tr key={e.id}>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 11 }}>
                                {initialsOf(name)}
                              </span>
                              <span className="font-semibold truncate" style={{ color: 'var(--accent)', maxWidth: 180 }}>{name}</span>
                            </div>
                          </td>
                          <td><span className="truncate" style={{ maxWidth: 200, fontSize: 12.5 }}>{e.user_email}</span></td>
                          <td>
                            {student?.rollNo ? (
                              <code style={{ background: 'var(--divider-soft)', padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600 }}>{student.rollNo}</code>
                            ) : (
                              <span style={{ color: 'var(--text-lighter)', fontSize: 12 }}>—</span>
                            )}
                          </td>
                          <td>
                            {student ? (
                              <span className="block truncate" style={{ maxWidth: 180, fontSize: 12.5 }}>{student.majorCode} • Semester {student.semesterNo}</span>
                            ) : (
                              <span style={{ color: 'var(--text-lighter)', fontSize: 12 }}>—</span>
                            )}
                          </td>
                          <td style={{ fontSize: 12.5, color: 'var(--text-light)', whiteSpace: 'nowrap' }}>{formatDate(e.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}