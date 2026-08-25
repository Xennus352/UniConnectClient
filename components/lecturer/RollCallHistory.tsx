'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { History, CalendarCheck, Users, Layers, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getRollCallMySchedule,
  getRollCallHistory,
  updateAttendance,
  deleteRollCallSession,
  type RollCallSchedule,
  type RollCallHistoryResponse,
  type RollCallHistoryCell,
} from '@/components/shared/api';

function monthBounds(ym: string): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function RollCallHistorySection({ seedScheduleId, seedMonth }: {
  /** Preselected context when opened via in-page tabs (post-submit deep link). */
  seedScheduleId?: string;
  seedMonth?: string;
} = {}) {
  // Context resolution: explicit tab seeds win over URL deep links
  // (?scheduleId=..&month=YYYY-MM), both resolved lazily on first render.
  const initial = useMemo(() => {
    if (seedScheduleId) return { sid: seedScheduleId, mon: seedMonth || '' };
    if (typeof window === 'undefined') return { sid: '', mon: '' };
    const sp = new URLSearchParams(window.location.search);
    const mon = sp.get('month');
    return {
      sid: sp.get('scheduleId') ?? '',
      mon: mon && /^\d{4}-\d{2}$/.test(mon) ? mon : '',
    };
  }, [seedScheduleId, seedMonth]);
  const [schedules, setSchedules] = useState<RollCallSchedule[] | null>(null);
  const [scheduleId, setScheduleId] = useState(initial.sid);
  const [selCourse, setSelCourse] = useState('');
  const [selSem, setSelSem] = useState('');
  const [selSection, setSelSection] = useState('');
  const [month, setMonth] = useState(() => initial.mon || new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<RollCallHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ cell: RollCallHistoryCell; student: string; date: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ sessionId: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDeleteSession = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteRollCallSession(pendingDelete.sessionId);
      toast.success('Roll Call deleted successfully.');
      setPendingDelete(null);
      load(effCourse, parseInt(effSem) || 0, effSection, month);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    let alive = true;
    getRollCallMySchedule()
      .then((list) => { if (alive) setSchedules(list); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Failed to load schedule'); });
    return () => { alive = false; };
  }, []);

  // ---- Course / Semester / Section cascade (built ONLY from the lecturer's
  // own authorized published schedules; resolving back to the schedule id is
  // what the authorized backend endpoint consumes) ----
  const courses = useMemo(
    () => [...new Set((schedules ?? []).map((s) => s.courseCode))].sort(),
    [schedules]);
  // Sanitized selections derive from raw picks so shrinking option sets can
  // never leave an invalid combination — no setState-in-effect needed.
  const effCourse = courses.includes(selCourse) ? selCourse : (courses[0] ?? '');
  const semesters = useMemo(
    () => [...new Set((schedules ?? [])
      .filter((s) => !effCourse || s.courseCode === effCourse)
      .map((s) => String(s.semesterNo ?? '?')))].sort(),
    [schedules, effCourse]);
  const effSem = semesters.includes(selSem) ? selSem : (semesters[0] ?? '');
  const sectionOptions = useMemo(() => {
    const names = new Map<string, string>(); // name -> composite schedule key
    for (const s of (schedules ?? [])) {
      if (effCourse && s.courseCode !== effCourse) continue;
      if (effSem && String(s.semesterNo ?? '?') !== effSem) continue;
      for (const n of s.sectionNames) {
        if (!names.has(n)) names.set(n, s.scheduleId);
        else if (names.get(n) !== s.scheduleId) names.set(n, 'COMBINED');
      }
    }
    return [...names.entries()].map(([name]) => ({ name }));
  }, [schedules, effCourse, effSem]);
  const effSection = sectionOptions.some((o) => o.name === selSection)
    ? selSection
    : (sectionOptions[0]?.name ?? '');

  // The cascade (Course → Semester → Section) identifies the logical cohort.
  // The backend resolves ALL matching published schedules internally.
  const resolvedScheduleId = useMemo(() => {
    if (initial.sid && !schedules) return initial.sid;
    const match = (schedules ?? []).find((s) =>
      (!effCourse || s.courseCode === effCourse) &&
      (!effSem || String(s.semesterNo ?? '?') === effSem) &&
      (!effSection || s.sectionNames.includes(effSection)));
    return match?.scheduleId ?? scheduleId;
  }, [schedules, effCourse, effSem, effSection, initial.sid, scheduleId]);

  const load = useCallback(async (cc: string, sem: number, sec: string, ym: string) => {
    if (!cc || !ym) return;
    setLoading(true); setError(null);
    try {
      const { from, to } = monthBounds(ym);
      setData(await getRollCallHistory(cc, sem, sec, from, to));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-reload whenever the cascade resolves a context or month changes.
  const lastLoadKey = useRef<string | null>(null);
  useEffect(() => {
    if (!schedules || !effCourse || !effSem) return;
    const key = effCourse + '|' + effSem + '|' + effSection + '|' + month;
    if (lastLoadKey.current === key) return;
    lastLoadKey.current = key;
    load(effCourse, parseInt(effSem) || 0, effSection, month);
  }, [schedules, effCourse, effSem, effSection, month, load]);

  const slotTime = (slotId: string | null): string | null => {
    if (!slotId || !data) return null;
    const s = data.schedule.slots.find((x) => x.slotId === slotId);
    return s ? `${s.startTime.slice(0, 5)}-${s.endTime.slice(0, 5)}` : null;
  };

  const quickEdit = async (cell: RollCallHistoryCell, mode: 'FULL' | 'ABSENT') => {
    if (!data || !cell.attendanceId) return;
    try {
      const slots = data.schedule.slots;
      await updateAttendance(
        cell.attendanceId,
        mode === 'FULL'
          ? {
              attendanceStatus: 'PRESENT',
              attendanceStartSlotId: slots[0]?.slotId ?? null,
              attendanceEndSlotId: slots[slots.length - 1]?.slotId ?? null,
            }
          : { attendanceStatus: 'ABSENT', attendanceStartSlotId: null, attendanceEndSlotId: null }
      );
      toast.success('Attendance updated');
      setDetail(null);
      load(effCourse, parseInt(effSem) || 0, effSection, month);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={20} /> Roll Call History
          </h1>
          <div style={{ fontSize: 12.5, color: 'var(--text-light)' }}>
            Previously submitted attendance &middot; latest published timetable
          </div>
        </div>
        <Link href="/lecturer/roll-call" className="btn btn-ghost btn-sm" style={{ border: '1.5px solid var(--surface-border)' }}>
          <CalendarCheck size={14} /> Take Roll Call
        </Link>
      </div>

      {/* Filters: Course -> Semester -> Section (only authorized values) */}
      <div className="flex items-end gap-3 flex-wrap mb-4">
        <label style={{ fontSize: 12, color: 'var(--text-light)', display: 'grid', gap: 4 }}>
          Course
          <select value={selCourse} onChange={(e) => { setSelCourse(e.target.value); setSelSection(''); }}
            className="btn btn-ghost btn-sm cursor-pointer" style={{ border: '1.5px solid var(--surface-border)', minWidth: 160 }}>
            {!schedules && <option>Loading…</option>}
            {schedules && schedules.length === 0 && <option value="">No assigned courses available</option>}
            {courses.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-light)', display: 'grid', gap: 4 }}>
          Semester
          <select value={effSem} onChange={(e) => setSelSem(e.target.value)}
            className="btn btn-ghost btn-sm cursor-pointer" style={{ border: '1.5px solid var(--surface-border)', minWidth: 130 }}>
            {semesters.map((sem) => <option key={sem} value={sem}>Semester {sem}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-light)', display: 'grid', gap: 4 }}>
          Section
          <select value={effSection} onChange={(e) => setSelSection(e.target.value)}
            className="btn btn-ghost btn-sm cursor-pointer" style={{ border: '1.5px solid var(--surface-border)', minWidth: 120 }}>
            {sectionOptions.map(({ name }) => <option key={name} value={name}>{name}</option>)}
            {sectionOptions.length > 1 && <option value="">All my sections (combined)</option>}
          </select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-light)', display: 'grid', gap: 4 }}>
          Month
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="btn btn-ghost btn-sm" style={{ border: '1.5px solid var(--surface-border)' }} />
        </label>
        <button onClick={() => load(effCourse, parseInt(effSem) || 0, effSection, month)} disabled={!effCourse}
          className="btn btn-primary btn-sm cursor-pointer" style={{ opacity: resolvedScheduleId ? 1 : 0.5 }}>
          View
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4" style={{ borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.3)', color: 'var(--danger)', fontSize: 12.5 }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {loading && <div style={{ fontSize: 13, color: 'var(--text-light)' }}>Loading history…</div>}

      {!loading && !error && schedules && schedules.length === 0 && (
        <div style={{ padding: '24px 0', fontSize: 13, color: 'var(--text-light)' }}>No assigned courses available.</div>
      )}

      {!loading && data && data.sessions.length === 0 && (
        <div className="flex items-center gap-2 px-4 py-3 mb-3"
          style={{ borderRadius: 'var(--radius-md)', background: 'rgba(234,179,8,0.10)', border: '1.5px solid rgba(234,179,8,0.35)', color: 'var(--warning)', fontSize: 12.5 }}>
          No Roll Call sessions were submitted for this period — showing the class roster below.
        </div>
      )}

      {!loading && data && (
        <>
          {/* Course summary + dynamic aggregate */}
          <div className="flex items-center gap-2 flex-wrap mb-3" style={{ fontSize: 13 }}>
            <span className="badge" style={{ background: 'rgba(35,96,138,0.12)', color: 'var(--accent)', border: 'none', fontWeight: 700 }}>
              {data.schedule.courseCode}{data.schedule.courseName ? ` · ${data.schedule.courseName}` : ''}
            </span>
            <span className="badge badge-xs">Semester {data.schedule.semesterNo ?? '?'}</span>
            <span className="badge badge-xs">{data.schedule.sectionNames.join(' + ')}</span>
            <span className="badge badge-xs"><Layers size={11} /> {data.sessions.length} session{data.sessions.length !== 1 ? 's' : ''}</span>
            <span className="badge badge-xs">{data.sessions.reduce((a, s) => a + s.scheduledPeriods, 0)} scheduled periods</span>
            <span className="badge badge-xs"><Users size={11} /> {data.students.length} student{data.students.length !== 1 ? 's' : ''}</span>
            <span className="badge badge-xs">
              Avg attendance:{' '}
              {(() => {
                const withData = data.students.filter((s) => s.totalScheduledPeriods > 0);
                const avg = withData.length
                  ? Math.round((withData.reduce((a, s) => a + s.attendancePercentage, 0) / withData.length) * 100) / 100
                  : 0;
                return `${avg.toFixed(2)}%`;
              })()}
            </span>
          </div>

          {/* Sessions x students grid */}
          <div className="overflow-x-auto" style={{ border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-lg)' }}>
            <table className="table w-full" style={{ minWidth: 480 + data.sessions.length * 120 }}>
              <thead>
                <tr style={{ fontSize: 11 }}>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 }}>Student</th>
                  {data.sessions.map((s) => (
                    <th key={s.sessionId}>
                      <div>{new Date(s.sessionDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}</div>
                      <div>{new Date(s.sessionDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</div>
                      <div style={{ fontWeight: 400 }}>{s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}</div>
                      <div style={{ fontWeight: 400 }}>{s.scheduledPeriods} period{s.scheduledPeriods > 1 ? 's' : ''}</div>
                      <button
                        onClick={() => setPendingDelete({
                          sessionId: s.sessionId,
                          label: `${data.schedule.courseCode} on ${new Date(s.sessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
                        })}
                        title="Delete this Roll Call session and all its attendance"
                        className="cursor-pointer inline-flex items-center gap-1 mt-1"
                        style={{ fontSize: 10, color: 'var(--danger)', opacity: 0.75 }}>
                        <Trash2 size={11} /> Delete
                      </button>
                    </th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ fontSize: 11, color: 'var(--text-light)' }}>
                  <td style={{ position: 'sticky', left: 0, background: 'var(--surface)' }}>Scheduled</td>
                  {data.sessions.map((s) => <td key={s.sessionId}>{s.scheduledPeriods}</td>)}
                  <td>{data.sessions.reduce((a, s) => a + s.scheduledPeriods, 0)}</td>
                </tr>
                {data.students.map((st) => (
                  <tr key={st.studentId} style={{ fontSize: 12.5 }}>
                    <td style={{ position: 'sticky', left: 0, background: 'var(--surface)' }}>
                      <div style={{ fontWeight: 700 }}>{st.studentName}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-light)' }}>{st.rollNo}</div>
                    </td>
                    {st.attendance.map((cell) => (
                      <td key={cell.sessionId}>
                        <button
                          onClick={() => setDetail({ cell, student: st.studentName, date: String(data.sessions.find(x => x.sessionId === cell.sessionId)?.sessionDate ?? '') })}
                          className="cursor-pointer"
                          title={cell.status
                            ? `${cell.status} ${cell.attendedPeriods}/${cell.scheduledPeriods}${cell.remark ? ` — ${cell.remark}` : ''}`
                            : 'Not Recorded'}
                          style={{
                            border: '1px solid var(--surface-border)', borderRadius: 8, padding: '2px 8px',
                            background: cell.status === 'PRESENT' ? 'rgba(34,197,94,0.12)' : cell.status === 'ABSENT' ? 'rgba(239,68,68,0.10)' : 'transparent',
                            color: cell.status === 'PRESENT' ? '#16a34a' : cell.status === 'ABSENT' ? 'var(--danger)' : 'var(--text-lighter)',
                          }}>
                          {cell.status === 'PRESENT'
                            ? (cell.attendedPeriods >= cell.scheduledPeriods
                                ? 'P'
                                : `${cell.attendedPeriods}/${cell.scheduledPeriods}`)
                            : cell.status === 'ABSENT' ? 'A'
                            : '—'}
                          {cell.remark && (
                            <div style={{ fontSize: 9.5, fontWeight: 400, color: 'var(--warning)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {cell.remark}
                            </div>
                          )}
                        </button>
                      </td>
                    ))}
                    <td>
                      <div style={{ fontWeight: 700 }}>{st.totalAttendedPeriods}/{st.totalScheduledPeriods}</div>
                      <div style={{ fontSize: 11, color: st.attendancePercentage >= 75 ? '#16a34a' : 'var(--warning)' }}>
                        {st.attendancePercentage.toFixed(2)}%
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Delete-session confirmation */}
      {pendingDelete && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(15,23,42,0.45)' }} onClick={() => !deleting && setPendingDelete(null)}>
          <div className="w-full max-w-sm rounded-xl" style={{ background: 'var(--surface)', border: '1.5px solid var(--danger)', padding: 20 }}
            onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: 'var(--danger)' }}>
              Delete this Roll Call?
            </h3>
            <p style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              Delete Roll Call for <strong>{pendingDelete.label}</strong>?
              All attendance records for this session will also be permanently deleted,
              and the session will no longer count toward attendance totals.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn btn-ghost btn-sm cursor-pointer" disabled={deleting} onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className="btn btn-sm cursor-pointer" disabled={deleting}
                onClick={confirmDeleteSession}
                style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}>
                {deleting ? 'Deleting…' : 'Delete session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cell detail modal */}
      {detail && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(15,23,42,0.45)' }} onClick={() => setDetail(null)}>
          <div className="w-full max-w-sm rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', padding: 20 }}
            onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Attendance Record</h3>
            <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: 12.5 }}>
              <dt style={{ color: 'var(--text-light)' }}>Student</dt><dd style={{ fontWeight: 600 }}>{detail.student}</dd>
              <dt style={{ color: 'var(--text-light)' }}>Course</dt><dd>{data?.schedule.courseCode}</dd>
              <dt style={{ color: 'var(--text-light)' }}>Date</dt><dd>{detail.date}</dd>
              <dt style={{ color: 'var(--text-light)' }}>Status</dt><dd style={{ fontWeight: 700 }}>{detail.cell.status ?? 'NOT MARKED'}</dd>
              <dt style={{ color: 'var(--text-light)' }}>Attendance</dt><dd>{detail.cell.attendedPeriods} / {detail.cell.scheduledPeriods} periods</dd>
              <dt style={{ color: 'var(--text-light)' }}>Attended</dt>
              <dd>{detail.cell.status === 'PRESENT'
                ? `${slotTime(detail.cell.attendanceStartSlotId) ?? '?'} – ${slotTime(detail.cell.attendanceEndSlotId) ?? '?'}`
                : '—'}</dd>
              <dt style={{ color: 'var(--text-light)' }}>Remark</dt><dd>{detail.cell.remark || '—'}</dd>
              <dt style={{ color: 'var(--text-light)' }}>Lecturer</dt><dd>{detail.cell.markedByStaffName ?? '—'}</dd>
            </dl>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn btn-ghost btn-sm cursor-pointer" onClick={() => setDetail(null)}>Close</button>
              {detail.cell.attendanceId && detail.cell.status === 'PRESENT' && (
                <button className="btn btn-sm btn-error cursor-pointer" onClick={() => quickEdit(detail.cell, 'ABSENT')}>Mark as Absent</button>
              )}
              {detail.cell.attendanceId && detail.cell.status === 'ABSENT' && (
                <button className="btn btn-sm btn-success cursor-pointer" onClick={() => quickEdit(detail.cell, 'FULL')}>Mark as Present (full class)</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
