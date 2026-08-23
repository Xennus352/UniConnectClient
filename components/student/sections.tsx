'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useSupabase } from '@/utils/supabase/client';
import { useFeedPosts, uniqueChannelName } from '@/lib/supabase/hooks';
import WelcomeBar from '@/components/shared/WelcomeBar';
import StatCard from '@/components/shared/StatCard';
import DataTable from '@/components/shared/DataTable';
import ThemeSwitcher from '@/components/shared/ThemeSwitcher';
import FeedPost from '@/components/shared/FeedPost';
import LostFoundPage from '@/components/shared/LostFoundSection';
import AnnouncementsPage from '@/components/shared/AnnouncementsSection';
import { apiFetch, getTimetableTimeGrid, PERSISTED_PERIOD_LABELS, PERSISTED_LUNCH_LABEL } from '@/components/shared/api';
import { useSession } from '@/components/shared/session';
import { useMyProfile } from '@/components/shared/useMyProfile';
import { initialsOf } from '@/components/shared/useUniversityPeople';
import type { StudentRecord, AttendanceRecord, ScheduleRecord, AcademicTermRecord } from '@/components/shared/api';
import { useUniversityData } from '@/components/shared/useUniversityData';
import {
  GraduationCap, BookOpen, ClipboardCheck, CalendarCheck, CalendarDays,
  Newspaper, FileText, X,
  Clock, Users, ShieldCheck, Ban, Download, Eye,
} from 'lucide-react';
export { default as FeedSection } from '@/components/shared/FeedSection';
export { default as MessagesSection } from '@/components/shared/MessagesSection';
export { default as ActivitySection } from '@/components/shared/ActivitySection';

import BlockedSection from '@/components/shared/BlockedSection';

const cardStyle = { borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' } as const;

type TimeRow = { kind: 'period'; period: number } | { kind: 'lunch' };

/**
 * The persisted university timetable grid (source of truth in the time_slots
 * table): P1=09:00-10:00 … P3=11:00-12:00, Lunch=12:00-13:00,
 * P4=13:00-14:00 … P6=15:00-16:00. The school day runs 09:00-16:00.
 */
const TIME_ROWS: TimeRow[] = [
  { kind: 'period', period: 1 },
  { kind: 'period', period: 2 },
  { kind: 'period', period: 3 },
  { kind: 'lunch' },
  { kind: 'period', period: 4 },
  { kind: 'period', period: 5 },
  { kind: 'period', period: 6 },
];

const DAY_COLUMNS: { key: 'mon' | 'tue' | 'wed' | 'thu' | 'fri'; dayOfWeek: number }[] = [
  { key: 'mon', dayOfWeek: 1 },
  { key: 'tue', dayOfWeek: 2 },
  { key: 'wed', dayOfWeek: 3 },
  { key: 'thu', dayOfWeek: 4 },
  { key: 'fri', dayOfWeek: 5 },
];

interface StudentDayCell {
  text: string;
  sub: string;
  rowSpan: number;
  lunch: boolean;
}

/**
 * Builds the 7-row weekly grid (P1,P2,P3,Lunch,P4,P5,P6; rows 1..7) for one
 * day. The lunch hour (12:00-13:00) is a structural break: it is never part
 * of a continuous course card. A 2-period course scheduled P3→P4 (11:00-12:00
 * + 13:00-14:00) is rendered as two separated cells — one in the P3 row and
 * one in the P4 row — with the Lunch row empty between them. Courses that do
 * not cross the lunch boundary (P1-P2, P2-P3, P4-P5, P5-P6) stay one
 * continuous rowSpan. Co-located electives in the same window are joined into
 * one cell.
 */
function buildDayCells(schedules: ScheduleRecord[]): (StudentDayCell | null)[] {
  const rows = TIME_ROWS.length;
  const cells: (StudentDayCell | null)[] = Array(rows).fill(null);
  const merged: Record<number, { text: string[]; sub: string[]; span: number }> = {};
  for (const s of schedules) {
    const start = s.startPeriodNo;
    const end = Math.max(start, s.endPeriodNo ?? s.startPeriodNo);
    const crossesLunch = start <= 3 && end >= 4;
    const segments = crossesLunch
      ? [
          { row: start, span: 3 - start + 1 },
          { row: 5, span: end - 4 + 1 },
        ]
      : [
          {
            row: start <= 3 ? start : start + 1,
            span: (end <= 3 ? end : end + 1) - (start <= 3 ? start : start + 1) + 1,
          },
        ];
    for (const seg of segments) {
      const cur = merged[seg.row] ?? { text: [], sub: [], span: 0 };
      if (!cur.text.includes(s.courseCode)) cur.text.push(s.courseCode);
      if (s.staffName && !cur.sub.includes(s.staffName)) cur.sub.push(s.staffName);
      cur.span = Math.max(cur.span, seg.span);
      merged[seg.row] = cur;
    }
  }
  for (let r = 1; r <= 7; r++) {
    const m = merged[r];
    if (m) {
      cells[r - 1] = { text: m.text.join(' / '), sub: m.sub.join(', '), rowSpan: Math.min(m.span, 8 - r), lunch: false };
      continue;
    }
    const rowDef = TIME_ROWS[r - 1];
    cells[r - 1] = rowDef.kind === 'lunch'
      ? { text: 'Lunch', sub: '', rowSpan: 1, lunch: true }
      : { text: '\u2014 Free \u2014', sub: '', rowSpan: 1, lunch: false };
  }
  return cells;
}

export function Dashboard() {
  const supabase = useSupabase();
  const feed = useFeedPosts(supabase).posts;

  return (
    <div>
      <WelcomeBar name="Mg Kyaw" subtitle="Here's your academic overview" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard icon={<GraduationCap size={20} />} iconBgClass="bg-primary/10 text-primary" value={3.85} label="GPA" trend="+0.2 this sem" />
        <StatCard icon={<BookOpen size={20} />} iconBgClass="bg-info/10 text-info" value={5} label="Active Courses" trend="This semester" />
        <StatCard icon={<ClipboardCheck size={20} />} iconBgClass="bg-success/10 text-success" value={'94%'} label="Attendance" trend="+3% this month" />
        <StatCard icon={<CalendarDays size={20} />} iconBgClass="bg-warning/10 text-warning" value={3} label="Upcoming Events" trend="This week" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-[18px]">
        <div className="bg-base-100 backdrop-blur-xl" style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Newspaper size={16} /> Recent Feed
            </h3>
            <Link href="/student/feed" style={{ fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, textDecoration: 'none' }}>View All</Link>
          </div>
          {(feed ?? []).slice(0, 3).map((post) => (
            <FeedPost key={post.id} post={post} />
          ))}
          {feed && feed.length === 0 && (
            <div style={{ padding: '18px 22px', fontSize: 12, color: 'var(--text-lighter)' }}>No posts yet</div>
          )}
        </div>
        <div>
          <div className="bg-base-100 backdrop-blur-xl" style={{ ...cardStyle, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarCheck size={16} /> Upcoming Events
              </h3>
              <Link href="/student/events" style={{ fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, textDecoration: 'none' }}>View All</Link>
            </div>
            <div style={{ padding: '18px 22px', fontSize: 12, color: 'var(--text-lighter)' }}>No events yet</div>
          </div>
          <div className="bg-base-100 backdrop-blur-xl" style={{ ...cardStyle, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} /> Today&apos;s Schedule
              </h3>
            </div>
            <div style={{ padding: '18px 22px', fontSize: 12, color: 'var(--text-lighter)' }}>No schedules today</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TimetableSection() {
  const { user: session } = useSession();
  const me = session?.email ?? '';
  const [ttTab, setTtTab] = useState('weekly');
  const [timeGrid, setTimeGrid] = useState<{ periodLabels: string[]; lunchLabel: string }>({
    periodLabels: [...PERSISTED_PERIOD_LABELS],
    lunchLabel: PERSISTED_LUNCH_LABEL,
  });
  useEffect(() => {
    let on = true;
    getTimetableTimeGrid().then((g) => {
      if (on) setTimeGrid(g);
    });
    return () => {
      on = false;
    };
  }, []);

  const { data: schedules, loading, error } = useUniversityData<ScheduleRecord[]>(
    useCallback(async () => {
      const students = await apiFetch<StudentRecord[]>('/api/students');
      const self = students.find((s) => s.email === me);
      if (!self) return [];
      const terms = await apiFetch<AcademicTermRecord[]>('/api/terms');
      const active = terms.find((t) => t.status === 'ACTIVE');
      if (!active) return [];
      return apiFetch<ScheduleRecord[]>(`/api/students/${self.studentId}/schedules?termId=${active.termId}`);
    }, [me])
  );

  const dayCells = useMemo(
    () =>
      DAY_COLUMNS.map((col) =>
        buildDayCells((schedules ?? []).filter((s) => s.dayOfWeek === col.dayOfWeek))
      ),
    [schedules]
  );
  const hasAnyCourse = dayCells.some((cells) =>
    cells.some((c) => !!c && !c.lunch && c.text !== '\u2014 Free \u2014')
  );

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Timetable</h1>
      <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>Your weekly lecture and lab schedule</p>
      {loading && !schedules && <div style={{ fontSize: 12, color: 'var(--text-lighter)', marginBottom: 12 }}>Loading...</div>}
      {error && !schedules && <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>University server unreachable — retrying…</div>}
      <div className="bg-base-100 backdrop-blur-xl" style={cardStyle}>
        <div style={{ display: 'flex', gap: 4, padding: '0 22px', borderBottom: '1px solid var(--surface)' }}>
          {['weekly', 'monthly'].map((tab) => (
            <button
              key={tab}
              onClick={() => setTtTab(tab)}
              style={{
                padding: '12px 16px',
                fontSize: 13,
                fontWeight: 600,
                color: ttTab === tab ? 'var(--primary)' : 'var(--text-light)',
                cursor: 'pointer',
                borderBottom: '2.5px solid',
                borderBottomColor: ttTab === tab ? 'var(--primary)' : 'transparent',
                background: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderTop: 'none',
                outline: 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { if (ttTab !== tab) { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.borderBottomColor = 'var(--secondary)'; } }}
              onMouseLeave={(e) => { if (ttTab !== tab) { e.currentTarget.style.color = 'var(--text-light)'; e.currentTarget.style.borderBottomColor = 'transparent'; } }}
            >
              {tab === 'weekly' ? 'Weekly View' : 'Monthly'}
            </button>
          ))}
        </div>
        <div style={{ padding: '22px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Time', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.5px', textTransform: 'uppercase', borderBottom: '1.5px solid var(--secondary)', backgroundColor: 'var(--secondary-lighter)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_ROWS.map((rowDef, r) => {
                const timeLabel =
                  rowDef.kind === 'lunch' ? timeGrid.lunchLabel : timeGrid.periodLabels[rowDef.period - 1] ?? `P${rowDef.period}`;
                return (
                  <tr key={r} style={{ transition: 'background 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--divider-soft)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                    <td style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--accent)', borderBottom: '1px solid var(--divider)', whiteSpace: 'nowrap' }}>
                      {rowDef.kind === 'lunch' ? `Lunch ${timeLabel}` : `P${rowDef.period} ${timeLabel}`}
                    </td>
                    {DAY_COLUMNS.map((col, ci) => {
                      const cell = dayCells[ci]?.[r];
                      if (!cell) return null;
                      const isLunch = cell.lunch;
                      const isFree = !isLunch && cell.text === '\u2014 Free \u2014';
                      return (
                        <td
                          key={col.key}
                          rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
                          style={{
                            padding: '12px 14px',
                            fontSize: 12.5,
                            color: isLunch || isFree ? 'var(--text-lighter)' : 'var(--text)',
                            fontStyle: isLunch || isFree ? 'italic' : 'normal',
                            borderBottom: '1px solid var(--divider)',
                            background: isLunch ? 'repeating-linear-gradient(45deg, var(--divider), var(--divider) 6px, var(--secondary-lighter) 6px, var(--secondary-lighter) 12px)' : 'transparent',
                            verticalAlign: 'middle',
                          }}
                        >
                          {isLunch || isFree ? (
                            <span style={{ fontSize: 12 }}>{isLunch ? 'Lunch break' : cell.text}</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--primary)', overflowWrap: 'anywhere' }}>{cell.text}</span>
                              {cell.sub && <span style={{ fontSize: 10, color: 'var(--text-lighter)' }}>{cell.sub}</span>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && !error && !hasAnyCourse && (
            <div style={{ padding: '18px 22px', fontSize: 12, color: 'var(--text-lighter)' }}>No schedules published yet</div>
          )}
          {!loading && !error && hasAnyCourse && <CourseInfoPanel schedules={schedules ?? []} />}
        </div>
      </div>
    </div>
  );
}

function CourseInfoPanel({ schedules }: { schedules: ScheduleRecord[] }) {
  const rows = useMemo(() => {
    const byCode = new Map<string, { code: string; name: string; staff: Set<string> }>();
    for (const s of schedules) {
      const staff = (s.staffNames && s.staffNames.length > 0 ? s.staffNames : s.staffName ? [s.staffName] : []).join(', ');
      const cur = byCode.get(s.courseCode) ?? { code: s.courseCode, name: s.courseName ?? s.courseCode, staff: new Set<string>() };
      if (staff) cur.staff.add(staff);
      byCode.set(s.courseCode, cur);
    }
    return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [schedules]);
  if (rows.length === 0) return null;
  return (
    <div style={{ marginTop: 16, border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)', background: 'var(--surface-soft)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--surface-border)' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>
          Course Information
        </span>
        <span style={{ fontSize: 10.5, color: 'var(--text-lighter)', fontWeight: 600 }}>
          ({rows.length} {rows.length === 1 ? 'course' : 'courses'})
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 14px', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
        {rows.map((r) => (
          <div key={r.code} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--accent)', fontFamily: 'Consolas, Menlo, monospace', flexShrink: 0 }}>{r.code}</span>
            <span title={r.name} style={{ fontSize: 11.5, color: 'var(--text)', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.name}
            </span>
            <span title={Array.from(r.staff).join(', ')} style={{ fontSize: 11, color: 'var(--text-light)', flexShrink: 0, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {Array.from(r.staff).join(', ') || '\u2014'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExamResultsSection() {
  const supabase = useSupabase();
  const { user: session } = useSession();
  const me = session?.email ?? '';

  const [results, setResults] = useState<ExamResultRecord[] | null>(null);
  const [viewer, setViewer] = useState<ExamResultRecord | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    const { data: batches } = await supabase
      .from('exam_result_batches')
      .select('id')
      .eq('status', 'PUBLISHED');
    const published = ((batches ?? []) as Array<{ id: string }>).map((b) => b.id);

    let query = supabase
      .from('exam_results')
      .select('id, roll_number, year, semester, file_name, file_url, storage_path, created_at')
      .eq('recipient_email', me)
      .order('created_at', { ascending: false })
      .limit(100);
    if (published.length > 0) {
      query = query.or(`batch_id.in.(${published.join(',')}),batch_id.is.null`);
    } else {
      query = query.is('batch_id', null);
    }
    const { data } = await query;
    setResults((data as unknown as ExamResultRecord[] | null) ?? []);
  }, [supabase, me]);

  useEffect(() => {
    if (!me) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState only after await
    void load();
  }, [me, load]);

  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(uniqueChannelName('exam-results:mine'))
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'exam_results', filter: `recipient_email=eq.${me}` },
        (payload) => {
          const rec = payload.new as unknown as ExamResultRecord;
          if (!rec || seenRef.current.has(rec.id)) return;
          seenRef.current.add(rec.id);
          void load();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'exam_result_batches' },
        () => { void load(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, me, load]);

  const grouped = useMemo(() => {
    const groups = new Map<string, ExamResultRecord[]>();
    for (const r of results ?? []) {
      const key = `${r.year} \u2022 ${r.semester}`;
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }
    return [...groups.entries()];
  }, [results]);

  const downloadHref = (r: ExamResultRecord) =>
    `${r.file_url}${r.file_url.includes('?') ? '&' : '?'}download=${encodeURIComponent(r.file_name)}`;

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Exam Results</h1>
      <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>
        {results && results.length > 0
          ? `${results.length} published result${results.length > 1 ? 's' : ''} — updates arrive in real time`
          : 'Your published examination results'}
      </p>

      {results === null && <div style={{ fontSize: 12, color: 'var(--text-lighter)', marginBottom: 12 }}>Loading results...</div>}
      {results !== null && results.length === 0 && (
        <div className="bg-base-100 backdrop-blur-xl" style={{ ...cardStyle, padding: 40, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>
          No exam results published yet — you will be notified the moment a result is released.
        </div>
      )}

      {grouped.map(([label, list]) => (
        <div key={label} className="mb-6">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <GraduationCap size={16} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{label}</span>
            <span className="badge badge-primary badge-sm">{list.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {list.map((r) => (
              <div
                key={r.id}
                className="bg-base-100 backdrop-blur-xl flex flex-col gap-4 p-5"
                style={{
                  ...cardStyle,
                  background: 'linear-gradient(135deg, rgba(40,114,161,0.08), rgba(99,102,241,0.05))',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: '#fff', boxShadow: '0 4px 14px rgba(35,96,138,0.35)' }}>
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="truncate font-semibold" style={{ fontSize: 14, color: 'var(--accent)' }}>{r.file_name}</span>
                      <span className="badge badge-primary badge-sm shrink-0">Exam Result</span>
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-lighter)' }}>
                      Roll No {r.roll_number} \u2022 {new Date(r.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setViewer(r)} className="btn btn-primary btn-xs gap-1.5 border-none text-white" style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}>
                    <Eye size={13} /> View Result
                  </button>
                  <a href={downloadHref(r)} download={r.file_name} className="btn btn-ghost btn-xs gap-1.5" style={{ border: '1.5px solid var(--surface-border)' }}>
                    <Download size={13} /> Download PDF
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {viewer && createPortal(
        <AnimatePresence>
          <motion.dialog
            open
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal modal-open z-[999] p-4 border-none"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
            onClick={() => setViewer(null)}
            onCancel={(e) => { e.preventDefault(); setViewer(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="w-[94vw] max-w-3xl bg-base-100 rounded-2xl overflow-hidden"
              style={{ border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: '#fff' }}>
                  <FileText size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-semibold text-sm" style={{ color: 'var(--accent)' }}>{viewer.file_name}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-lighter)' }}>
                    {viewer.year} \u2022 {viewer.semester} \u2022 Roll No {viewer.roll_number}
                  </div>
                </div>
                <button onClick={() => setViewer(null)} className="btn btn-ghost btn-circle btn-sm" title="Close">
                  <X size={16} />
                </button>
              </div>
              <iframe src={viewer.file_url} title={viewer.file_name} className="w-full" style={{ height: '68vh', border: 'none', background: '#fff' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--surface)' }}>
                <a href={downloadHref(viewer)} download={viewer.file_name} className="btn btn-primary gap-1.5 border-none text-white" style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}>
                  <Download size={15} /> Download PDF
                </a>
                <button onClick={() => setViewer(null)} className="btn btn-ghost">Close</button>
              </div>
            </motion.div>
          </motion.dialog>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

interface ExamResultRecord {
  id: string;
  roll_number: string;
  year: string;
  semester: string;
  file_name: string;
  file_url: string;
  storage_path: string;
  created_at: number;
}

export function RollCallSection() {
  const { user: session } = useSession();
  const me = session?.email ?? '';
  const { data: attendance, loading, error } = useUniversityData<AttendanceRecord[]>(
    useCallback(async () => {
      const students = await apiFetch<StudentRecord[]>('/api/students');
      const self = students.find((s) => s.email === me);
      if (!self) return [];
      return apiFetch<AttendanceRecord[]>(`/api/students/${self.studentId}/attendance`);
    }, [me])
  );

  const records = attendance ?? [];
  const totalClasses = records.length;
  const totalAttended = records.filter((r) => r.attendanceStatus === 'PRESENT').length;
  const attendancePct = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0;

  const formatDate = (markedAt: string | null) => {
    if (!markedAt) return '—';
    const d = new Date(markedAt);
    if (Number.isNaN(d.getTime())) return markedAt.slice(0, 10);
    return d.toISOString().slice(0, 10);
  };

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Roll Call</h1>
      <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>Your attendance summary across enrolled courses</p>
      {loading && !attendance && <div style={{ fontSize: 12, color: 'var(--text-lighter)', marginBottom: 12 }}>Loading...</div>}
      {error && !attendance && <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>University server unreachable — retrying…</div>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <StatCard icon={<ClipboardCheck size={20} />} iconBgClass="bg-primary/10 text-primary" value={totalClasses} label="Total Classes" />
        <StatCard icon={<Users size={20} />} iconBgClass="bg-success/10 text-success" value={totalAttended} label="Attended" trend={`${attendancePct}% rate`} />
        <StatCard icon={<X size={20} />} iconBgClass="bg-error/10 text-error" value={totalClasses - totalAttended} label="Missed" />
      </div>
      <div className="bg-base-100 backdrop-blur-xl" style={cardStyle}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardCheck size={16} /> Attendance Summary • Mg Kyaw
          </h3>
        </div>
        <div style={{ padding: '0 22px' }}>
          <DataTable
            columns={[
              { key: 'rollNo', label: 'Roll No', render: (v: string) => <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)' }}>{v}</span> },
              { key: 'studentName', label: 'Student', render: (v: string) => <span style={{ fontSize: 12.5, fontWeight: 500 }}>{v}</span> },
              { key: 'markedAt', label: 'Date', render: (v: string | null) => <span style={{ fontSize: 12.5, fontWeight: 500 }}>{formatDate(v)}</span> },
              { key: 'attendanceStatus', label: 'Status', render: (v: string) => (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase',
                  color: v === 'PRESENT' ? 'var(--success)' : 'var(--error)',
                  backgroundColor: v === 'PRESENT' ? '#dcfce7' : '#fee2e2',
                }}>{v === 'PRESENT' ? 'Present' : 'Absent'}</span>
              )},
            ]}
            data={records}
          />
          {!loading && !error && records.length === 0 && (
            <div style={{ padding: '18px 0', fontSize: 12, color: 'var(--text-lighter)' }}>No attendance records yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

export { default as EventsSection } from '@/components/shared/EventsSection';

export function LostFoundSection() {
  return <LostFoundPage />;
}

export function AnnouncementsSection() {
  return <AnnouncementsPage />;
}

export function SettingsSection() {
  const [settingsTab, setSettingsTab] = useState('Profile');
  const { user: session } = useSession();
  const { profile, loading } = useMyProfile();
  const me = session?.email ?? '';
  const name = profile?.name || session?.name || 'User';

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Settings</h1>
      <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>Manage your account and preferences</p>
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--surface)' }}>
        {['Profile', 'Security', 'Appearance', 'Blocked'].map(t => (
          <button key={t} onClick={() => setSettingsTab(t)}
            style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: settingsTab === t ? 'var(--primary)' : 'var(--text-light)', cursor: 'pointer', borderBottom: '2.5px solid transparent', borderBottomColor: settingsTab === t ? 'var(--primary)' : 'transparent', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>{t}</button>
        ))}
      </div>
      {settingsTab === 'Profile' ? (
        <div className="bg-base-100 backdrop-blur-xl" style={cardStyle}>
          <div style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--surface)' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(to bottom right, var(--secondary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 22, color: 'var(--primary)' }}>{initialsOf(name)}</div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>{loading ? 'Loading...' : name}</h3>
                <p style={{ fontSize: 12, color: 'var(--text-lighter)', margin: '4px 0 0 0' }}>
                  {loading ? '' : profile?.kind === 'student' ? `Student • ${profile.major} • ${profile.rollNo}` : me}
                </p>
              </div>
            </div>
            {loading ? (
              <div className="text-center py-8 text-sm" style={{ color: 'var(--text-lighter)' }}>Loading profile...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Full Name</label>
                  <input type="text" defaultValue={name} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Email Address</label>
                  <input type="email" defaultValue={me} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Roll Number</label>
                  <input type="text" defaultValue={profile?.rollNo || ''} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Phone Number</label>
                  <input type="text" defaultValue={profile?.phone || ''} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 18, borderTop: '1px solid var(--surface)' }}>
              <button style={{ background: 'transparent', color: 'var(--text-light)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface)'; e.currentTarget.style.color = 'var(--primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-light)'; }}>Cancel</button>
              <button style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(35, 96, 138,0.3)' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(35, 96, 138,0.4)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(35, 96, 138,0.3)'; }}>Save Changes</button>
            </div>
          </div>
        </div>
      ) : settingsTab === 'Security' ? (
        <div className="bg-base-100 backdrop-blur-xl" style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={16} /> Security</div>
          </div>
          <div style={{ padding: '16px 22px' }}>
            <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Current Password</label><input type="password" placeholder="Enter current password" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} /></div>
            <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>New Password</label><input type="password" placeholder="Enter new password" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} /></div>
            <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Confirm New Password</label><input type="password" placeholder="Confirm new password" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} /></div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={{ background: 'transparent', color: 'var(--text-light)', borderRadius: 'var(--radius-sm)', padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none' }}>Cancel</button>
              <button style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '10px 20px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Update Password</button>
            </div>
          </div>
        </div>
      ) : settingsTab === 'Appearance' ? (
        <div className="bg-base-100 backdrop-blur-xl" style={cardStyle}>
          <ThemeSwitcher bare />
        </div>
      ) : (
        <div className="bg-base-100 backdrop-blur-xl" style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}><Ban size={16} /> Blocked Users</div>
          </div>
          <div style={{ padding: '16px 22px' }}>
            <BlockedSection bare />
          </div>
        </div>
      )}
    </div>
  );
}
