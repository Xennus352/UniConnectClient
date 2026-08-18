'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSupabase } from '@/utils/supabase/client';
import { useFeedPosts, useConversations } from '@/lib/supabase/hooks';
import WelcomeBar from '@/components/shared/WelcomeBar';
import StatCard from '@/components/shared/StatCard';
import MessageItem from '@/components/shared/MessageItem';
import QuickAccess from '@/components/shared/QuickAccess';
import DataTable from '@/components/shared/DataTable';
import ThemeSwitcher from '@/components/shared/ThemeSwitcher';
import FeedPost from '@/components/shared/FeedPost';
import LostFoundPage from '@/components/shared/LostFoundSection';
import AnnouncementsPage from '@/components/shared/AnnouncementsSection';
import { useSession } from '@/components/shared/session';
import { useMyProfile } from '@/components/shared/useMyProfile';
import { toast } from 'sonner';
import {
  BookOpen, ClipboardList, Megaphone, CalendarCheck,
  CalendarDays,
  Search, MessageSquare, Newspaper,
  Filter, Download, Plus, Check, X, Eye, Users, Ban,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { StudentData, RollCallData } from '@/components/shared/types';
import { apiFetch, markAttendance } from '@/components/shared/api';
import type {
  AcademicTermRecord, AttendanceRecord, ClassSessionRecord,
  ScheduleRecord, StudentRecord,
} from '@/components/shared/api';
import { useUniversityData } from '@/components/shared/useUniversityData';
export { default as FeedSection } from '@/components/shared/FeedSection';
export { default as MessagesSection } from '@/components/shared/MessagesSection';
export { default as ActivitySection } from '@/components/shared/ActivitySection';

import BlockedSection from '@/components/shared/BlockedSection';

interface TimetableEntry {
  time: string;
  mon: string; tue: string; wed: string; thu: string; fri: string;
}

type RollCallRow = RollCallData & { studentId: string };

const PERIOD_START_MIN = [8 * 60, 9 * 60 + 45, 11 * 60 + 30, 14 * 60, 15 * 60 + 45, 17 * 60 + 30, 19 * 60 + 15];

function initialsOf(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => (w[0] || '').toUpperCase()).join('');
}

function slotTimeLabel(startPeriodNo: number): string {
  const fmt = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  const start = PERIOD_START_MIN[startPeriodNo - 1] ?? 8 * 60;
  return `${fmt(start)} \u2013 ${fmt(start + 90)}`;
}

function timeLabel(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function Dashboard() {
  const supabase = useSupabase();
  const [feedTab, setFeedTab] = useState('latest');
  const { posts, loading: postsLoading } = useFeedPosts(supabase);
  const { user: session } = useSession();
  const me = session?.email ?? '';
  const { conversations, loading: convLoading } = useConversations(supabase, me);

  return (
    <div>
      <WelcomeBar name="Dr. Smith" subtitle="Here's your lecture overview for today" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard icon={<BookOpen size={20} />} iconBgClass="bg-primary/10 text-primary" value={6} label="Active Courses" trend="+2 this sem" />
        <StatCard icon={<ClipboardList size={20} />} iconBgClass="bg-info/10 text-info" value={12} label="Assignments" trend="3 due soon" />
        <StatCard icon={<Megaphone size={20} />} iconBgClass="bg-warning/10 text-warning" value={3} label="Announcements" trend="New today" />
        <StatCard icon={<CalendarCheck size={20} />} iconBgClass="bg-success/10 text-success" value={8} label="Upcoming Events" trend="This week" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-[18px]">
        <div>
          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Newspaper size={16} /> Recent Feed
              </h3>
              <span style={{ fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>View All</span>
            </div>
            <div style={{ display: 'flex', gap: 4, padding: '0 22px', borderBottom: '1px solid var(--surface)' }}>
              {['latest', 'following'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFeedTab(tab)}
                  style={{
                    padding: '12px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: feedTab === tab ? 'var(--primary)' : 'var(--text-light)',
                    cursor: 'pointer',
                    borderBottom: '2.5px solid',
                    borderBottomColor: feedTab === tab ? 'var(--primary)' : 'transparent',
                    background: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderTop: 'none',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => { if (feedTab !== tab) { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.borderBottomColor = 'var(--secondary)'; } }}
                  onMouseLeave={(e) => { if (feedTab !== tab) { e.currentTarget.style.color = 'var(--text-light)'; e.currentTarget.style.borderBottomColor = 'transparent'; } }}
                >
                  {tab === 'latest' ? 'Latest' : 'Following'}
                </button>
              ))}
            </div>
            {(posts ?? []).slice(0, 2).map((post) => (
              <FeedPost key={post.id} post={post} />
            ))}
            {posts && posts.length === 0 && (
              <div style={{ padding: '18px 22px', fontSize: 13, color: 'var(--text-lighter)' }}>No posts yet</div>
            )}
          </div>
        </div>
        <div>
          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarCheck size={16} /> Upcoming Events
              </h3>
              <span style={{ fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>View All</span>
            </div>
            <div style={{ padding: '18px 22px', fontSize: 13, color: 'var(--text-lighter)' }}>No upcoming events</div>
          </div>
          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={16} /> Recent Messages
              </h3>
              <span style={{ fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>View All</span>
            </div>
            {(conversations ?? []).slice(0, 3).map((conv) => (
              <MessageItem key={conv.id} initials={conv.other.initials} color="from-primary to-secondary" name={conv.other.name} preview={conv.preview} time={timeLabel(conv.lastMessageAt)} />
            ))}
            {conversations && conversations.length === 0 && (
              <div style={{ padding: '18px 22px', fontSize: 13, color: 'var(--text-lighter)' }}>No messages yet</div>
            )}
          </div>
          <QuickAccess role={session?.role} />
        </div>
      </div>
    </div>
  );
}

function ordinalLabel(n: number): string {
  return ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'][n - 1] ?? `${n}th`;
}

function StudentInfoModal({ student, onClose }: { student: StudentRecord; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);
  const fields: Array<{ label: string; value: string }> = [
    { label: 'Roll No', value: student.rollNo },
    { label: 'Major', value: student.majorCode },
    { label: 'Semester', value: ordinalLabel(student.semesterNo) },
    { label: 'Section', value: student.sectionName || '—' },
    { label: 'Academic Year', value: student.academicYear ? `${student.academicYear}` : '—' },
    { label: 'Phone', value: student.phoneNo || '—' },
    { label: 'Address', value: student.address || '—' },
  ];
  return (
    <>
      <style>{`
        dialog.sim-pop::backdrop { background: rgba(4, 10, 16, 0.55); animation: sim-fade 0.2s ease-out; }
        dialog.sim-pop[open] { animation: sim-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes sim-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sim-pop { from { opacity: 0; transform: scale(0.94) translateY(8px); } to { opacity: 1; transform: none; } }
      `}</style>
      <dialog
        ref={dialogRef}
        className="sim-pop"
        onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
        style={{
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--modal-bg)',
          color: 'var(--text)',
          padding: 0,
          margin: 'auto',
          width: 'min(420px, calc(100vw - 32px))',
          maxHeight: 'min(520px, calc(100vh - 64px))',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--surface)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-info to-info/70 flex items-center justify-center text-white font-bold text-sm shrink-0">{initialsOf(student.studentName)}</div>
          <div className="flex-1 min-w-0">
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.studentName}</h3>
            <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{student.email}</div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            aria-label="Close"
            className="cursor-pointer border-none flex items-center justify-center transition-transform duration-200 hover:scale-110 hover:rotate-90 shrink-0"
            style={{ color: 'var(--text-light)', background: 'none', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '18px 20px', display: 'grid', gap: 10 }}>
          {fields.map((f) => (
            <div key={f.label} className="flex items-start justify-between gap-4" style={{ paddingBottom: 10, borderBottom: '1px solid var(--divider)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-lighter)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{f.label}</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', textAlign: 'right', wordBreak: 'break-word' }}>{f.value}</span>
            </div>
          ))}
        </div>
      </dialog>
    </>
  );
}

export function StudentsSection() {
  const { data, loading, error } = useUniversityData<StudentRecord[]>(
    useCallback(() => apiFetch<StudentRecord[]>('/api/students'), [])
  );
  const router = useRouter();
  const { user: session } = useSession();
  const [query, setQuery] = useState('');
  const [course, setCourse] = useState('all');
  const [semester, setSemester] = useState('all');
  const [viewing, setViewing] = useState<StudentRecord | null>(null);

  const students = useMemo(() => data ?? [], [data]);

  const courseOptions = useMemo(() => [...new Set(students.map((s) => s.majorCode).filter(Boolean))].sort(), [students]);
  const semesterOptions = useMemo(
    () => [...new Set(students.map((s) => s.semesterNo).filter((n) => n > 0))].sort((a, b) => a - b),
    [students]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (course !== 'all' && s.majorCode !== course) return false;
      if (semester !== 'all' && s.semesterNo !== Number(semester)) return false;
      if (q) {
        const haystack = `${s.studentName} ${s.rollNo} ${s.email} ${s.majorCode} ${s.semesterNo}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [students, query, course, semester]);

  const rows: (StudentData & { student: StudentRecord })[] = filtered.map((s) => ({
    name: s.studentName,
    initials: initialsOf(s.studentName),
    color: 'from-info to-info/70',
    rollNo: s.rollNo,
    major: s.majorCode,
    majorColor: 'badge-primary',
    email: s.email,
    semester: ordinalLabel(s.semesterNo),
    student: s,
  }));

  const openMessages = useCallback(async (student: StudentRecord) => {
    if (!session) return;
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otherEmail: student.email,
          otherName: student.studentName,
          otherInitials: initialsOf(student.studentName),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Could not start conversation' }))).message);
      const { conversationId } = await res.json();
      router.push(`/${session?.role ?? 'student'}/messages?conv=${conversationId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start conversation');
    }
  }, [router, session]);

  return (
    <div>
      {error && !data && (
        <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>
          University server unreachable — retrying…
        </div>
      )}
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Students</h1>
      <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>Manage and view your enrolled students</p>
      {loading && !data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-base-100 backdrop-blur-xl p-5" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-strong)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded-[var(--radius-md)] bg-base-300 animate-pulse" />
                  <div className="h-5 w-20 rounded-full bg-base-300 animate-pulse" />
                </div>
                <div className="h-7 w-16 rounded-md bg-base-300 animate-pulse" />
                <div className="mt-3 h-3.5 w-28 rounded bg-base-300 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px' }}>
              <div className="flex items-center gap-3 mb-[18px] flex-wrap">
                <div className="h-10 flex-1 min-w-[200px] rounded-[var(--radius-sm)] bg-base-300 animate-pulse" />
                <div className="h-10 w-[140px] rounded-[var(--radius-sm)] bg-base-300 animate-pulse" />
                <div className="h-10 w-[140px] rounded-[var(--radius-sm)] bg-base-300 animate-pulse" />
              </div>
              <div className="flex items-center gap-6 px-4 py-3" style={{ borderBottom: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)' }}>
                <div className="h-3 w-24 rounded bg-base-300 animate-pulse" />
                <div className="h-3 w-16 rounded bg-base-300 animate-pulse" />
                <div className="h-3 w-14 rounded bg-base-300 animate-pulse" />
                <div className="h-3 w-20 rounded bg-base-300 animate-pulse" />
                <div className="h-3 w-10 rounded bg-base-300 animate-pulse ml-auto" />
              </div>
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex items-center gap-6 px-4 py-[14px]" style={{ borderBottom: '1px solid var(--divider)' }}>
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-full bg-base-300 animate-pulse shrink-0" />
                    <div className="space-y-2">
                      <div className="h-3.5 w-44 rounded bg-base-300 animate-pulse" />
                      <div className="h-3 w-32 rounded bg-base-300 animate-pulse" />
                    </div>
                  </div>
                  <div className="h-3.5 w-20 rounded bg-base-300 animate-pulse" />
                  <div className="h-5 w-14 rounded-full bg-base-300 animate-pulse" />
                  <div className="h-3.5 w-8 rounded bg-base-300 animate-pulse" />
                  <div className="ml-auto flex gap-2">
                    <div className="h-6 w-6 rounded bg-base-300 animate-pulse" />
                    <div className="h-6 w-6 rounded bg-base-300 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <StatCard icon={<Users size={20} />} iconBgClass="bg-primary/10 text-primary" value={data?.length ?? 0} label="Total Students" trend="Across courses" />
            <StatCard icon={<Check size={20} />} iconBgClass="bg-success/10 text-success" value={data?.length ?? 0} label="Active" trend="All enrolled" />
            <StatCard icon={<X size={20} />} iconBgClass="bg-error/10 text-error" value={0} label="Pending" trend="Need review" />
          </div>
      <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 18, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ color: 'var(--text-light)' }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, roll no, email, or major..."
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: 'var(--text)', width: '100%' }}
              />
            </div>
            <select value={course} onChange={(e) => setCourse(e.target.value)} style={{ padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--surface)', fontSize: 14, color: 'var(--text)', fontWeight: 500, cursor: 'pointer', minWidth: 140 }}>
              <option value="all">All Courses</option>
              {courseOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select value={semester} onChange={(e) => setSemester(e.target.value)} style={{ padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--surface)', fontSize: 14, color: 'var(--text)', fontWeight: 500, cursor: 'pointer', minWidth: 140 }}>
              <option value="all">All Semesters</option>
              {semesterOptions.map((s) => (
                <option key={s} value={s}>{ordinalLabel(s)}</option>
              ))}
            </select>
          </div>
          {rows.length === 0 ? (
            <div style={{ padding: '18px 22px', fontSize: 13, color: 'var(--text-lighter)' }}>
              {students.length > 0 ? 'No students match your search or filters' : 'No students yet'}
            </div>
          ) : (
            <DataTable
              columns={[
                { key: 'name', label: 'Student', render: (_: string | number, row: StudentData) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${row.color} flex items-center justify-center text-white font-bold text-xs`}>{row.initials}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{row.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-lighter)' }}>{row.email}</div>
                    </div>
                  </div>
                )},
                { key: 'rollNo', label: 'Roll No', render: (v: string) => <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 500, color: 'var(--text-light)' }}>{v}</span> },
                { key: 'major', label: 'Major', render: (v: string) => (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase',
                    color: v === 'CS' ? 'var(--primary)' : v === 'SE' ? 'var(--accent)' : 'var(--info)',
                    backgroundColor: v === 'CS' ? 'rgba(40, 114, 161,0.15)' : v === 'SE' ? 'rgba(45,68,92,0.08)' : 'rgba(59,130,246,0.08)',
                  }}>{v}</span>
                )},
                { key: 'semester', label: 'Semester', render: (v: string) => <span style={{ fontSize: 12.5, fontWeight: 500 }}>{v}</span> },
                { key: 'actions', label: '', render: (_: string | number, row: StudentData) => {
                  const st = (row as StudentData & { student: StudentRecord }).student;
                  return (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      title="View student"
                      onClick={() => setViewing(st)}
                      style={{ background: 'transparent', color: 'var(--text-light)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface)'; e.currentTarget.style.color = 'var(--primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-light)'; }}
                    ><Eye size={14} /></button>
                    <button
                      title="Message student"
                      onClick={() => void openMessages(st)}
                      style={{ background: 'transparent', color: 'var(--text-light)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface)'; e.currentTarget.style.color = 'var(--primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-light)'; }}
                    ><MessageSquare size={14} /></button>
                  </div>
                );}},
              ]}
              data={rows}
            />
          )}
        </div>
      </div>
        </>
      )}
      {viewing && <StudentInfoModal student={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

export function RollCallSection() {
  const sessions = useUniversityData<ClassSessionRecord[]>(
    useCallback(() => apiFetch<ClassSessionRecord[]>('/api/sessions'), [])
  );
  const firstSession = useMemo(
    () => (sessions.data && sessions.data.length > 0 ? sessions.data[0] : null),
    [sessions.data]
  );
  const attendance = useUniversityData<AttendanceRecord[]>(
    useCallback(
      () => (firstSession
        ? apiFetch<AttendanceRecord[]>(`/api/attendance?sessionId=${firstSession.sessionId}`)
        : Promise.resolve([])),
      [firstSession]
    )
  );
  const rows = useMemo<RollCallRow[]>(() => {
    if (!attendance.data || attendance.data.length === 0) return [];
    return attendance.data.map((a) => ({
      studentId: a.studentId,
      rollNo: a.rollNo,
      name: a.studentName,
      initials: initialsOf(a.studentName),
      color: 'from-info to-info/70',
      year: '\u2014',
      present: a.attendanceStatus === 'PRESENT',
    }));
  }, [attendance.data]);

  const [rollData, setRollData] = useState<RollCallRow[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync server rows into toggleable state
    setRollData(rows);
  }, [rows]);
  const totalPresent = rollData.filter(r => r.present).length;

  const toggleAttendance = useCallback((studentId: string, present: boolean) => {
    if (!firstSession) return;
    const next = rollData.map(r => (r.studentId === studentId ? { ...r, present } : r));
    setRollData(next);
    const entries = next.map(r => ({
      studentId: r.studentId,
      attendanceStatus: r.present ? ('PRESENT' as const) : ('ABSENT' as const),
    }));
    markAttendance(firstSession.sessionId, entries).catch(() => {
      setRollData(rollData);
      toast.error('Failed to save attendance');
    });
  }, [rollData, firstSession]);

  const markAllPresent = useCallback(() => {
    if (!firstSession || rollData.length === 0) return;
    const next = rollData.map(r => ({ ...r, present: true }));
    setRollData(next);
    const entries = next.map(r => ({
      studentId: r.studentId,
      attendanceStatus: 'PRESENT' as const,
    }));
    markAttendance(firstSession.sessionId, entries).catch(() => {
      setRollData(rollData);
      toast.error('Failed to save attendance');
    });
  }, [rollData, firstSession]);

  return (
    <div>
      {sessions.error && !sessions.data && (
        <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>
          University server unreachable — retrying…
        </div>
      )}
      {attendance.error && !attendance.data && (
        <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>
          University server unreachable — retrying…
        </div>
      )}
      {(sessions.loading && !sessions.data) || (attendance.loading && !attendance.data) ? (
        <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12 }}>Loading...</div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>Roll Call</h1>
        <button
          style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(35, 96, 138,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(35, 96, 138,0.4)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(35, 96, 138,0.3)'; }}
        ><Download size={14} /> Export</button>
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>
        {firstSession
          ? `Mark attendance for ${firstSession.courseCode} \u2022 ${firstSession.sectionName} \u2022 ${firstSession.sessionDate}`
          : 'No active session to mark attendance for'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <StatCard icon={<Users size={20} />} iconBgClass="bg-primary/10 text-primary" value={rollData.length} label="Total Students" />
        <StatCard icon={<Check size={20} />} iconBgClass="bg-success/10 text-success" value={totalPresent} label="Present" trend={`${rollData.length > 0 ? Math.round((totalPresent / rollData.length) * 100) : 0}%`} />
        <StatCard icon={<X size={20} />} iconBgClass="bg-error/10 text-error" value={rollData.length - totalPresent} label="Absent" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-[18px]">
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={16} /> Filters
            </h3>
          </div>
          <div style={{ padding: '18px 22px' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Course</label>
              <select style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }}>
                <option>CS-401 \u2022 AI & ML</option>
                <option>CS-402 \u2022 Software Eng</option>
                <option>CS-403 \u2022 Database</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Date</label>
              <input type="date" defaultValue="2026-07-30" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Section</label>
              <select style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }}>
                <option>All Sections</option>
                <option>A</option>
                <option>B</option>
              </select>
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--secondary-lighter)', marginBottom: 16, border: '1px solid var(--surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-light)', fontWeight: 500 }}>Present</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>{totalPresent}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-light)', fontWeight: 500 }}>Absent</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--error)' }}>{rollData.length - totalPresent}</span>
              </div>
            </div>
            <button
              onClick={markAllPresent}
              style={{ width: '100%', background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(35, 96, 138,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(35, 96, 138,0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(35, 96, 138,0.3)'; }}
            ><Check size={14} /> Mark All Present</button>
            <button
              style={{ width: '100%', background: 'var(--secondary-light)', color: 'var(--primary)', border: '1.5px solid var(--secondary)', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--secondary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--secondary-light)'; }}
            ><Download size={14} /> Export Report</button>
          </div>
        </div>
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', flex: 1, minWidth: 180 }}>
                <Search size={14} style={{ color: 'var(--text-light)' }} />
                <input type="text" placeholder="Search by name or roll no..." style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: 'var(--text)', width: '100%' }} />
              </div>
              <select style={{ padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--surface)', fontSize: 14, color: 'var(--text)', fontWeight: 500, cursor: 'pointer', minWidth: 120 }}>
                <option>Today</option>
                <option>Yesterday</option>
                <option>This Week</option>
              </select>
            </div>
          </div>
          {rollData.length === 0 ? (
            <div style={{ padding: '18px 22px', fontSize: 13, color: 'var(--text-lighter)' }}>No attendance records yet</div>
          ) : (
            <DataTable
              columns={[
                { key: 'rollNo', label: 'Roll No', render: (v: string) => <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 500, color: 'var(--text-light)' }}>{v}</span> },
                { key: 'name', label: 'Student', render: (_value: string | number, row: RollCallRow) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${row.color} flex items-center justify-center text-white font-bold text-xs`}>{row.initials}</div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{row.name}</span>
                  </div>
                )},
                { key: 'year', label: 'Year', render: (v: string) => <span style={{ fontSize: 12.5, fontWeight: 500 }}>{v}</span> },
                { key: 'present', label: 'Status', render: (_value: boolean, row: RollCallRow) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => toggleAttendance(row.studentId, true)}
                      style={{
                        width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, cursor: 'pointer', border: row.present ? 'none' : '1.5px solid var(--secondary)',
                        background: row.present ? 'var(--success)' : 'var(--secondary-lighter)',
                        color: row.present ? '#fff' : 'var(--text-light)',
                        boxShadow: row.present ? '0 2px 6px rgba(34,197,94,0.3)' : 'none',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { if (!row.present) { e.currentTarget.style.background = 'rgba(34,197,94,0.1)'; e.currentTarget.style.color = 'var(--success)'; e.currentTarget.style.borderColor = 'var(--success)'; } }}
                      onMouseLeave={(e) => { if (!row.present) { e.currentTarget.style.background = 'var(--secondary-lighter)'; e.currentTarget.style.color = 'var(--text-light)'; e.currentTarget.style.borderColor = 'var(--secondary)'; } }}
                    ><Check size={14} /></button>
                    <button
                      onClick={() => toggleAttendance(row.studentId, false)}
                      style={{
                        width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, cursor: 'pointer', border: !row.present ? 'none' : '1.5px solid var(--secondary)',
                        background: !row.present ? 'var(--error)' : 'var(--secondary-lighter)',
                        color: !row.present ? '#fff' : 'var(--text-light)',
                        boxShadow: !row.present ? '0 2px 6px rgba(239,68,68,0.3)' : 'none',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { if (row.present) { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.borderColor = 'var(--error)'; } }}
                      onMouseLeave={(e) => { if (row.present) { e.currentTarget.style.background = 'var(--secondary-lighter)'; e.currentTarget.style.color = 'var(--text-light)'; e.currentTarget.style.borderColor = 'var(--secondary)'; } }}
                    ><X size={14} /></button>
                  </div>
                )},
              ]}
              data={rollData}
            />
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderTop: '1px solid var(--surface)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-lighter)', fontWeight: 500 }}>{totalPresent} of {rollData.length} present</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TimetableSection() {
  const [ttTab, setTtTab] = useState('weekly');
  const terms = useUniversityData<AcademicTermRecord[]>(
    useCallback(() => apiFetch<AcademicTermRecord[]>('/api/terms'), [])
  );
  const activeTerm = useMemo(() => {
    const list = terms.data || [];
    return list.find((t) => t.status === 'ACTIVE') || list[0] || null;
  }, [terms.data]);
  const schedules = useUniversityData<ScheduleRecord[]>(
    useCallback(
      () => (activeTerm
        ? apiFetch<ScheduleRecord[]>(`/api/schedules?termId=${activeTerm.termId}`)
        : Promise.resolve([])),
      [activeTerm]
    )
  );
  const ttRows = useMemo<TimetableEntry[]>(() => {
    if (!schedules.data || schedules.data.length === 0) return [];
    const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;
    const bySlot = new Map<number, TimetableEntry>();
    for (const s of schedules.data) {
      if (s.dayOfWeek < 1 || s.dayOfWeek > 5) continue;
      let entry = bySlot.get(s.startPeriodNo);
      if (!entry) {
        entry = {
          time: slotTimeLabel(s.startPeriodNo),
          mon: '\u2014 Free \u2014',
          tue: '\u2014 Free \u2014',
          wed: '\u2014 Free \u2014',
          thu: '\u2014 Free \u2014',
          fri: '\u2014 Free \u2014',
        };
        bySlot.set(s.startPeriodNo, entry);
      }
      entry[dayKeys[s.dayOfWeek - 1]] = s.courseCode;
    }
    return Array.from(bySlot.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => v);
  }, [schedules.data]);

  return (
    <div>
      {(terms.error && !terms.data) || (schedules.error && !schedules.data) ? (
        <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>
          University server unreachable — retrying…
        </div>
      ) : null}
      {(terms.loading && !terms.data) || (schedules.loading && !schedules.data) ? (
        <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12 }}>Loading...</div>
      ) : null}
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Timetable</h1>
      <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>Your weekly lecture and lab schedule</p>
      <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
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
        {ttRows.length === 0 ? (
          <div style={{ padding: '22px', fontSize: 13, color: 'var(--text-lighter)' }}>No schedules published yet</div>
        ) : (
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
                {ttRows.map((row, i) => (
                  <tr key={i} style={{ transition: 'background 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--divider-soft)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                    <td style={{ padding: '12px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-light)', borderBottom: '1px solid var(--divider)', whiteSpace: 'pre-line' }}>{row.time}</td>
                    {['mon', 'tue', 'wed', 'thu', 'fri'].map((day) => {
                      const val = row[day as keyof typeof row];
                      const isLunch = val.includes('Lunch');
                      const isFree = val.includes('Free');
                      return (
                        <td key={day} style={{ padding: '12px 14px', fontSize: 12.5, color: isLunch ? 'var(--text-lighter)' : isFree ? 'var(--text-lighter)' : 'var(--text)', fontStyle: isLunch || isFree ? 'italic' : 'normal', borderBottom: '1px solid var(--divider)', whiteSpace: 'pre-line' }}>
                          {isLunch || isFree ? (
                            <span style={{ fontSize: 12 }}>{val.replace('\u2014 ', '')}</span>
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
          </div>
        )}
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
  const [notifPrefs, setNotifPrefs] = useState({ push: true, emailDigest: false, messageAlerts: true, eventReminders: true });
  const { user: session } = useSession();
  const { profile, loading } = useMyProfile();
  const me = session?.email ?? '';
  const name = profile?.name || session?.name || 'User';

  const notifToggles = [
    { key: 'push', label: 'Push Notifications', desc: 'Receive push notifications on your device' },
    { key: 'emailDigest', label: 'Email Digest', desc: 'Receive daily email digest of updates' },
    { key: 'messageAlerts', label: 'Message Alerts', desc: 'Get notified when you receive new messages' },
    { key: 'eventReminders', label: 'Event Reminders', desc: 'Get reminders about upcoming events' },
  ] as const;

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Settings</h1>
      <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>Manage your account and preferences</p>
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--surface)' }}>
        {['Profile', 'Notifications', 'Appearance', 'Blocked'].map(t => (
          <button key={t} onClick={() => setSettingsTab(t)}
            style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: settingsTab === t ? 'var(--primary)' : 'var(--text-light)', cursor: 'pointer', borderBottom: '2.5px solid transparent', borderBottomColor: settingsTab === t ? 'var(--primary)' : 'transparent', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>{t}</button>
        ))}
      </div>
      {settingsTab === 'Profile' ? (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--surface)' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(to bottom right, var(--secondary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 22, color: 'var(--primary)' }}>{initialsOf(name)}</div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>{loading ? 'Loading...' : name}</h3>
                <p style={{ fontSize: 12, color: 'var(--text-lighter)', margin: '4px 0 0 0' }}>{loading ? '' : profile?.unit || me}</p>
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
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Department</label>
                <input type="text" defaultValue={profile?.unit || ''} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} />
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
      ) : settingsTab === 'Appearance' ? (
        <ThemeSwitcher />
      ) : settingsTab === 'Notifications' ? (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ padding: '24px 28px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>Notification Preferences</h3>
            {notifToggles.map(({ key, label, desc }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--divider)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-lighter)', marginTop: 2 }}>{desc}</div>
                </div>
                <button onClick={() => setNotifPrefs(prev => ({ ...prev, [key]: !prev[key] }))}
                  style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', transition: 'all 0.2s', background: notifPrefs[key] ? 'var(--primary)' : 'var(--surface-hover)' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, transition: 'all 0.2s', left: notifPrefs[key] ? 24 : 3, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
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
