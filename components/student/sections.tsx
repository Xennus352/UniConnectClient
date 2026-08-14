'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useSupabase } from '@/utils/supabase/client';
import { useFeedPosts } from '@/lib/supabase/hooks';
import WelcomeBar from '@/components/shared/WelcomeBar';
import StatCard from '@/components/shared/StatCard';
import DataTable from '@/components/shared/DataTable';
import ThemeSwitcher from '@/components/shared/ThemeSwitcher';
import FeedPost from '@/components/shared/FeedPost';
import LostFoundPage from '@/components/shared/LostFoundSection';
import { apiFetch } from '@/components/shared/api';
import { useSession } from '@/components/shared/session';
import type { StudentRecord, AttendanceRecord, ScheduleRecord, AcademicTermRecord, ResultDocumentRecord } from '@/components/shared/api';
import { useUniversityData } from '@/components/shared/useUniversityData';
import {
  GraduationCap, BookOpen, ClipboardCheck, CalendarCheck, CalendarDays,
  Newspaper, FileText, Plus, Check, X,
  Clock, Users, Upload, ShieldCheck, Ban,
} from 'lucide-react';
export { default as FeedSection } from '@/components/shared/FeedSection';
export { default as MessagesSection } from '@/components/shared/MessagesSection';
import BlockedSection from '@/components/shared/BlockedSection';

interface TimetableEntry {
  time: string;
  mon: string; tue: string; wed: string; thu: string; fri: string;
}

const cardStyle = { borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' } as const;

const TIME_SLOTS: { period: number; time: string; empty: string }[] = [
  { period: 1, time: '8:00 – 9:30', empty: '— Free —' },
  { period: 2, time: '9:45 – 11:15', empty: '— Free —' },
  { period: 3, time: '11:30 – 13:00', empty: '— Lunch —' },
  { period: 4, time: '14:00 – 15:30', empty: '— Free —' },
  { period: 5, time: '15:45 – 17:15', empty: '— Free —' },
];

const DAY_COLUMNS: { key: 'mon' | 'tue' | 'wed' | 'thu' | 'fri'; dayOfWeek: number }[] = [
  { key: 'mon', dayOfWeek: 1 },
  { key: 'tue', dayOfWeek: 2 },
  { key: 'wed', dayOfWeek: 3 },
  { key: 'thu', dayOfWeek: 4 },
  { key: 'fri', dayOfWeek: 5 },
];

function buildTimetable(schedules: ScheduleRecord[]): TimetableEntry[] {
  return TIME_SLOTS.map((slot) => {
    const entry: TimetableEntry = { time: slot.time, mon: slot.empty, tue: slot.empty, wed: slot.empty, thu: slot.empty, fri: slot.empty };
    DAY_COLUMNS.forEach((col) => {
      const course = schedules.find((s) => s.dayOfWeek === col.dayOfWeek && s.startPeriodNo === slot.period);
      if (course) entry[col.key] = course.courseCode;
    });
    return entry;
  });
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

  const timetableRows = buildTimetable(schedules ?? []);

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
              {timetableRows.map((row, i) => (
                <tr key={i} style={{ transition: 'background 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--divider-soft)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                  <td style={{ padding: '12px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-light)', borderBottom: '1px solid var(--divider)', whiteSpace: 'pre-line' }}>{row.time}</td>
                  {['mon', 'tue', 'wed', 'thu', 'fri'].map((day) => {
                    const val = row[day as keyof typeof row];
                    const isLunch = val.includes('Lunch');
                    const isFree = val.includes('Free');
                    return (
                      <td key={day} style={{ padding: '12px 14px', fontSize: 12.5, color: isLunch ? 'var(--text-lighter)' : isFree ? 'var(--text-lighter)' : 'var(--text)', fontStyle: isLunch || isFree ? 'italic' : 'normal', borderBottom: '1px solid var(--divider)', whiteSpace: 'pre-line' }}>
                        {isLunch || isFree ? (
                          <span style={{ fontSize: 12 }}>{val.replace('— ', '')}</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{val.split('\n')[0]}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-lighter)' }}>{val.split('\n')[1]}</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !error && timetableRows.length === 0 && (
            <div style={{ padding: '18px 22px', fontSize: 12, color: 'var(--text-lighter)' }}>No schedules published yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ExamResultsSection() {
  const { user: session } = useSession();
  const me = session?.email ?? '';
  const { data: results, loading, error } = useUniversityData<ResultDocumentRecord[]>(
    useCallback(async () => {
      const students = await apiFetch<StudentRecord[]>('/api/students');
      const self = students.find((s) => s.email === me);
      if (!self) return [];
      return apiFetch<ResultDocumentRecord[]>(`/api/students/${self.studentId}/results`);
    }, [me])
  );

  const releaseBadge = (v: string) => {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      RELEASED: { label: 'Released', color: 'var(--success)', bg: '#dcfce7' },
      PENDING: { label: 'Pending', color: 'var(--warning)', bg: '#fef9c3' },
      BLOCKED: { label: 'Blocked', color: 'var(--error)', bg: '#fee2e2' },
    };
    const s = map[v] ?? { label: v, color: 'var(--text-light)', bg: 'var(--surface)' };
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: s.color, backgroundColor: s.bg }}>{s.label}</span>
    );
  };

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Exam Results</h1>
      <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>Your personal examination results</p>
      {loading && !results && <div style={{ fontSize: 12, color: 'var(--text-lighter)', marginBottom: 12 }}>Loading...</div>}
      {error && !results && <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>University server unreachable — retrying…</div>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <StatCard icon={<GraduationCap size={20} />} iconBgClass="bg-primary/10 text-primary" value={3.85} label="Cumulative GPA" trend="Top 10%" />
        <StatCard icon={<FileText size={20} />} iconBgClass="bg-info/10 text-info" value={8} label="Courses Completed" trend="All passed" />
        <StatCard icon={<Check size={20} />} iconBgClass="bg-success/10 text-success" value={'100%'} label="Pass Rate" trend="Semester 2" />
      </div>
      <div className="bg-base-100 backdrop-blur-xl" style={cardStyle}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <GraduationCap size={16} /> My Results • Mg Kyaw
          </h3>
        </div>
        <div style={{ padding: '0 22px' }}>
          <DataTable
            columns={[
              { key: 'examTypeName', label: 'Exam', render: (v: string) => <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)' }}>{v}</span> },
              { key: 'pdfFileName', label: 'Document', render: (v: string) => <span style={{ fontSize: 12.5, fontWeight: 500 }}>{v}</span> },
              { key: 'releaseStatus', label: 'Status', render: (v: string) => releaseBadge(v) },
            ]}
            data={results ?? []}
          />
          {!loading && !error && (results ?? []).length === 0 && (
            <div style={{ padding: '18px 0', fontSize: 12, color: 'var(--text-lighter)' }}>No results published yet</div>
          )}
        </div>
      </div>
    </div>
  );
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

export function SettingsSection() {
  const [settingsTab, setSettingsTab] = useState('Profile');

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
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(to bottom right, var(--secondary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 22, color: 'var(--primary)' }}>MK</div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>Mg Kyaw</h3>
                <p style={{ fontSize: 12, color: 'var(--text-lighter)', margin: '4px 0 0 0' }}>Student • B.Sc. Computer Science • UCS-1042</p>
              </div>
              <button style={{ marginLeft: 'auto', background: 'var(--secondary-light)', color: 'var(--primary)', border: '1.5px solid var(--secondary)', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--secondary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--secondary-light)'; }}><Upload size={13} /> Change Photo</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Full Name</label>
                <input type="text" defaultValue="Mg Kyaw" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Email Address</label>
                <input type="email" defaultValue="student@uniconnect.edu" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Roll Number</label>
                <input type="text" defaultValue="UCS-1042" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Phone Number</label>
                <input type="text" defaultValue="+95 9 123 456 789" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 18, borderTop: '1px solid var(--surface)' }}>
              <button style={{ background: 'transparent', color: 'var(--text-light)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface)'; e.currentTarget.style.color = 'var(--primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-light)'; }}>Cancel</button>
              <button style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(2, 132, 199,0.3)' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(2, 132, 199,0.4)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(2, 132, 199,0.3)'; }}>Save Changes</button>
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
