'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent as DragEvt, ReactNode } from 'react';
import { useSupabase } from '@/utils/supabase/client';
import { RollCallHistorySection } from '@/components/lecturer/RollCallHistory';
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
  ArrowLeft, CalendarCog, Clock, Loader2, Lock, Unlock,
  RefreshCw, Trash2, GripVertical, Play, CheckCircle2,
  AlertTriangle, Radio, UserPlus, ChevronDown, Timer,
  XCircle, Blocks, Layers, ShieldCheck, Send, Move,
  ClipboardCheck,
  History,
} from 'lucide-react';
import Link from 'next/link';
import { fmt12h, fmtRange12 } from '@/components/shared/time';
import { useRouter } from 'next/navigation';
import type { StudentData, RollCallData } from '@/components/shared/types';
import {
  apiFetch, markAttendance,
  getRollCallMySchedule, ensureRollCallSession, getRollCallStudents,
} from '@/components/shared/api';
import type {
  RollCallSchedule, RollCallStudentsResponse,
} from '@/components/shared/api';
import {
  getCurrentStaff,
  getGeneration,
  getGenerationManage,
  getGenerationScope,
  getGenerationSchedules,
  getGenerationLobbies,
  getGenerations,
  getExamTypes,
  getCourses,
  getTeachingGroups,
  createTeachingGroup,
  deleteTeachingGroup,
  getTeachingAssignments,
  getPublishedSchedules,
  getTimetableLock,
  acquireTimetableLock,
  heartbeatTimetableLock,
  releaseTimetableLock,
  generateTimetable,
  publishGeneration,
  cancelGeneration,
  swapSchedules,
  publishDragStatus,
  createGenerationLobby,
  joinGenerationLobby,
  inviteLobbyMember,
  cancelGenerationLobby,
  generateFromLobby,
  deleteGeneration,
  getTimetableTimeGrid,
  PERSISTED_PERIOD_LABELS,
  PERSISTED_LUNCH_LABEL,
} from '@/components/shared/api';
import type {
  AcademicTermRecord, AttendanceRecord, ClassSessionRecord,
  StaffRecord, GenerationStatus,
  GenerationManageResponse, GenerationScopeSemester, GenerationSessionResponse,
  ExamTypeResponse, ScheduleResponse, TeachingGroupResponse,
  TeachingAssignmentResponse, TimetableLobbyResponse, TimetableLockResponse,
  CourseRecord, StudentRecord,
} from '@/components/shared/api';
import { useUniversityData } from '@/components/shared/useUniversityData';
import { useTimetableRealtime, TIMETABLE_REALTIME_EVENTS } from '@/lib/supabase/useTimetableRealtime';
import CourseRequirementsPanel from '@/components/lecturer/CourseRequirementsPanel';
export { default as FeedSection } from '@/components/shared/FeedSection';
export { default as MessagesSection } from '@/components/shared/MessagesSection';
export { default as ActivitySection } from '@/components/shared/ActivitySection';

import BlockedSection from '@/components/shared/BlockedSection';

type RollCallRow = RollCallData & { studentId: string };

function initialsOf(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => (w[0] || '').toUpperCase()).join('');
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
          University server unreachable — retrying—
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

export function RollCallSection({ mode = 'today', onViewHistory }: {
  mode?: 'today' | 'schedules';
  onViewHistory?: (scheduleId: string, month: string) => void;
} = {}) {
  const isSchedulesMode = mode === 'schedules';
  const [schedules, setSchedules] = useState<RollCallSchedule[] | null>(null);
  const [scheduleId, setScheduleId] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPhase, setModalPhase] = useState<'confirm' | 'form'>('confirm');
  const [modalLoading, setModalLoading] = useState(false);
  const [mOccurrence, setMOccurrence] = useState('');
  const [roster, setRoster] = useState<RollCallStudentsResponse | null>(null);
  const [rows, setRows] = useState<{
    studentId: string; rollNo: string; name: string;
    present: boolean; checked: Set<string>; remark: string;
    attendanceId: string | null;
  }[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedInfo, setSubmittedInfo] = useState<{ scheduleId: string; month: string } | null>(null);
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const pendingRef = useRef<{ sessionId: string; entries: unknown[] } | null>(null);
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  // Today tab records TODAY only; Schedules tab uses its own picked month/day.
  const [sessionDateToday] = useState(todayIso);
  const [occMonth, setOccMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selCourseCode, setSelCourseCode] = useState('');
  const [selDay, setSelDay] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    getRollCallMySchedule()
      .then((list) => { if (alive) setSchedules(list); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Failed to load schedule'); });
    return () => { alive = false; };
  }, []);

  // ---- Schedules-mode cascade (course -> day -> valid dates), all derived ----
  const courseCodes = useMemo(
    () => [...new Set((schedules ?? []).map((s) => s.courseCode))].sort(),
    [schedules]);
  const effCourseCode = courseCodes.includes(selCourseCode)
    ? selCourseCode
    : (courseCodes[0] ?? '');
  const courseSchedules = useMemo(
    () => (schedules ?? []).filter((s) => s.courseCode === effCourseCode),
    [schedules, effCourseCode]);
  const courseDays = useMemo(
    () => [...new Set(courseSchedules.map((s) => s.dayOfWeek))].sort((a, b) => a - b),
    [courseSchedules]);
  const effDay: number | null =
    selDay !== null && courseDays.includes(selDay)
      ? selDay
      : (courseDays[0] ?? null);
  const daySchedules = useMemo(
    () => (effDay !== null
      ? courseSchedules.filter((s) => s.dayOfWeek === effDay)
      : []),
    [courseSchedules, effDay]);

  // Valid calendar dates for the selected teaching day within occMonth.
  // Derived ONLY from the timetable weekday of the selected day - never from
  // a generic Monday-Sunday calendar.
  const validDates = useMemo(() => {
    if (isSchedulesMode && effDay === null) return [] as string[];
    if (!isSchedulesMode) return [todayIso];
    const [y, m] = occMonth.split('-').map(Number);
    if (!y || !m) return [] as string[];
    const dates: string[] = [];
    const d = new Date(Date.UTC(y, m - 1, 1));
    while (d.getUTCMonth() === m - 1) {
      if (d.getUTCDay() % 7 === effDay % 7 || ((d.getUTCDay() === 0 ? 7 : d.getUTCDay()) === effDay)) {
        dates.push(d.toISOString().slice(0, 10));
      }
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return dates;
  }, [isSchedulesMode, effDay, occMonth, todayIso]);

  // Derived occurrence date: in Schedules mode, snap mOccurrence to the
  // nearest valid date for the selected day. Falls back to the first valid
  // date if the current selection doesn't match the teaching weekday.
  const effOccurrence = useMemo(() => {
    if (!isSchedulesMode) return sessionDateToday;
    if (validDates.length === 0) return '';
    return validDates.includes(mOccurrence) ? mOccurrence : validDates[0];
  }, [isSchedulesMode, validDates, mOccurrence, sessionDateToday]);

  // in Schedules mode, so the class cards always have a valid date context.
  useEffect(() => {
  }, [isSchedulesMode, validDates, mOccurrence]);

  const selected = schedules?.find((s) => s.scheduleId === scheduleId) ?? null;
  const todays = (schedules ?? []).filter((s) => s.dayName === todayName);

  // Two-phase modal: phase 'confirm' asks "Start Roll Call?" — creates
  // NOTHING. Clicking "Start" calls ensureSessionOn (create/reuse) THEN
  // loads students WITH the returned sessionId so existing attendance is
  // pre-filled. The CLASS_SESSION identity flows through the whole flow.
  const openConfirm = (sid: string, date: string) => {
    setScheduleId(sid);
    setMOccurrence(date);
    setRoster(null);
    setRows([]);
    setPage(1);
    setError(null);
    setModalPhase('confirm');
    setModalOpen(true);
  };

  const startRollCall = async () => {
    setModalPhase('form');
    setModalLoading(true);
    setError(null);
    try {
      // 1. Create/reuse the session for schedule_id + occurrence date.
      const sess = await ensureRollCallSession(scheduleId, mOccurrence);
      // 2. Load students WITH existing attendance for that exact session.
      const data = await getRollCallStudents(scheduleId, sess.sessionId);
      setRoster(data);
      setRows(data.students.map((st) => ({
        studentId: st.studentId,
        rollNo: st.rollNo,
        name: st.studentName,
        attendanceId: st.attendanceId,
        present: st.attendanceStatus === 'PRESENT',
        checked: new Set(
          st.attendanceStatus === 'PRESENT'
            ? (st.attendedSlotIds.length > 0
                ? st.attendedSlotIds
                : data.slots.map((sl) => sl.slotId))
            : []
        ),
        remark: st.remark ?? '',
      })));
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load students');
    } finally {
      setModalLoading(false);
    }
  };

  const buildEntries = () => {
    if (!roster) return [];
    const order = roster.slots.map((sl) => sl.slotId);
    return rows.map((r) => {
      const present = r.present && r.checked.size > 0;
      let startId: string | null = null;
      let endId: string | null = null;
      if (present) {
        const idxs = order.map((id, i) => (r.checked.has(id) ? i : -1)).filter((i) => i >= 0);
        const contiguous = idxs.length > 0 && idxs.every((v, k) => k === 0 || v === idxs[k - 1] + 1);
        if (!contiguous) throw new Error('Attendance periods must be consecutive.');
        startId = order[idxs[0]];
        endId = order[idxs[idxs.length - 1]];
      }
      return {
        studentId: r.studentId,
        attendanceStatus: present ? ('PRESENT' as const) : ('ABSENT' as const),
        remark: r.remark || undefined,
        attendanceStartSlotId: startId,
        attendanceEndSlotId: endId,
      };
    });
  };

  // Submit: creates/reuses the CLASS_SESSION for THIS occurrence date, then
  // saves attendance transactionally. Opening the modal never wrote anything.
  const doSubmit = async (forceUpdate: boolean) => {
    if (!selected || !mOccurrence || busy) return;
    setBusy(true); setError(null);
    try {
      const sess = await ensureRollCallSession(selected.scheduleId, mOccurrence);
      const existing = await getRollCallStudents(selected.scheduleId, sess.sessionId);
      const hasPrior = existing.students.some((st) => st.attendanceId);
      if (hasPrior && !forceUpdate) {
        setShowUpdateConfirm(true);
        return;
      }
      await markAttendance(sess.sessionId, buildEntries() as never);
      toast.success(forceUpdate ? 'Roll Call updated successfully.' : 'Roll Call submitted successfully.');
      setSubmittedInfo({ scheduleId: selected.scheduleId, month: mOccurrence.slice(0, 7) });
      setModalOpen(false);
      const list = await getRollCallMySchedule();
      setSchedules(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  const togglePresent = (studentId: string, present: boolean) => {
    setRows((prev) => prev.map((r) => {
      if (r.studentId !== studentId) return r;
      if (!present) return { ...r, present: false, checked: new Set<string>() };
      const all = new Set<string>(roster?.slots.map((sl) => sl.slotId) ?? []);
      return { ...r, present: true, checked: all };
    }));
  };

  const toggleSlot = (studentId: string, slotId: string) => {
    setRows((prev) => prev.map((r) => {
      if (r.studentId !== studentId) return r;
      const next = new Set(r.checked);
      if (next.has(slotId)) next.delete(slotId); else next.add(slotId);
      return { ...r, checked: next, present: next.size > 0 };
    }));
  };

  const openHistory = (sid: string, month: string) => {
    if (onViewHistory) onViewHistory(sid, month);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardCheck size={20} /> {isSchedulesMode ? 'Schedules Roll Call' : "Today's Roll Call"}
          </h1>
          <div style={{ fontSize: 12.5, color: 'var(--text-light)' }}>
            {isSchedulesMode
              ? <>Any scheduled timetable day &middot; previous / today / upcoming</>
              : <>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</>}
          </div>
        </div>
        {onViewHistory ? (
          <button onClick={() => onViewHistory(scheduleId || (submittedInfo?.scheduleId ?? ''), occMonth)}
            className="btn btn-ghost btn-sm" style={{ border: '1.5px solid var(--surface-border)' }}>
            <History size={14} /> Roll Call History
          </button>
        ) : (
          <Link href="/lecturer/roll-call-history" className="btn btn-ghost btn-sm" style={{ border: '1.5px solid var(--surface-border)' }}>
            <History size={14} /> Roll Call History
          </Link>
        )}
      </div>

      {/* Schedules mode controls: Course / Teaching days / Month */}
      {isSchedulesMode && (
        <div className="flex items-end gap-3 flex-wrap mb-4">
          <label style={{ fontSize: 12, color: 'var(--text-light)', display: 'grid', gap: 2 }}>
            Course
            <select value={effCourseCode} onChange={(e) => { setSelCourseCode(e.target.value); setSelDay(null); }}
              className="btn btn-ghost btn-sm cursor-pointer" style={{ border: '1.5px solid var(--surface-border)', minWidth: 160 }}>
              {courseCodes.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: 'var(--text-light)', display: 'grid', gap: 2 }}>
            Month
            <input type="month" value={occMonth}
              onChange={(e) => { if (/^\d{4}-\d{2}$/.test(e.target.value)) setOccMonth(e.target.value); }}
              className="btn btn-ghost btn-sm" style={{ border: '1.5px solid var(--surface-border)' }} />
          </label>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4" style={{ borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.3)', color: 'var(--danger)', fontSize: 12.5 }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Teaching-day chips (Schedules) or Today card header (Today) */}
      <div className="mb-5" style={{ border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-lg)', background: 'var(--surface-soft)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--surface-border)', fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>
          {isSchedulesMode
            ? <>Available Schedule Days &mdash; {occMonth}</>
            : <>Today&rsquo;s Roll Call &mdash; {todayName}</>}
        </div>

        {isSchedulesMode && courseDays.length === 0 && (
          <div style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text-light)' }}>
            No assigned courses available.
          </div>
        )}

        {isSchedulesMode && (
          <div style={{ padding: '10px 18px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {courseDays.map((dow) => {
              const active = effDay === dow;
              return (
                <button key={dow} onClick={() => setSelDay(dow)}
                  className="btn btn-xs cursor-pointer"
                  style={{
                    border: '1.5px solid ' + (active ? 'var(--primary)' : 'var(--surface-border)'),
                    background: active ? 'rgba(35,96,138,0.12)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text)',
                    fontWeight: active ? 700 : 500,
                  }}>
                  {DOW_NAMES[dow]}
                </button>
              );
            })}
          </div>
        )}

        {/* Valid dates for the selected teaching day */}
        {isSchedulesMode && (
          <div style={{ padding: '10px 18px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {validDates.length === 0 && (
              <span style={{ fontSize: 13, color: 'var(--text-light)' }}>No dates in this month.</span>
            )}
            {validDates.map((v) => {
              const active = v === effOccurrence;
              const rel = v < todayIso ? 'Past' : v === todayIso ? 'Today' : 'Upcoming';
              return (
                <button key={v}
                  onClick={() => setMOccurrence(v)}
                  className="btn btn-xs cursor-pointer"
                  style={{
                    border: '1.5px solid ' + (active ? 'var(--primary)' : 'var(--surface-border)'),
                    background: active ? 'rgba(35,96,138,0.14)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text)',
                    fontWeight: active ? 700 : 500,
                  }}>
                  {new Date(v + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>{rel}</span>
                </button>
              );
            })}
          </div>
        )}

        {!isSchedulesMode && schedules === null && (
          <div style={{ padding: '14px 18px' }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--surface)' }}>
                <div style={{ width: 60, height: 12, borderRadius: 4, background: 'var(--surface-border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ width: 200, height: 12, borderRadius: 4, background: 'var(--surface-border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              </div>
            ))}
          </div>
        )}
        {!isSchedulesMode && todays.length === 0 && (
          <div style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text-light)' }}>
            No classes scheduled for today.
          </div>
        )}

        {(isSchedulesMode ? daySchedules : todays).map((s) => {
          const isSel = s.scheduleId === scheduleId;
          // Compute PAST / CURRENT / UPCOMING from actual wall-clock times
          const nowT = new Date().getHours() * 60 + new Date().getMinutes();
          const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
          const startM = toMin(s.startTime), endM = toMin(s.endTime);
          const timeStatus = nowT >= startM && nowT < endM ? 'CURRENT' : nowT >= endM ? 'PAST' : 'UPCOMING';
          const statusLabel = s.todaySessionCompleted ? 'Completed' : s.todaySessionId ? 'Pending' : timeStatus === 'CURRENT' ? 'Current' : timeStatus === 'PAST' ? 'Past' : 'Upcoming';
          const statusColor = s.todaySessionCompleted ? '#16a34a' : timeStatus === 'CURRENT' ? 'var(--primary)' : timeStatus === 'PAST' ? 'var(--text-light)' : 'var(--warning)';
          return (
            <button key={s.scheduleId}
              onClick={() => openConfirm(s.scheduleId, isSchedulesMode ? effOccurrence : todayIso)}
              className="w-full text-left cursor-pointer"
              style={{
                padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10,
                borderBottom: '1px solid var(--surface)',
                background: isSel ? 'rgba(35,96,138,0.08)' : 'transparent',
              }}>
              <span style={{ fontSize: 16 }}>
                {s.todaySessionCompleted ? '\u2611' : s.todaySessionId ? '\u2610' : '\u25CB'}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {fmtRange12(s.startTime, s.endTime)} &nbsp;{s.courseCode} &mdash; Sem {s.semesterNo ?? '?'} {s.sectionNames.join('+')}
              </span>
              {!isSchedulesMode && (
                <span className="badge badge-xs" style={{
                  marginLeft: 'auto',
                  background: timeStatus === 'CURRENT' ? 'rgba(35,96,138,0.14)' : 'transparent',
                  color: timeStatus === 'CURRENT' ? 'var(--accent)' : 'var(--text-light)',
                  fontWeight: timeStatus === 'CURRENT' ? 700 : 400,
                }}>
                  {statusLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected && !modalOpen && (
        <div className="mb-4 flex items-center gap-2 flex-wrap" style={{ fontSize: 13 }}>
          <span className="badge" style={{ background: 'rgba(35,96,138,0.12)', color: 'var(--accent)', border: 'none', fontWeight: 700 }}>
            {selected.courseCode} &mdash; {selected.courseName}
          </span>
          <span className="badge badge-xs">Semester {selected.semesterNo ?? '?'}</span>
          <span className="badge badge-xs">{selected.sectionNames.join(' + ')}</span>
          <span className="badge badge-xs">{fmtRange12(selected.startTime, selected.endTime)}</span>
          <span className="badge badge-xs">{selected.periodCount} periods</span>
          <span className="badge badge-xs">Click to open Roll Call</span>
        </div>
      )}

      {submittedInfo && (
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4 px-4 py-3"
          style={{ borderRadius: 'var(--radius-md)', background: 'rgba(34,197,94,0.10)', border: '1.5px solid rgba(34,197,94,0.35)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>
            Roll Call submitted successfully.
          </span>
          {onViewHistory ? (
            <button onClick={() => onViewHistory(submittedInfo.scheduleId, submittedInfo.month)}
              className="btn btn-sm btn-primary cursor-pointer">
              View Roll Call History
            </button>
          ) : (
            <Link href={`/lecturer/roll-call-history?scheduleId=${submittedInfo.scheduleId}&month=${submittedInfo.month}`}
              className="btn btn-sm btn-primary cursor-pointer">
              View Roll Call History
            </Link>
          )}
        </div>
      )}

      {/* ================= Attendance modal ================= */}
      {modalOpen && (
        <div role="dialog" aria-modal="true"
          className="fixed inset-0 z-40 flex items-center justify-center p-6"
          style={{ background: 'rgba(15,23,42,0.45)' }}
          onClick={() => { if (!busy) setModalOpen(false); }}>
          <div className="w-full max-w-2xl rounded-xl flex flex-col"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', maxHeight: '85vh' }}
            onClick={(e) => e.stopPropagation()}>

            {/* fixed header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface-border)' }} className="flex items-start justify-between gap-3">
              <div>
                <h3 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>Roll Call</h3>
                {selected && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{selected.courseCode} &middot; {selected.courseName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                      Semester {selected.semesterNo ?? '?'} &middot; {selected.sectionNames.join(' + ')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                      {new Date(mOccurrence + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      {' \u00B7 '}
                      {fmtRange12(selected.startTime, selected.endTime)}
                      {' \u00B7 '}
                      {selected.periodCount} periods
                    </div>
                  </>
                )}
              </div>
              <button className="btn btn-ghost btn-sm cursor-pointer" onClick={() => { if (!busy) setModalOpen(false); }}>&#10005;</button>
            </div>

            {/* scrollable body */}
            <div className="flex-1 overflow-y-auto" style={{ padding: '14px 20px', minHeight: 260 }}>
              {modalPhase === 'confirm' && !modalLoading && selected && (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                    Start Roll Call for {selected.courseCode}?
                  </p>
                  <p style={{ fontSize: 12.5, color: 'var(--text-light)', marginBottom: 16 }}>
                    Semester {selected.semesterNo} &middot; Section {selected.sectionNames.join(' + ')}
                    &middot; {mOccurrence}
                  </p>
                  <button className="btn btn-primary btn-sm cursor-pointer"
                    onClick={() => { void startRollCall(); }}>
                    Start Roll Call
                  </button>
                </div>
              )}
              {modalPhase === 'form' && modalLoading && (
                <div>
                  {[...Array(6)].map((_, i) => (
                    <div key={i} style={{ display: 'flex', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--surface)' }}>
                      <div style={{ width: 140, height: 14, borderRadius: 4, background: 'var(--surface-border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                      <div style={{ width: 60, height: 14, borderRadius: 4, background: 'var(--surface-border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                      <div style={{ width: 180, height: 14, borderRadius: 4, background: 'var(--surface-border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    </div>
                  ))}
                  <div style={{ textAlign: 'center', paddingTop: 12, fontSize: 13, color: 'var(--text-light)' }}>Loading students&hellip;</div>
                </div>
              )}
              {modalPhase === 'form' && !modalLoading && roster && (
                <table className="table w-full">
                  <thead>
                    <tr style={{ fontSize: 11 }}>
                      <th>Student</th><th>Status</th><th>Periods</th><th>Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => (
                      <tr key={r.studentId}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{r.rollNo}</div>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button onClick={() => togglePresent(r.studentId, true)} className="btn btn-xs"
                              style={{ background: r.present ? 'var(--success)' : 'var(--secondary)', color: r.present ? '#fff' : 'var(--text)', border: 'none' }}>Present</button>
                            <button onClick={() => togglePresent(r.studentId, false)} className="btn btn-xs"
                              style={{ background: !r.present ? 'var(--danger)' : 'var(--secondary)', color: !r.present ? '#fff' : 'var(--text)', border: 'none' }}>Absent</button>
                          </div>
                        </td>
                        <td>
                          {r.present && roster.slots.length > 0 ? (
                            <div className="flex gap-2 flex-wrap">
                              {roster.slots.map((sl) => (
                                <label key={sl.slotId} className="flex items-center gap-1 cursor-pointer" style={{ fontSize: 11 }}
                                  onClick={(e) => { e.preventDefault(); toggleSlot(r.studentId, sl.slotId); }}>
                                  <input type="checkbox" readOnly checked={r.checked.has(sl.slotId)} style={{ pointerEvents: 'none' }} />
                                  {fmt12h(sl.startTime)}
                                </label>
                              ))}
                            </div>
                          ) : <span style={{ color: 'var(--text-light)', fontSize: 12 }}>—</span>}
                        </td>
                        <td>
                          <input value={r.remark}
                            onChange={(e) => { const v = e.target.value; setRows((prev) => prev.map((x) => x.studentId === r.studentId ? { ...x, remark: v } : x)); }}
                            placeholder="late / medical / …"
                            style={{ width: 130, padding: '5px 8px', fontSize: 12, border: '1.5px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)' }} />
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-6" style={{ color: 'var(--text-light)' }}>
                        No students found for this course and section.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* fixed footer: pagination + actions */}
            <div style={{ borderTop: '1px solid var(--surface-border)', padding: '12px 20px' }} className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2" style={{ fontSize: 12 }}>
                <button className="btn btn-xs cursor-pointer" disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}>&lt; Previous</button>
                <span>Page {page} of {Math.max(1, Math.ceil(rows.length / PAGE_SIZE))}</span>
                <button className="btn btn-xs cursor-pointer" disabled={page >= Math.ceil(rows.length / PAGE_SIZE)}
                  onClick={() => setPage((p) => p + 1)}>Next &gt;</button>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-sm cursor-pointer" onClick={() => { if (!busy) setModalOpen(false); }}>Cancel</button>
                <button onClick={() => { void doSubmit(false); }} disabled={busy || rows.length === 0}
                  className="btn btn-sm gap-2 text-white cursor-pointer disabled:opacity-50"
                  style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', border: 'none' }}>
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Submit Roll Call
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update-existing confirmation (above modal) */}
      {showUpdateConfirm && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(15,23,42,0.55)' }} onClick={() => setShowUpdateConfirm(false)}>
          <div className="w-full max-w-sm rounded-xl" style={{ background: 'var(--surface)', border: '1.5px solid var(--primary)', padding: 20 }}
            onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Roll Call already exists</h3>
            <p style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              Attendance has already been submitted for this scheduled class.
              Do you want to update it?
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn btn-ghost btn-sm cursor-pointer" onClick={() => setShowUpdateConfirm(false)}>Cancel</button>
              <button className="btn btn-sm btn-primary cursor-pointer"
                onClick={() => { setShowUpdateConfirm(false); void doSubmit(true); }}>
                Update Roll Call
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** ISO day-of-week (1=Monday … 7=Sunday) — matches java.time.DayOfWeek.getValue(). */
const DOW_NAMES: Record<number, string> = {
  1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday',
  5: 'Friday', 6: 'Saturday', 7: 'Sunday',
};
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
const GRID_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
const GRID_COLUMN_HEADERS = ['P1', 'P2', 'P3', 'LUNCH', 'P4', 'P5', 'P6'] as const;
const LUNCH_HEADER_COL = 3;
const GRID_COLUMNS = '96px repeat(7, minmax(122px, 1fr))';
const GRID_CELL_MIN_HEIGHT = 112;
const GENERATION_FALLBACK_MS = 45000;
// Multi-section scopes solve asynchronously and can legitimately run for
// several minutes on degraded database days (remote pooler, stale pooled
// connections being revalidated, dropped SSE streams). The old 15s grace
// declared "took too long" at ~60s while the server was still solving
// successfully, so give background solves a generous 10-minute budget.
const GENERATION_GRACE_MS = 10 * 60 * 1000;
const SCHEDULE_LOCK_POLL_MS = 4000;
const DRAG_BROADCAST_MS = 150;

const MEMBER_COLORS = [
  'from-primary to-secondary',
  'from-info to-info/70',
  'from-warning to-warning/70',
  'from-success to-success/70',
  'from-error to-error/70',
] as const;

/**
 * Period time labels come from the persisted TimeSlot configuration
 * (GET /api/time-slots), normalized onto the authoritative 09:00-16:00 grid
 * (P1=09:00-10:00 — P6=15:00-16:00, Lunch=12:00-13:00). A hardcoded fallback
 * of the exact persisted values is used only while the request is in flight
 * or when the server is unreachable.
 */
interface TimeSlotLabels {
  periodLabels: string[];
  lunchLabel: string;
}

function useTimeSlotLabels(): TimeSlotLabels {
  const [labels, setLabels] = useState<TimeSlotLabels>({
    periodLabels: [...PERSISTED_PERIOD_LABELS],
    lunchLabel: PERSISTED_LUNCH_LABEL,
  });
  useEffect(() => {
    let on = true;
    getTimetableTimeGrid().then((grid) => {
      if (!on) return;
      setLabels({ periodLabels: grid.periodLabels, lunchLabel: grid.lunchLabel });
    });
    return () => {
      on = false;
    };
  }, []);
  return labels;
}

function generationEventLabel(type: string): string {
  switch (type) {
    case 'GENERATION_STARTED': return 'Timetable generation started';
    case 'GENERATION_COMPLETED': return 'Timetable generated successfully';
    case 'GENERATION_FAILED': return 'Timetable generation failed';
    case 'TIMETABLE_PUBLISHED': return 'Timetable published';
    case 'TIMETABLE_DELETED': return 'Timetable draft deleted';
    case 'SCHEDULE_CREATED': return 'Schedule created';
    case 'SCHEDULE_UPDATED': return 'Schedule updated';
    case 'SCHEDULE_DELETED': return 'Schedule removed';
    case 'SCHEDULE_LOCKED': return 'Editing lock acquired';
    case 'SCHEDULE_UNLOCKED': return 'Editing lock released';
    case 'DRAG_STARTED': return 'Schedule drag started';
    case 'DRAG_MOVED': return 'Schedule dragged';
    case 'DRAG_ENDED': return 'Schedule drag ended';
    case 'LOBBY_MEMBER_JOINED': return 'New member joined the lobby';
    case 'LOBBY_CANCELLED': return 'Generation lobby cancelled';
    case 'TEACHING_GROUP_CREATED': return 'Combined class created';
    case 'TEACHING_GROUP_DELETED': return 'Combined class removed';
    case 'COURSE_REQUIREMENT_CREATED': return 'Meeting requirement added';
    case 'COURSE_REQUIREMENT_UPDATED': return 'Meeting requirement updated';
    case 'COURSE_REQUIREMENT_DELETED': return 'Meeting requirement removed';
    default: return type;
  }
}

const TIMETABLE_EVENT_COLORS: Record<string, string> = {
  GENERATION_STARTED: '#d97706',
  GENERATION_COMPLETED: '#059669',
  GENERATION_FAILED: '#dc2626',
  TIMETABLE_PUBLISHED: '#2872a1',
  TIMETABLE_DELETED: '#dc2626',
  SCHEDULE_CREATED: '#059669',
  SCHEDULE_UPDATED: '#3b82f6',
  SCHEDULE_DELETED: '#dc2626',
  SCHEDULE_LOCKED: '#d97706',
  SCHEDULE_UNLOCKED: '#059669',
  DRAG_STARTED: '#8b5cf6',
  DRAG_MOVED: '#8b5cf6',
  DRAG_ENDED: '#8b5cf6',
  LOBBY_MEMBER_JOINED: '#3b82f6',
  LOBBY_CANCELLED: '#dc2626',
};

function statusLabel(status: GenerationStatus): string {
  switch (status) {
    case 'PENDING': return 'Draft';
    case 'GENERATING': return 'Generating';
    case 'COMPLETED': return 'Generated';
    case 'FAILED': return 'Failed';
    case 'PUBLISHED': return 'Published';
  }
}

function statusColor(status: GenerationStatus): string {
  switch (status) {
    case 'PENDING': return '#64748b';
    case 'GENERATING': return '#d97706';
    case 'COMPLETED': return '#059669';
    case 'FAILED': return '#dc2626';
    case 'PUBLISHED': return '#2872a1';
  }
}

interface TimetableEvent {
  id: string;
  type: string;
  label: string;
  time: number;
}

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
  action: () => Promise<void> | void;
}

interface RemoteDragState {
  scheduleId: string;
  staffName: string;
  day: number | null;
  period: number | null;
}

interface PendingSwapState {
  scheduleId: string;
  withScheduleId: string;
  targetDay: number;
  targetPeriod: number;
  conflicts: string[] | null;
}

function eventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function pushEvent(
  setHistory: (updater: (prev: TimetableEvent[]) => TimetableEvent[]) => void,
  type: string,
) {
  setHistory((prev) => [
    { id: eventId(), type, label: generationEventLabel(type), time: Date.now() },
    ...prev,
  ].slice(0, 60));
}

const SCHEDULE_TYPE_META: Record<string, { label: string; fg: string; bg: string; cardBg: string; cardBorder: string }> = {
  COURSE: {
    label: 'Lecture',
    fg: 'var(--primary)',
    bg: 'rgba(40,114,161,0.15)',
    cardBg: 'linear-gradient(135deg, rgba(40,114,161,0.14), rgba(40,114,161,0.05))',
    cardBorder: '1.5px solid rgba(40,114,161,0.35)',
  },
  LAB: {
    label: 'Lab',
    fg: '#059669',
    bg: 'rgba(16,185,129,0.15)',
    cardBg: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.05))',
    cardBorder: '1.5px solid rgba(16,185,129,0.35)',
  },
  LMS: {
    label: 'LMS',
    fg: '#7c3aed',
    bg: 'rgba(139,92,246,0.15)',
    cardBg: 'linear-gradient(135deg, rgba(139,92,246,0.14), rgba(139,92,246,0.05))',
    cardBorder: '1.5px solid rgba(139,92,246,0.35)',
  },
  ASSIGNMENT: {
    label: 'Assignment',
    fg: '#d97706',
    bg: 'rgba(251,191,36,0.15)',
    cardBg: 'linear-gradient(135deg, rgba(251,191,36,0.14), rgba(251,191,36,0.05))',
    cardBorder: '1.5px solid rgba(251,191,36,0.35)',
  },
  BREAK: {
    label: 'Break',
    fg: '#64748b',
    bg: 'rgba(100,116,139,0.15)',
    cardBg: 'linear-gradient(135deg, rgba(100,116,139,0.14), rgba(100,116,139,0.05))',
    cardBorder: '1.5px solid rgba(100,116,139,0.35)',
  },
};

function ScheduleTypeBadge({ type }: { type: string }) {
  const meta = SCHEDULE_TYPE_META[type] ?? SCHEDULE_TYPE_META.COURSE;
  return (
    <span
      className="badge badge-xs"
      style={{
        background: meta.bg,
        color: meta.fg,
        border: 'none',
        fontWeight: 700,
      }}
    >
      {meta.label}
    </span>
  );
}

function ScheduleCard({
  schedule,
  editable,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  schedule: ScheduleResponse;
  editable: boolean;
  onDragStart?: (e: DragEvt<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onClick?: () => void;
}) {
  const cancelled = schedule.scheduleStatus === 'CANCELLED';
  const meta = SCHEDULE_TYPE_META[schedule.scheduleType] ?? SCHEDULE_TYPE_META.COURSE;
  const isSpecial = schedule.scheduleType !== 'COURSE';
  const cardBg = cancelled ? 'var(--divider)' : meta.cardBg;
  return (
    <div
      draggable={editable && !isSpecial}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      title={isSpecial
        ? meta.label
        : `${schedule.courseCode} \u00b7 ${schedule.courseName}${schedule.staffNames.length > 0 ? ' \u00b7 ' + schedule.staffNames.join(', ') : schedule.staffName ? ' \u00b7 ' + schedule.staffName : ''}`}
      className={editable && !isSpecial ? 'cursor-grab active:cursor-grabbing' : ''}
      style={{
        background: cardBg,
        border: cancelled ? '1.5px solid var(--surface-border)' : meta.cardBorder,
        borderRadius: 'var(--radius-md)',
        padding: '6px 10px',
        width: '100%',
        minWidth: 0,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        opacity: cancelled ? 0.55 : 1,
        position: 'relative',
        overflow: 'hidden',
        pointerEvents: 'auto',
        boxSizing: 'border-box',
      }}
    >
      <span
        title={isSpecial ? meta.label : schedule.courseCode}
        style={{
          fontSize: isSpecial ? 11 : 13.5,
          fontWeight: 800,
          color: cancelled ? 'var(--text-lighter)' : 'var(--accent)',
          letterSpacing: '0.2px',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'center',
        }}
      >
        {isSpecial ? meta.label.toUpperCase() : schedule.courseCode}
      </span>
      {editable && !isSpecial && (
        <GripVertical size={12} style={{ color: 'var(--text-lighter)', position: 'absolute', top: 6, right: 6 }} />
      )}
      {cancelled && (
        <span className="badge badge-xs" style={{ background: 'rgba(239,68,68,0.15)', color: '#dc2626', border: 'none', fontWeight: 700 }}>
          Cancelled
        </span>
      )}
    </div>
  );
}

const dayNameOf = (day: number) => GRID_DAY_NAMES[day - 1] ?? `Day ${day}`;
const slotTextOf = (s: ScheduleResponse) =>
  `${dayNameOf(s.dayOfWeek)} P${s.startPeriodNo}${s.endPeriodNo > s.startPeriodNo ? '-' + s.endPeriodNo : ''}`;
const meetingLabelOf = (s: ScheduleResponse) => {
  const meta = SCHEDULE_TYPE_META[s.scheduleType] ?? SCHEDULE_TYPE_META.COURSE;
  const span = s.endPeriodNo - s.startPeriodNo + 1;
  return `${meta.label} \u2014 ${span} period${span === 1 ? '' : 's'}`;
};

/**
 * One visual frame for legitimately co-located elective courses that share the
 * exact same semester + section + day + period window (the only same-cohort
 * overlap the backend validation allows). Every course code stays visible;
 * codes wrap inside the frame and never escape the cell.
 */
function ElectiveCard({ items, onClick }: { items: ScheduleResponse[]; onClick?: () => void }) {
  const cancelled = items.every((s) => s.scheduleStatus === 'CANCELLED');
  const meta = SCHEDULE_TYPE_META[items[0]?.scheduleType] ?? SCHEDULE_TYPE_META.COURSE;
  const title = items
    .map((s) => `${s.courseCode} \u00b7 ${s.courseName}${s.staffNames.length > 0 ? ' \u00b7 ' + s.staffNames.join(', ') : s.staffName ? ' \u00b7 ' + s.staffName : ''}`)
    .join('\n');
  return (
    <div
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      title={title}
      className={onClick ? 'cursor-pointer' : ''}
      style={{
        background: cancelled ? 'var(--divider)' : meta.cardBg,
        border: cancelled ? '1.5px solid var(--surface-border)' : meta.cardBorder,
        borderRadius: 'var(--radius-md)',
        padding: '6px 10px',
        height: '100%',
        minHeight: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        opacity: cancelled ? 0.55 : 1,
        position: 'relative',
        overflow: 'hidden',
        pointerEvents: 'auto',
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: cancelled ? 'var(--text-lighter)' : 'var(--accent)',
          letterSpacing: '0.1px',
          lineHeight: 1.45,
          textAlign: 'center',
          maxWidth: '100%',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
          overflow: 'hidden',
        }}
      >
        {items.map((s) => s.courseCode).join(' / ')}
      </span>
      <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--text-lighter)', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
        {items.length} electives
      </span>
    </div>
  );
}

interface WeeklyTimetableGridProps {
  schedules: ScheduleResponse[];
  editable: boolean;
  periodLabels: string[];
  lunchLabel: string;
  todayIdx?: number;
  dragTarget?: { day: number; period: number } | null;
  remoteDrag?: RemoteDragState | null;
  onDragOver?: (e: DragEvt<HTMLDivElement>, day: number, period: number) => void;
  onDrop?: (e: DragEvt<HTMLDivElement>, day: number, period: number) => void;
  onDragStart?: (e: DragEvt<HTMLDivElement>, schedule: ScheduleResponse) => void;
  onDragEnd?: () => void;
  onSelectSchedule?: (schedule: ScheduleResponse) => void;
  onSelectElectives?: (items: ScheduleResponse[]) => void;
  onCellClick?: (day: number, period: number) => void;
}

const periodOfColumn = (ci: number) => (ci < LUNCH_HEADER_COL ? ci + 1 : ci);

const windowKeyOf = (s: ScheduleResponse) => `${s.startPeriodNo}|${s.endPeriodNo}`;

/**
 * Grouping key for the timetable presentation: semester + section + weekday +
 * period. Schedules from different semesters or sections must never share a
 * visual cell — each cohort gets its own table.
 */
const groupSchedulesByCohort = (schedules: ScheduleResponse[]): { semesterNo: number; section: string; items: ScheduleResponse[] }[] => {
  const map = new Map<string, { semesterNo: number; section: string; items: ScheduleResponse[] }>();
  for (const s of schedules) {
    const semesterNo = s.semesterNo ?? 0;
    const sections = (s.sections && s.sections.length > 0 ? s.sections : s.sectionName ? [s.sectionName] : [])
      .map((x) => String(x).trim())
      .filter(Boolean);
    for (const section of sections) {
      const key = `${semesterNo}|${section}`;
      const group = map.get(key) ?? { semesterNo, section, items: [] };
      if (!map.has(key)) map.set(key, group);
      group.items.push(s);
    }
  }
  // LMS / ASSIGNMENT fillers are stored section-less (schema requires null
  // assignment/group), so they arrive with no cohort attribution. They belong
  // in EVERY cohort table whose courses do not already occupy their slot -
  // that is exactly the slot the solver verified as free for that section.
  // Fillers must never CREATE a cohort table, only join existing ones.
  for (const s of schedules) {
    if (s.scheduleType === 'COURSE') continue;
    for (const group of map.values()) {
      const occupied = group.items.some((c) =>
        c.scheduleType === 'COURSE' &&
        c.dayOfWeek === s.dayOfWeek &&
        c.startPeriodNo <= s.endPeriodNo &&
        c.endPeriodNo >= s.startPeriodNo
      );
      if (!occupied) group.items.push(s);
    }
  }
  return [...map.values()].sort(
    (a, b) => a.semesterNo - b.semesterNo || a.section.localeCompare(b.section)
  );
};

function WeeklyTimetableGrid({
  schedules,
  editable,
  periodLabels,
  todayIdx = -1,
  dragTarget = null,
  remoteDrag = null,
  onDragOver,
  onDrop,
  onDragStart,
  onDragEnd,
  onSelectSchedule,
  onSelectElectives,
  onCellClick,
}: WeeklyTimetableGridProps) {
  const groups = useMemo(() => groupSchedulesByCohort(schedules), [schedules]);

  const renderCohortGrid = (items: ScheduleResponse[]) => (
    <div style={{ display: 'grid', gap: 1, minWidth: 940, gridTemplateColumns: GRID_COLUMNS }}>
      <div
        style={{
          padding: '9px 10px',
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-light)',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        Day
      </div>
      {GRID_COLUMN_HEADERS.map((h, ci) => {
        const isLunch = ci === LUNCH_HEADER_COL;
        const headerPeriod = periodOfColumn(ci);
        return (
          <div
            key={h}
            style={{
              padding: '9px 10px',
              fontSize: 11,
              fontWeight: 800,
              color: isLunch ? '#d97706' : 'var(--primary)',
              textAlign: 'center',
              background: isLunch ? 'rgba(251,191,36,0.12)' : 'var(--secondary-lighter)',
              borderRadius: 6,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              justifyContent: 'center',
            }}
          >
            <span>{h}</span>
            <span style={{ fontSize: 9.5, fontWeight: 500, color: 'var(--text-lighter)' }}>
              {isLunch ? '' : (periodLabels[headerPeriod - 1] ?? '')}
            </span>
          </div>
        );
      })}

      {GRID_DAY_NAMES.map((dayName, di) => {
        const day = di + 1;
        const isToday = di === todayIdx;
        return (
          <Fragment key={dayName}>
            <div
              className="bg-base-100"
              style={{
                gridColumn: 1,
                gridRow: di + 2,
                position: 'sticky',
                left: 0,
                zIndex: 5,
                minHeight: GRID_CELL_MIN_HEIGHT,
                padding: '10px 12px',
                fontSize: 12.5,
                fontWeight: 800,
                color: 'var(--accent)',
                borderRadius: 6,
                borderStyle: 'solid',
                borderWidth: '1.5px',
                borderColor: isToday ? 'var(--primary)' : 'var(--surface-border)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 3,
                boxShadow: isToday ? '0 2px 10px rgba(40,114,161,0.2)' : '1px 0 0 var(--surface-border)',
              }}
            >
              <span>{dayName}</span>
              {isToday && (
                <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Today
                </span>
              )}
            </div>

            {GRID_COLUMN_HEADERS.map((h, ci) => {
              const period = periodOfColumn(ci);
              if (h === 'LUNCH') return null;
              const cellSchedules = items.filter(
                (s) =>
                  s.dayOfWeek === day &&
                  (s.startPeriodNo === period ||
                    (period === 4 && s.startPeriodNo <= 3 && s.endPeriodNo >= 4))
              );
              const spannedInto = items.some((s) => {
                if (s.dayOfWeek !== day) return false;
                const segEnd = s.startPeriodNo <= 3 && s.endPeriodNo >= 4 ? 3 : s.endPeriodNo;
                return s.startPeriodNo < period && segEnd >= period;
              });
              const isTarget = dragTarget?.day === day && dragTarget.period === period;
              const remoteHere = remoteDrag?.day === day && remoteDrag.period === period;
              return (
                <div
                  key={`${day}-${period}`}
                  onDragOver={onDragOver ? (e) => onDragOver(e, day, period) : undefined}
                  onDrop={onDrop ? (e) => onDrop(e, day, period) : undefined}
                  onClick={onCellClick ? () => onCellClick(day, period) : undefined}
                  style={{
                    gridColumn: ci + 2,
                    gridRow: di + 2,
                    minHeight: GRID_CELL_MIN_HEIGHT,
                    minWidth: 0,
                    borderRadius: 6,
                    borderStyle: 'solid',
                    borderWidth: '1.5px',
                    borderColor: spannedInto
                      ? 'transparent'
                      : isTarget
                        ? 'var(--primary)'
                        : 'var(--surface-border)',
                    background: spannedInto ? 'transparent' : isTarget ? 'rgba(40,114,161,0.12)' : 'var(--secondary-lighter)',
                    padding: 5,
                    position: 'relative',
                    zIndex: spannedInto ? 3 : 1,
                    overflow: 'visible',
                  }}
                >
                  {remoteHere && (
                    <div
                      className="animate-pulse"
                      style={{ position: 'absolute', top: 4, right: 4, zIndex: 4, width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' }}
                    />
                  )}
                  {[...cellSchedules]
                    .sort((a, b) => windowKeyOf(a).localeCompare(windowKeyOf(b)))
                    .reduce((groups, s) => {
                      const last = groups[groups.length - 1];
                      if (last && windowKeyOf(last[0]) === windowKeyOf(s)) last.push(s);
                      else groups.push([s]);
                      return groups;
                    }, [] as ScheduleResponse[][])
                    .map((grp, gi) => {
                      const s = grp[0];
                      const combined = grp.length > 1 && new Set(grp.map((x) => x.courseCode)).size === grp.length;
                      const crossesLunch = s.startPeriodNo <= 3 && s.endPeriodNo >= 4;
                      const isContinuation = period === 4 && s.startPeriodNo <= 3 && crossesLunch;
                      const span = isContinuation
                        ? s.endPeriodNo - 4 + 1
                        : crossesLunch
                          ? 3 - s.startPeriodNo + 1
                          : s.endPeriodNo - s.startPeriodNo + 1;
                      return (
                        <div
                          key={s.scheduleId}
                          style={{
                            position: 'absolute',
                            top: 5,
                            bottom: 5,
                            left: 5 + gi * 14,
                            width: `calc(${span * 100}% + ${(span - 1) * 1}px - 10px - ${gi * 14}px)`,
                            zIndex: 10 + gi,
                            pointerEvents: 'none',
                          }}
                        >
                          {combined ? (
                            <ElectiveCard
                              items={grp}
                              onClick={onSelectElectives ? () => onSelectElectives(grp) : undefined}
                            />
                          ) : (
                            <ScheduleCard
                              schedule={s}
                              editable={editable}
                              onDragStart={onDragStart ? (e) => onDragStart(e, s) : undefined}
                              onDragEnd={onDragEnd}
                              onClick={onSelectSchedule ? () => onSelectSchedule(s) : undefined}
                            />
                          )}
                        </div>
                      );
                    })},
                </div>
              );
            })},
          </Fragment>
        );
      })},

      {/* Lunch strip */}
      <div
        style={{
          gridColumn: 5,
          gridRow: `2 / ${GRID_DAY_NAMES.length + 2}`,
          alignSelf: 'stretch',
          width: '100%',
          minHeight: GRID_CELL_MIN_HEIGHT * GRID_DAY_NAMES.length,
          zIndex: 1,
          background: 'repeating-linear-gradient(45deg, var(--divider), var(--divider) 6px, var(--secondary-lighter) 6px, var(--secondary-lighter) 12px)',
          borderLeft: '1.5px dashed var(--surface-border)',
          borderRight: '1.5px dashed var(--surface-border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-evenly',
        }}
      >
        {[...'LUNCH'].reverse().map((ch, li) => (
          <span
            key={`${ch}-${li}`}
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-lighter)',
              fontStyle: 'italic',
              lineHeight: 1,
            }}
          >
            {ch}
          </span>
        ))}
      </div>
    </div>
  );

  if (groups.length <= 1) {
    return (
      <>
        {renderCohortGrid(schedules)}
        <CourseInfoPanel schedules={schedules} />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {groups.map((g) => (
        <div key={`${g.semesterNo}|${g.section}`}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>
              Semester {g.semesterNo} — Section {g.section}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-lighter)' }}>
              {g.items.length} {g.items.length === 1 ? 'session' : 'sessions'}
            </span>
          </div>
          <div style={{ overflowX: 'auto', paddingBottom: 2 }}>
            {renderCohortGrid(g.items)}
          </div>
          <CourseInfoPanel schedules={g.items} />
        </div>
      ))}
    </div>
  );
}

function CourseInfoPanel({ schedules }: { schedules: ScheduleResponse[] }) {
  const rows = useMemo(() => {
    const byCode = new Map<string, { code: string; name: string; type: ScheduleResponse['scheduleType']; staff: Set<string> }>();
    for (const s of schedules) {
      if (s.scheduleType !== 'COURSE') continue; // info panel lists curriculum courses only
      const staff = s.staffNames.length > 0 ? s.staffNames.join(', ') : s.staffName;
      const existing = byCode.get(s.courseCode);
      if (existing) {
        if (staff) existing.staff.add(staff);
      } else {
        byCode.set(s.courseCode, { code: s.courseCode, name: s.courseName, type: s.scheduleType, staff: new Set(staff ? [staff] : []) });
      }
    }
    return Array.from(byCode.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [schedules]);

  if (rows.length === 0) return null;
  return (
    <div style={{ marginTop: 14, border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)', background: 'var(--surface-soft)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--surface-border)' }}>
        <BookOpen size={13} style={{ color: 'var(--primary)' }} />
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
            <ScheduleTypeBadge type={r.type} />
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                color: 'var(--accent)',
                fontFamily: 'Consolas, Menlo, monospace',
                flexShrink: 0,
              }}
            >
              {r.code}
            </span>
            <span
              title={r.name}
              style={{
                fontSize: 11.5,
                color: 'var(--text)',
                fontWeight: 600,
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {r.name}
            </span>
            <span
              title={Array.from(r.staff).join(', ')}
              style={{
                fontSize: 11,
                color: 'var(--text-light)',
                flexShrink: 0,
                maxWidth: 280,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {Array.from(r.staff).join(', ') || '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GenerationStatusPill({ status }: { status: GenerationStatus }) {
  const generating = status === 'GENERATING';
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        padding: '4px 11px',
        borderRadius: 16,
        background: `${statusColor(status)}1f`,
        color: statusColor(status),
        letterSpacing: '0.3px',
      }}
    >
      {generating && <Loader2 size={11} className="animate-spin" />}
      {statusLabel(status)}
    </span>
  );
}

interface SharedTimetableWorkspaceProps {
  generationId: string;
  onBack: () => void;
  /** Called when the session genuinely does not exist after bounded retries. */
  onNotFound?: (generationId: string) => void;
  staff: StaffRecord;
}

// ============================================================================
// Roll Call workspace: Today / Schedule / History tabs on ONE page
// ============================================================================

export type RollCallTab = 'today' | 'schedules' | 'history';

function readRollCallTab(): RollCallTab {
  if (typeof window === 'undefined') return 'today';
  const t = new URLSearchParams(window.location.search).get('tab');
  return t === 'schedules' || t === 'history' ? (t as RollCallTab) : 'today';
}

export function RollCallWorkspace() {
  // Tab survives browser refresh: mirrored into the URL query string.
  const [tab, setTab] = useState<RollCallTab>(readRollCallTab);

  const switchTab = (t: RollCallTab) => {
    setTab(t);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', t);
      window.history.replaceState(null, '', url.toString());
    }
  };

  const [seed, setSeed] = useState<{ sid: string; month: string } | null>(null);

  const openHistory = (sid: string, month: string) => {
    setSeed({ sid, month });
    switchTab('history');
  };

  const tabs: { id: RollCallTab; label: string }[] = [
    { id: 'today', label: "Today's Roll Call" },
    { id: 'schedules', label: 'Schedule Roll Call' },
    { id: 'history', label: 'Roll Call History' },
  ];

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-4" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            onClick={() => switchTab(t.id)}
            className={'btn btn-sm cursor-pointer ' + (tab === t.id ? 'btn-primary' : 'btn-ghost')}
            style={{ border: '1.5px solid var(--surface-border)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'today' && (
        <RollCallSection mode="today" onViewHistory={openHistory} />
      )}
      {tab === 'schedules' && (
        <RollCallSection mode="schedules" onViewHistory={openHistory} />
      )}
      {tab === 'history' && (
        <RollCallHistorySection
          key={(seed?.sid ?? '') + '|' + (seed?.month ?? '')}
          seedScheduleId={seed?.sid}
          seedMonth={seed?.month}
        />
      )}
    </div>
  );
}

export function SharedTimetableWorkspace({ generationId, onBack, onNotFound, staff }: SharedTimetableWorkspaceProps) {
  const [generation, setGeneration] = useState<GenerationSessionResponse | null>(null);
  const [lobby, setLobby] = useState<TimetableLobbyResponse | null>(null);
  const [manage, setManage] = useState<GenerationManageResponse | null>(null);
  const [scope, setScope] = useState<GenerationScopeSemester[] | null>(null);
  const [examTypes, setExamTypes] = useState<ExamTypeResponse[]>([]);
  const [schedules, setSchedules] = useState<ScheduleResponse[] | null>(null);
  const [status, setStatus] = useState<GenerationStatus>('PENDING');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedExamType, setSelectedExamType] = useState('');
  const [selectedSemesters, setSelectedSemesters] = useState<Set<string>>(new Set());
  const [selectedSections, setSelectedSections] = useState<Record<string, Set<string>>>({});
  const [viewSemester, setViewSemester] = useState<number | 'all'>('all');
  const [viewSection, setViewSection] = useState<string>('all');
  const [scopeLoading, setScopeLoading] = useState(false);
  const [lock, setLock] = useState<TimetableLockResponse | null>(null);
  const [remoteDrag, setRemoteDrag] = useState<RemoteDragState | null>(null);
  const [dragTarget, setDragTarget] = useState<{ day: number; period: number } | null>(null);
  const [pendingSwap, setPendingSwap] = useState<PendingSwapState | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<ScheduleResponse | null>(null);
  const [electivePick, setElectivePick] = useState<ScheduleResponse[] | null>(null);
  const [moveTarget, setMoveTarget] = useState<ScheduleResponse | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<TimetableEvent[]>([]);
  const [workspaceTab, setWorkspaceTab] = useState<'grid' | 'history'>('grid');
  const [showCmr, setShowCmr] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteStaffList, setInviteStaffList] = useState<StaffRecord[] | null>(null);
  const [inviteBusy, setInviteBusy] = useState<string | null>(null);
  const [groups, setGroups] = useState<TeachingGroupResponse[] | null>(null);
  const [assignments, setAssignments] = useState<TeachingAssignmentResponse[] | null>(null);
  const [unitCourses, setUnitCourses] = useState<CourseRecord[] | null>(null);
  const [groupCourseId, setGroupCourseId] = useState('');
  const [groupAssignments, setGroupAssignments] = useState<Set<string>>(new Set());
  const [groupsSaving, setGroupsSaving] = useState(false);
  const [, setGenerationTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const isHod = manage?.isHod === true;
  const canManage = manage?.canManage === true;
  const lockOwned = lock?.locked === true && lock.staffId === staff.staffId;
  const canEdit = canManage && status !== 'PUBLISHED' && lockOwned;
  const activeLobby = lobby && (lobby.status === 'OPEN' || lobby.status === 'GENERATING') ? lobby : null;

  // Latest-callback refs keep loadAll/subscriptions stable across renders.
  const onNotFoundRef = useRef(onNotFound);
  useEffect(() => {
    onNotFoundRef.current = onNotFound;
  }, [onNotFound]);

  const clearGenerationTimer = useCallback(() => {
    setGenerationTimer((prev) => {
      if (prev) clearTimeout(prev);
      return null;
    });
  }, []);

  const refreshSchedules = useCallback(async () => {
    const list = await getGenerationSchedules(generationId);
    setSchedules(list);
  }, [generationId]);

  const scheduleGenerationFallback = useCallback(() => {
    clearGenerationTimer();
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function tick() {
      try {
        const gen = await getGeneration(generationId);
        setGeneration(gen);
        setStatus(gen.status);
        if (gen.status === 'GENERATING') {
          const started = gen.startedAt ? new Date(gen.startedAt).getTime() : Date.now();
          if (Date.now() - started > GENERATION_FALLBACK_MS + GENERATION_GRACE_MS) {
            setStatus('FAILED');
            setSaveError('Generation took too long — the server may be unreachable. Refresh and try again.');
          } else {
            timer = setTimeout(tick, GENERATION_FALLBACK_MS);
            setGenerationTimer(timer);
          }
        }
      } catch {
        timer = setTimeout(tick, GENERATION_FALLBACK_MS);
        setGenerationTimer(timer);
      }
    }
    timer = setTimeout(tick, GENERATION_FALLBACK_MS);
    setGenerationTimer(timer);
  }, [generationId, clearGenerationTimer]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch the exact session referenced by navigation. Bounded retry with
      // the SAME id absorbs transient read races right after commit; it is not
      // a polling loop and never guesses by "latest session".
      let gen: GenerationSessionResponse | null = null;
      let genErr: unknown = null;
      for (let attempt = 0; attempt < 3 && !gen; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 700));
        try {
          gen = await getGeneration(generationId);
        } catch (err) {
          genErr = err;
          // A genuine 404 will not heal; stop retrying immediately.
          if (/not found/i.test(err instanceof Error ? err.message : '')) break;
        }
      }
      if (!gen) {
        const message = genErr instanceof Error ? genErr.message : '';
        if (onNotFoundRef.current && /not found/i.test(message)) {
          onNotFoundRef.current(generationId);
          return;
        }
        throw genErr ?? new Error('Could not load the generation session');
      }
      const [et, lobbies] = await Promise.all([getExamTypes(), getGenerationLobbies()]);
      setGeneration(gen);
      setStatus(gen.status);
      setExamTypes(et);
      const initialExamTypeId = et[0]?.examTypeId ?? '';
      setSelectedExamType(initialExamTypeId);
      const [mg, sc, sch] = await Promise.all([
        getGenerationManage(gen.termId),
        getGenerationScope(gen.termId, initialExamTypeId),
        getGenerationSchedules(generationId),
      ]);
      const lob = lobbies.find((l) => l.generationId === generationId) ?? null;
      setManage(mg);
      setScope(sc);
      setSchedules(sch);
      setLobby(lob);
      setSelectedSemesters((prev) => (prev.size > 0 ? prev : sc.length > 0 ? new Set([sc[0].semesterId]) : prev));
      setSelectedSections((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        if (sc.length === 0) return prev;
        return { [sc[0].semesterId]: new Set(sc[0].sections.map((s) => s.sectionId)) };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the generation workspace');
    } finally {
      setLoading(false);
    }
  }, [generationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial workspace load
    loadAll();
  }, [loadAll]);

  useEffect(() => () => clearGenerationTimer(), [clearGenerationTimer]);

  useTimetableRealtime(lobby?.lobbyId ?? null, (event) => {
    if (event.generationId && event.generationId !== generationId) return;
    pushEvent(setHistory, event.type);
    switch (event.type) {
      case TIMETABLE_REALTIME_EVENTS.GENERATION_STARTED:
        setStatus('GENERATING');
        setSaving(false);
        setSaveError(null);
        scheduleGenerationFallback();
        break;
      case TIMETABLE_REALTIME_EVENTS.GENERATION_COMPLETED:
        setStatus('COMPLETED');
        setSaving(false);
        setSaveError(null);
        clearGenerationTimer();
        refreshSchedules().catch(() => {});
        break;
      case TIMETABLE_REALTIME_EVENTS.GENERATION_FAILED:
        setStatus('FAILED');
        setSaving(false);
        clearGenerationTimer();
        getGeneration(generationId).then(setGeneration).catch(() => {});
        toast.error('Timetable generation failed — see the reason below');
        break;
      case TIMETABLE_REALTIME_EVENTS.TIMETABLE_PUBLISHED:
        setStatus('PUBLISHED');
        clearGenerationTimer();
        refreshSchedules().catch(() => {});
        toast.success('Timetable published');
        break;
      case TIMETABLE_REALTIME_EVENTS.TIMETABLE_DELETED:
        clearGenerationTimer();
        setStatus('FAILED');
        break;
      case TIMETABLE_REALTIME_EVENTS.SCHEDULE_CREATED:
      case TIMETABLE_REALTIME_EVENTS.SCHEDULE_UPDATED:
      case TIMETABLE_REALTIME_EVENTS.SCHEDULE_DELETED:
        refreshSchedules().catch(() => {});
        break;
      case TIMETABLE_REALTIME_EVENTS.SCHEDULE_LOCKED:
        setLock({
          generationId,
          locked: true,
          staffId: event.staffId ?? null,
          staffName: event.lockOwner ?? null,
          expiresAt: event.expiresAt ?? null,
        });
        break;
      case TIMETABLE_REALTIME_EVENTS.SCHEDULE_UNLOCKED:
        setLock((prev) =>
          prev && prev.staffId === staff.staffId
            ? { ...prev, locked: false, staffId: null, staffName: null, expiresAt: null }
            : prev
        );
        break;
      case TIMETABLE_REALTIME_EVENTS.DRAG_STARTED:
      case TIMETABLE_REALTIME_EVENTS.DRAG_MOVED:
        if (event.staffId && event.staffId !== staff.staffId) {
          setRemoteDrag({
            scheduleId: event.scheduleId ?? '',
            staffName: event.staffName ?? 'Another editor',
            day: event.day ?? null,
            period: event.period ?? null,
          });
        }
        break;
      case TIMETABLE_REALTIME_EVENTS.DRAG_ENDED:
        if (event.staffId !== staff.staffId) setRemoteDrag(null);
        break;
      case TIMETABLE_REALTIME_EVENTS.LOBBY_CANCELLED:
        setLobby((prev) => (prev ? { ...prev, status: 'CANCELLED' } : prev));
        break;
      case TIMETABLE_REALTIME_EVENTS.TEACHING_GROUP_CREATED:
      case TIMETABLE_REALTIME_EVENTS.TEACHING_GROUP_DELETED:
        if (showGroups) {
          getTeachingGroups(generation?.termId)
            .then(setGroups)
            .catch(() => {});
        }
        break;
      default:
        break;
    }
  }, () => {
    // Stream (re)connected: SSE has no replay, so re-read the authoritative
    // status and schedules for THIS generation id. This recovers missed
    // GENERATION_* / SCHEDULE_* events after a network drop without any
    // manual refresh.
    getGeneration(generationId)
      .then((gen) => {
        setGeneration(gen);
        setStatus(gen.status);
      })
      .catch(() => {});
    refreshSchedules().catch(() => {});
  });

  useEffect(() => {
    if (!canManage || status === 'PUBLISHED') return;
    let cancelled = false;
    const tick = async () => {
      try {
        const current = await getTimetableLock(generationId);
        if (cancelled) return;
        setLock(current);
        if (current.locked && current.staffId === staff.staffId) {
          const res = await heartbeatTimetableLock(generationId);
          if (!cancelled) setLock(res);
        } else if (!current.locked) {
          const res = await acquireTimetableLock(generationId);
          if (!cancelled) setLock(res);
        }
      } catch {
        // transient — the next poll retries
      }
    };
    tick();
    const interval = setInterval(tick, SCHEDULE_LOCK_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [generationId, canManage, status, staff.staffId]);

  const lockOwnedRef = useRef(false);
  useEffect(() => {
    lockOwnedRef.current = lockOwned;
  }, [lockOwned]);

  useEffect(() => {
    return () => {
      if (lockOwnedRef.current) {
        releaseTimetableLock(generationId).catch(() => {});
      }
    };
  }, [generationId]);

  const lastDragRef = useRef<{ day: number; period: number; at: number } | null>(null);
  const dragMoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (dragMoveTimerRef.current) clearTimeout(dragMoveTimerRef.current);
  }, []);

  const sendDragMove = useCallback((day: number, period: number) => {
    const last = lastDragRef.current;
    const now = Date.now();
    if (last && last.day === day && last.period === period && now - last.at < DRAG_BROADCAST_MS) return;
    lastDragRef.current = { day, period, at: now };
    if (dragMoveTimerRef.current) return;
    dragMoveTimerRef.current = setTimeout(() => {
      dragMoveTimerRef.current = null;
      const cur = lastDragRef.current;
      if (cur) {
        publishDragStatus(generationId, { action: 'move', scheduleId: null, day: cur.day, period: cur.period }).catch(() => {});
      }
    }, DRAG_BROADCAST_MS);
  }, [generationId]);

  const handleDragStart = (e: DragEvt<HTMLDivElement>, s: ScheduleResponse) => {
    if (!canEdit) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', s.scheduleId);
    e.dataTransfer.effectAllowed = 'move';
    setRemoteDrag({ scheduleId: s.scheduleId, staffName: staff.staffName, day: s.dayOfWeek, period: s.startPeriodNo });
    publishDragStatus(generationId, { action: 'start', scheduleId: s.scheduleId, day: s.dayOfWeek, period: s.startPeriodNo }).catch(() => {});
  };

  const handleDragOver = (e: DragEvt<HTMLDivElement>, day: number, period: number) => {
    if (!canEdit) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const cur = dragTarget;
    if (cur && cur.day === day && cur.period === period) return;
    setDragTarget({ day, period });
    sendDragMove(day, period);
  };

  const moveScheduleTo = useCallback(
    async (scheduleId: string, day: number, period: number) => {
      if (!canEdit || saving) return;
      const dragged = (schedules ?? []).find((s) => s.scheduleId === scheduleId);
      if (!dragged) return;
      const occupant = (schedules ?? []).find(
        (s) =>
          s.dayOfWeek === day &&
          s.startPeriodNo === period &&
          s.scheduleStatus !== 'CANCELLED' &&
          s.scheduleId !== scheduleId
      );
      if (occupant) {
        setPendingSwap({
          scheduleId,
          withScheduleId: occupant.scheduleId,
          targetDay: day,
          targetPeriod: period,
          conflicts: null,
        });
        return;
      }
      setSaving(true);
      setSaveError(null);
      try {
        const res = await swapSchedules(generationId, { scheduleId, targetDay: day, targetPeriod: period, force: false });
        if (res.swapped) {
          setSchedules((prev) => (res.schedules.length > 0 ? res.schedules : prev));
          toast.success('Schedule moved');
        } else if (res.conflicts.length > 0) {
          setSaveError(`Move blocked — ${res.conflicts.join('; ')}`);
        } else {
          toast.error('Could not move schedule');
        }
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Could not move schedule');
      } finally {
        setSaving(false);
      }
    },
    [canEdit, saving, schedules, generationId]
  );

  const handleDrop = async (e: DragEvt<HTMLDivElement>, day: number, period: number) => {
    if (!canEdit) return;
    e.preventDefault();
    const scheduleId = e.dataTransfer.getData('text/plain');
    setDragTarget(null);
    publishDragStatus(generationId, { action: 'end', scheduleId, day: null, period: null }).catch(() => {});
    setRemoteDrag(null);
    if (!scheduleId) return;
    await moveScheduleTo(scheduleId, day, period);
  };

  const handleGridCellClick = (day: number, period: number) => {
    if (!moveTarget) return;
    const s = moveTarget;
    setMoveTarget(null);
    moveScheduleTo(s.scheduleId, day, period);
  };

  const handleSelectSchedule = (s: ScheduleResponse) => {
    setSelectedMeeting(s);
  };

  const handleSelectElectives = (items: ScheduleResponse[]) => {
    setElectivePick(items);
  };

  const handleDragEnd = () => {
    setDragTarget(null);
    setRemoteDrag(null);
    publishDragStatus(generationId, { action: 'end', scheduleId: null, day: null, period: null }).catch(() => {});
  };

  const handleSwapConfirm = async (force: boolean) => {
    if (!pendingSwap || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await swapSchedules(generationId, {
        scheduleId: pendingSwap.scheduleId,
        targetDay: pendingSwap.targetDay,
        targetPeriod: pendingSwap.targetPeriod,
        force,
      });
      if (res.swapped) {
        setSchedules((prev) => (res.schedules.length > 0 ? res.schedules : prev));
        setPendingSwap(null);
        toast.success('Schedules swapped');
      } else if (!force && res.conflicts.length > 0) {
        setPendingSwap({ ...pendingSwap, conflicts: res.conflicts });
      } else {
        toast.error('Could not swap schedules');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not swap schedules');
    } finally {
      setSaving(false);
    }
  };

  const toggleSemester = (semesterId: string) => {
    setSelectedSemesters((prev) => {
      const next = new Set(prev);
      if (next.has(semesterId)) {
        next.delete(semesterId);
        setSelectedSections((s) => {
          const copy = { ...s };
          delete copy[semesterId];
          return copy;
        });
      } else {
        next.add(semesterId);
        const sem = scope?.find((x) => x.semesterId === semesterId);
        if (sem) {
          setSelectedSections((s) => ({ ...s, [semesterId]: new Set(sem.sections.map((sec) => sec.sectionId)) }));
        }
      }
      return next;
    });
  };

  const toggleSection = (semesterId: string, sectionId: string) => {
    setSelectedSections((prev) => {
      const current = new Set(prev[semesterId] ?? []);
      if (current.has(sectionId)) current.delete(sectionId);
      else current.add(sectionId);
      return { ...prev, [semesterId]: current };
    });
  };

  const handleExamTypeChange = (examTypeId: string) => {
    setSelectedExamType(examTypeId);
    setSelectedSemesters(new Set());
    setSelectedSections({});
    setViewSemester('all');
    if (examTypeId && generation) {
      setScopeLoading(true);
      getGenerationScope(generation.termId, examTypeId)
        .then(setScope)
        .catch(() => setScope([]))
        .finally(() => setScopeLoading(false));
    }
  };

  const handleGenerate = async () => {
    if (!canEdit || saving) return;
    if (!selectedExamType) {
      toast.error('Select an exam type first');
      return;
    }
    if (selectedSemesters.size === 0) {
      toast.error('Select at least one semester');
      return;
    }
    let sectionCount = 0;
    selectedSemesters.forEach((sid) => {
      sectionCount += selectedSections[sid]?.size ?? 0;
    });
    if (sectionCount === 0) {
      toast.error('Select at least one section');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await generateTimetable(generationId, {
        examTypeId: selectedExamType,
        semesters: Array.from(selectedSemesters).map((sid) => ({
          semesterId: sid,
          sectionIds: Array.from(selectedSections[sid] ?? []),
        })),
      });
      setStatus('GENERATING');
      scheduleGenerationFallback();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not start generation');
      toast.error(err instanceof Error ? err.message : 'Could not start generation');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = () => {
    setConfirmDialog({
      title: 'Publish this timetable?',
      message: 'Publishing makes this the official schedule students and staff see. Schedules can no longer be edited after publishing.',
      confirmLabel: 'Publish',
      action: async () => {
        setSaving(true);
        try {
          await publishGeneration(generationId);
          setStatus('PUBLISHED');
          toast.success('Timetable published');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Could not publish timetable');
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const handleCancelGeneration = () => {
    setConfirmDialog({
      title: 'Cancel this generation?',
      message: 'All draft schedules will be discarded and this generation marked as failed.',
      confirmLabel: 'Cancel generation',
      tone: 'danger',
      action: async () => {
        setSaving(true);
        try {
          await cancelGeneration(generationId);
          setStatus('FAILED');
          setSchedules([]);
          toast.success('Generation cancelled');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Could not cancel generation');
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const openInvite = async () => {
    setShowInvite(true);
    setInviteStaffList(null);
    try {
      const list = await apiFetch<StaffRecord[]>('/api/staff');
      setInviteStaffList(list);
    } catch {
      setInviteStaffList([]);
    }
  };

  const inviteStaff = async (targetStaffId: string) => {
    if (!activeLobby || inviteBusy) return;
    setInviteBusy(targetStaffId);
    try {
      const updated = await inviteLobbyMember(activeLobby.lobbyId, targetStaffId);
      setLobby(updated);
      toast.success('Invitation sent');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not invite staff');
    } finally {
      setInviteBusy(null);
    }
  };

  const openGroups = async () => {
    setShowGroups(true);
    try {
      if (generation) {
        setGroups(await getTeachingGroups(generation.termId));
        const [ass, courses] = await Promise.all([
          getTeachingAssignments(),
          getCourses({ unitId: staff.unitId }),
        ]);
        setAssignments(ass.filter((a) => a.termId === generation.termId));
        setUnitCourses(courses);
      }
    } catch {
      toast.error('Could not load combined classes');
    }
  };

  const groupCourseAssignments = useMemo(() => {
    if (!groupCourseId) return [];
    return (assignments ?? []).filter((a) => a.courseId === groupCourseId);
  }, [assignments, groupCourseId]);

  const handleCreateGroup = async () => {
    if (!generation || groupsSaving) return;
    if (!groupCourseId || groupAssignments.size < 2) {
      toast.error('Select a course and at least two assignments');
      return;
    }
    setGroupsSaving(true);
    try {
      await createTeachingGroup({
        termId: generation.termId,
        courseId: groupCourseId,
        assignmentIds: Array.from(groupAssignments),
      });
      toast.success('Combined class created');
      setGroupAssignments(new Set());
      setGroups(await getTeachingGroups(generation.termId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create combined class');
    } finally {
      setGroupsSaving(false);
    }
  };

  const handleDeleteGroup = (group: TeachingGroupResponse) => {
    setConfirmDialog({
      title: `Delete combined class ${group.groupName}?`,
      message: `Removes the combined class for ${group.courseCode} (${group.members.length} sections).`,
      confirmLabel: 'Delete',
      tone: 'danger',
      action: async () => {
        try {
          await deleteTeachingGroup(group.groupId);
          toast.success('Combined class deleted');
          if (generation) setGroups(await getTeachingGroups(generation.termId));
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Could not delete combined class');
        }
      },
    });
  };

  const selectedTotal = useMemo(() => {
    let total = 0;
    selectedSemesters.forEach((sid) => {
      total += selectedSections[sid]?.size ?? 0;
    });
    return total;
  }, [selectedSemesters, selectedSections]);

  const isPublished = status === 'PUBLISHED';

  const semesterOptions = useMemo(
    () => [...new Set((schedules ?? []).map((s) => s.semesterNo))].sort((a, b) => a - b),
    [schedules]
  );
  const sectionOptions = useMemo(
    () => [...new Set((schedules ?? []).flatMap((s) => s.sections ?? []))].sort(),
    [schedules]
  );
  const activeViewSemester = viewSemester;
  const activeViewSection = viewSection !== 'all' && sectionOptions.includes(viewSection) ? viewSection : 'all';
  const visibleSchedules = useMemo(
    () =>
      (schedules ?? []).filter(
        (s) =>
          (activeViewSemester === 'all' || s.semesterNo === activeViewSemester) &&
          (activeViewSection === 'all' || (s.sections ?? []).includes(activeViewSection))
      ),
    [schedules, activeViewSemester, activeViewSection]
  );
  const { periodLabels, lunchLabel } = useTimeSlotLabels();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 size={22} className="animate-spin" style={{ color: 'var(--primary)' }} />
        <div style={{ fontSize: 13, color: 'var(--text-lighter)' }}>Loading timetable workspace...</div>
      </div>
    );
  }

  if (error && !generation) {
    return (
      <div className="text-center py-20">
        <XCircle size={30} className="mx-auto mb-3 opacity-40" />
        <p className="text-xs mb-4" style={{ color: 'var(--text-lighter)' }}>{error}</p>
        <button onClick={onBack} className="btn btn-ghost btn-sm gap-1.5 cursor-pointer" style={{ color: 'var(--primary)' }}>
          <ArrowLeft size={13} /> Back
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="btn btn-ghost btn-sm btn-circle cursor-pointer"
            style={{ color: 'var(--text-light)' }}
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="flex items-center gap-2" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>
              <CalendarCog size={19} style={{ color: 'var(--primary)' }} />
              Timetable Management
            </h1>
            <div style={{ fontSize: 12.5, color: 'var(--text-light)', marginTop: 2 }}>
              {generation ? `${generation.academicYear} · ${generation.generatedByStaffNo ?? ''}` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GenerationStatusPill status={status} />
          {isHod && (
            <button
              onClick={openGroups}
              className="btn btn-ghost btn-sm gap-1.5 cursor-pointer"
              style={{ color: 'var(--primary)', border: '1.5px solid var(--surface-border)' }}
            >
              <Blocks size={13} /> Combined Classes
            </button>
          )}
          {isHod && (
            <button
              onClick={() => setShowCmr(true)}
              className="btn btn-ghost btn-sm gap-1.5 cursor-pointer"
              style={{ color: 'var(--primary)', border: '1.5px solid var(--surface-border)' }}
            >
              <BookOpen size={13} /> Requirements
            </button>
          )}
          {status === 'COMPLETED' && canManage && (
            <button
              onClick={handlePublish}
              disabled={saving}
              className="btn btn-sm gap-1.5 border-none text-white cursor-pointer disabled:opacity-50"
              style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Publish
            </button>
          )}
          {!isPublished && canManage && (
            <button
              onClick={handleCancelGeneration}
              disabled={saving}
              className="btn btn-ghost btn-sm gap-1.5 cursor-pointer disabled:opacity-50"
              style={{ color: 'var(--danger)' }}
              title="Cancel generation"
            >
              <XCircle size={13} /> Cancel
            </button>
          )}
        </div>
      </div>

      {saveError && (
        <div
          className="flex items-center gap-2 px-4 py-3 mb-4"
          style={{ borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.3)', color: 'var(--danger)', fontSize: 12.5 }}
        >
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="btn btn-ghost btn-xs btn-circle cursor-pointer">
            <X size={12} />
          </button>
        </div>
      )}

      {status === 'FAILED' && generation?.failureReport && !saveError && (
        <div
          className="flex items-start gap-2 px-4 py-3 mb-4"
          style={{ borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.3)' }}
        >
          <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
          <div className="flex-1" style={{ fontSize: 12.5, color: 'var(--danger)', whiteSpace: 'pre-line' }}>
            {generation.failureReport}
          </div>
        </div>
      )}

      {status === 'GENERATING' && (
        <div
          className="flex items-center gap-2.5 px-4 py-3 mb-4"
          style={{ borderRadius: 'var(--radius-md)', background: 'rgba(217,119,6,0.1)', border: '1.5px solid rgba(217,119,6,0.35)' }}
        >
          <Timer size={15} className="animate-pulse" style={{ color: '#d97706' }} />
          <div style={{ fontSize: 12.5, color: '#b45309', fontWeight: 600 }}>
            Generating timetable... this may take a minute. The grid updates automatically when it finishes.
          </div>
        </div>
      )}

      {lock && lock.locked && !lockOwned && (
        <div
          className="flex items-center gap-2.5 px-4 py-3 mb-4"
          style={{ borderRadius: 'var(--radius-md)', background: 'rgba(217,119,6,0.1)', border: '1.5px solid rgba(217,119,6,0.35)' }}
        >
          <Lock size={14} className="shrink-0" style={{ color: '#d97706' }} />
          <div style={{ fontSize: 12.5, color: '#b45309', fontWeight: 600 }}>
            {lock.staffName ?? 'another editor'} is currently editing this timetable. Drag and drop is disabled until the lock is released.
          </div>
        </div>
      )}

      {canEdit && (
        <div
          className="flex items-center gap-2.5 px-4 py-3 mb-4"
          style={{ borderRadius: 'var(--radius-md)', background: 'rgba(40,114,161,0.08)', border: '1.5px solid rgba(40,114,161,0.3)' }}
        >
          <Unlock size={14} style={{ color: 'var(--primary)' }} />
          <div style={{ fontSize: 12.5, color: 'var(--primary)', fontWeight: 600 }}>
            You hold the editing lock — drag schedules to rearrange the draft.
          </div>
        </div>
      )}

      {remoteDrag && (
        <div
          className="flex items-center gap-2.5 px-4 py-3 mb-4"
          style={{ borderRadius: 'var(--radius-md)', background: 'rgba(139,92,246,0.1)', border: '1.5px solid rgba(139,92,246,0.35)' }}
        >
          <Radio size={14} className="animate-pulse" style={{ color: '#8b5cf6' }} />
          <div style={{ fontSize: 12.5, color: '#7c3aed', fontWeight: 600 }}>
            {remoteDrag.staffName} is dragging a schedule
            {remoteDrag.day && remoteDrag.period ? ` to ${DAY_NAMES[remoteDrag.day - 1] ?? ''} P${remoteDrag.period}` : '...'}
          </div>
        </div>
      )}

      {activeLobby && (
        <div
          className="flex items-center gap-2.5 px-4 py-3 mb-4 flex-wrap"
          style={{ borderRadius: 'var(--radius-md)', background: 'var(--secondary-lighter)', border: '1.5px solid var(--surface-border)' }}
        >
          <Users size={14} style={{ color: 'var(--primary)' }} />
          <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>
            Lobby led by {activeLobby.leaderName} — {activeLobby.members.filter((m) => m.joined).length} of {activeLobby.members.length} members joined
          </div>
          {isHod && (
            <button
              onClick={openInvite}
              className="btn btn-ghost btn-xs gap-1 ml-auto cursor-pointer"
              style={{ color: 'var(--primary)' }}
            >
              <UserPlus size={12} /> Invite
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid var(--surface)' }}>
        {(['grid', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setWorkspaceTab(tab)}
            className="cursor-pointer"
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: workspaceTab === tab ? 'var(--primary)' : 'var(--text-light)',
              borderBottom: '2.5px solid',
              borderBottomColor: workspaceTab === tab ? 'var(--primary)' : 'transparent',
              background: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              borderTop: 'none',
              outline: 'none',
              transition: 'all 0.2s',
            }}
          >
            {tab === 'grid' ? 'Weekly Grid' : 'Activity'}
          </button>
        ))}
      </div>

      {workspaceTab === 'grid' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[290px_1fr] gap-[18px]">
          {isHod && (
            <div className="bg-base-100 backdrop-blur-xl self-start" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid var(--surface)' }}>
                <Layers size={15} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>Generation Scope</span>
              </div>
              <div style={{ padding: '14px 18px' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>
                  Exam Type
                </label>
                <div className="relative mb-4">
                  <select
                    value={selectedExamType}
                    onChange={(e) => handleExamTypeChange(e.target.value)}
                    className="w-full appearance-none cursor-pointer"
                    style={{
                      fontSize: 13,
                      padding: '8px 30px 8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1.5px solid var(--surface-border)',
                      background: 'var(--divider)',
                      color: 'var(--text)',
                      outline: 'none',
                    }}
                  >
                    {examTypes.map((et) => (
                      <option key={et.examTypeId} value={et.examTypeId}>{et.examTypeName}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-lighter)' }} />
                </div>

                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>
                  Semesters & Sections
                </label>
                {scopeLoading && (
                  <div className="flex items-center gap-2 mb-2" style={{ fontSize: 11.5, color: 'var(--text-lighter)' }}>
                    <Loader2 size={11} className="animate-spin" /> Loading sections for this exam type...
                  </div>
                )}
                {(scope ?? []).length === 0 && !scopeLoading && (
                  <div style={{ fontSize: 12, color: 'var(--text-lighter)' }}>No teaching assignments found for this term</div>
                )}
                {(scope ?? []).map((sem) => {
                  const checked = selectedSemesters.has(sem.semesterId);
                  return (
                    <div key={sem.semesterId} className="mb-3" style={{ border: '1.5px solid var(--surface-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      <button
                        onClick={() => toggleSemester(sem.semesterId)}
                        className="w-full flex items-center gap-2 cursor-pointer text-left"
                        style={{ padding: '8px 12px', background: checked ? 'rgba(40,114,161,0.08)' : 'var(--divider)', border: 'none', fontSize: 12.5, fontWeight: 700, color: checked ? 'var(--primary)' : 'var(--text)' }}
                      >
                        <span
                          className="flex items-center justify-center"
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 5,
                            borderStyle: 'solid',
                            borderWidth: '1.5px',
                            borderColor: checked ? 'var(--primary)' : 'var(--surface-border)',
                            background: checked ? 'var(--primary)' : 'transparent',
                            color: '#fff',
                            fontSize: 10,
                          }}
                        >
                          {checked && <Check size={11} strokeWidth={3} />}
                        </span>
                        Semester {sem.semesterNo}
                      </button>
                      {checked && (
                        <div style={{ padding: '8px 12px', display: 'grid', gap: 6, background: 'var(--secondary-lighter)' }}>
                          {sem.sections.length === 0 && (
                            <div style={{ fontSize: 11.5, color: 'var(--text-lighter)' }}>No sections assigned</div>
                          )}
                          {sem.sections.map((sec) => {
                            const secChecked = selectedSections[sem.semesterId]?.has(sec.sectionId) ?? false;
                            return (
                              <label key={sec.sectionId} className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 12, color: 'var(--text)' }}>
                                <input
                                  type="checkbox"
                                  checked={secChecked}
                                  onChange={() => toggleSection(sem.semesterId, sec.sectionId)}
                                  style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                                />
                                Section {sec.sectionName}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                <button
                  onClick={handleGenerate}
                  disabled={!canEdit || saving || status === 'GENERATING'}
                  className="w-full btn btn-sm gap-1.5 border-none text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', marginTop: 6 }}
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                  {status === 'COMPLETED' ? 'Regenerate' : 'Generate Timetable'}
                </button>
                <div className="text-center mt-2" style={{ fontSize: 11, color: 'var(--text-lighter)' }}>
                  {selectedSemesters.size} semester{selectedSemesters.size === 1 ? '' : 's'} · {selectedTotal} section{selectedTotal === 1 ? '' : 's'}
                </div>
              </div>
            </div>
          )}

          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--surface)', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarDays size={15} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                  Weekly Grid {visibleSchedules ? `(${visibleSchedules.length} schedules${activeViewSemester !== 'all' ? ` · Semester ${activeViewSemester}` : ' · overview'}${activeViewSection !== 'all' ? ` · Section ${activeViewSection}` : ''})` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {semesterOptions.length > 1 && (
                  <select
                    value={String(activeViewSemester)}
                    onChange={(e) => setViewSemester(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="cursor-pointer"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1.5px solid var(--surface-border)',
                      background: 'var(--divider)',
                      color: 'var(--text)',
                      outline: 'none',
                    }}
                    title="Filter the grid by semester — 'All semesters' is an overview mode where each semester is drawn as its own table"
                  >
                    <option value="all">All semesters (overview)</option>
                    {semesterOptions.map((n) => (
                      <option key={n} value={n}>Semester {n}</option>
                    ))}
                  </select>
                )}
                {sectionOptions.length > 1 && (
                  <select
                    value={activeViewSection}
                    onChange={(e) => setViewSection(e.target.value)}
                    className="cursor-pointer"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1.5px solid var(--surface-border)',
                      background: 'var(--divider)',
                      color: 'var(--text)',
                      outline: 'none',
                    }}
                    title="Filter the grid by section"
                  >
                    <option value="all">All sections</option>
                    {sectionOptions.map((n) => (
                      <option key={n} value={n}>Section {n}</option>
                    ))}
                  </select>
                )}
                {activeViewSemester === 'all' && semesterOptions.length > 1 && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(251,191,36,0.14)',
                      color: '#b45309',
                      border: '1px dashed rgba(217,119,6,0.4)',
                    }}
                    title="All cohorts are shown as separate tables here — one table per semester and section, so different cohorts never share a cell"
                  >
                    Overview — one table per semester &amp; section
                  </span>
                )}
                {isHod && !canEdit && status !== 'PUBLISHED' && lock?.locked && (
                  <span style={{ fontSize: 11.5, color: '#b45309', fontWeight: 600 }}>
                    <Lock size={11} className="inline mr-1" /> Locked by {lock.staffName ?? 'another editor'}
                  </span>
                )}
              </div>
            </div>
            <div style={{ padding: '16px 18px', overflowX: 'auto' }}>
              {(schedules ?? []).length === 0 ? (
                <div className="text-center py-16">
                  <CalendarCog size={32} className="mx-auto mb-3 opacity-30" />
                  <p style={{ fontSize: 12.5, color: 'var(--text-lighter)', margin: 0 }}>
                    No schedules yet{isHod ? ' — configure the scope and generate a timetable' : ' — waiting for the HOD to generate'}
                  </p>
                </div>
              ) : (
                <WeeklyTimetableGrid
                  schedules={visibleSchedules}
                  editable={canEdit}
                  periodLabels={periodLabels}
                  lunchLabel={lunchLabel}
                  dragTarget={dragTarget}
                  remoteDrag={remoteDrag}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onSelectSchedule={handleSelectSchedule}
                  onSelectElectives={handleSelectElectives}
                  onCellClick={handleGridCellClick}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid var(--surface)' }}>
            <Clock size={15} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>Generation Activity</span>
          </div>
          <div style={{ padding: '12px 18px' }}>
            {history.length === 0 && (
              <div className="text-center py-10 text-xs" style={{ color: 'var(--text-lighter)' }}>
                No activity yet — events from the shared workspace appear here
              </div>
            )}
            {history.map((evt) => (
              <div key={evt.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid var(--divider)' }}>
                <span
                  className="shrink-0"
                  style={{ width: 8, height: 8, borderRadius: '50%', background: TIMETABLE_EVENT_COLORS[evt.type] ?? 'var(--text-lighter)' }}
                />
                <span className="flex-1 truncate" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                  {evt.label}
                </span>
                <span className="shrink-0" style={{ fontSize: 11, color: 'var(--text-lighter)' }}>{timeLabel(evt.time)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--modal-bg)' }}>
          <div className="bg-base-100 w-full max-w-md" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarCog size={15} style={{ color: 'var(--primary)' }} />
                Meeting details
              </div>
              <button onClick={() => setSelectedMeeting(null)} className="btn btn-ghost btn-sm btn-circle cursor-pointer" style={{ color: 'var(--text-light)' }}>
                <X size={15} />
              </button>
            </div>
            <div style={{ padding: '16px 20px', display: 'grid', gap: 10 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-mono, monospace)' }}>
                  {selectedMeeting.courseCode}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-light)' }}>{selectedMeeting.courseName}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '6px 12px', fontSize: 12.5 }}>
                <span style={{ color: 'var(--text-lighter)', fontWeight: 600 }}>Meeting</span>
                <span style={{ color: 'var(--text)' }}>{meetingLabelOf(selectedMeeting)}</span>
                <span style={{ color: 'var(--text-lighter)', fontWeight: 600 }}>Current</span>
                <span style={{ color: 'var(--text)' }}>{slotTextOf(selectedMeeting)}</span>
                <span style={{ color: 'var(--text-lighter)', fontWeight: 600 }}>Staff</span>
                <span style={{ color: 'var(--text)', overflowWrap: 'anywhere' }}>
                  {selectedMeeting.staffNames.length > 0 ? selectedMeeting.staffNames.join(', ') : selectedMeeting.staffName || '\u2014'}
                </span>
                <span style={{ color: 'var(--text-lighter)', fontWeight: 600 }}>Sections</span>
                <span style={{ color: 'var(--text)' }}>
                  {(selectedMeeting.sections?.length ? selectedMeeting.sections : selectedMeeting.sectionName ? [selectedMeeting.sectionName] : []).join(' + ') || '\u2014'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--surface)' }}>
              <button onClick={() => setSelectedMeeting(null)} className="btn btn-ghost btn-sm cursor-pointer" style={{ color: 'var(--text-light)' }}>
                Close
              </button>
              {canEdit && (
                <button
                  onClick={() => {
                    setMoveTarget(selectedMeeting);
                    setSelectedMeeting(null);
                  }}
                  disabled={saving}
                  className="btn btn-sm gap-1.5 border-none text-white cursor-pointer disabled:opacity-50"
                  style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
                >
                  <Move size={13} />
                  {(((selectedMeeting.endPeriodNo - selectedMeeting.startPeriodNo) - selectedMeeting.startPeriodNo + 1) > 1) ? (
                    'Move this 2-period meeting'
                  ) : (
                    'Move this meeting'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {electivePick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--modal-bg)' }}>
          <div className="bg-base-100 w-full max-w-md" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={15} style={{ color: 'var(--primary)' }} />
                Elective co-location
              </div>
              <button onClick={() => setElectivePick(null)} className="btn btn-ghost btn-sm btn-circle cursor-pointer" style={{ color: 'var(--text-light)' }}>
                <X size={15} />
              </button>
            </div>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--surface)', fontSize: 12, color: 'var(--text-light)' }}>
              These elective courses legitimately share this timetable window. Choose the meeting you want to inspect or move.
            </div>
            <div style={{ padding: '8px 20px', display: 'grid' }}>
              {electivePick.map((s) => (
                <div key={s.scheduleId} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid var(--divider)' }}>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-mono, monospace)' }}>
                      {s.courseCode}
                    </div>
                    <div className="truncate" style={{ fontSize: 11.5, color: 'var(--text-light)' }}>
                      {s.courseName} · {meetingLabelOf(s)} · {slotTextOf(s)}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedMeeting(s);
                      setElectivePick(null);
                    }}
                    className="btn btn-sm btn-ghost cursor-pointer"
                    style={{ color: 'var(--primary)', fontWeight: 700 }}
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px' }}>
              <button onClick={() => setElectivePick(null)} className="btn btn-ghost btn-sm cursor-pointer" style={{ color: 'var(--text-light)' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {moveTarget && canEdit && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4" style={{ pointerEvents: 'none' }}>
          <div className="bg-base-100 flex items-center gap-3 px-4 py-2.5" style={{ borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--primary)', boxShadow: 'var(--shadow-lg)', pointerEvents: 'auto' }}>
            <Move size={14} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
              Moving {moveTarget.courseCode} · {meetingLabelOf(moveTarget)} · {slotTextOf(moveTarget)} — click a target period (P1…P6)
            </span>
            <button onClick={() => setMoveTarget(null)} className="btn btn-ghost btn-xs cursor-pointer" style={{ color: 'var(--text-light)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {pendingSwap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--modal-bg)' }}>
          <div className="bg-base-100 w-full max-w-md" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <RefreshCw size={15} style={{ color: 'var(--primary)' }} />
                Swap schedules?
              </div>
              <button onClick={() => setPendingSwap(null)} className="btn btn-ghost btn-sm btn-circle cursor-pointer" style={{ color: 'var(--text-light)' }}>
                <X size={15} />
              </button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {(() => {
                const dragged = (schedules ?? []).find((s) => s.scheduleId === pendingSwap.scheduleId);
                const occupant = (schedules ?? []).find((s) => s.scheduleId === pendingSwap.withScheduleId);
                return (
                  <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
                    {dragged && (
                      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '2px 12px', fontSize: 12.5 }}>
                        <span style={{ color: 'var(--text-lighter)', fontWeight: 600 }}>Moving</span>
                        <span style={{ color: 'var(--text)' }}>
                          <b style={{ color: 'var(--accent)' }}>{dragged.courseCode}</b> · {meetingLabelOf(dragged)} · {slotTextOf(dragged)}
                        </span>
                        <span style={{ color: 'var(--text-lighter)', fontWeight: 600 }}>Exchange</span>
                        <span style={{ color: 'var(--text)' }}>
                          {occupant ? (
                            <><b style={{ color: 'var(--accent)' }}>{occupant.courseCode}</b> · {meetingLabelOf(occupant)} · {slotTextOf(occupant)}</>
                          ) : (
                            '\u2014'
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
              {!pendingSwap.conflicts ? (
                <p style={{ fontSize: 13, color: 'var(--text-light)', margin: 0 }}>
                  This cell is occupied by another schedule. Swapping exchanges the two schedules&apos; positions.
                </p>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--danger)', fontSize: 12.5, fontWeight: 700 }}>
                    <AlertTriangle size={14} /> Swapping would cause {pendingSwap.conflicts.length} conflict{pendingSwap.conflicts.length === 1 ? '' : 's'}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
                    {pendingSwap.conflicts.map((c, i) => (
                      <li key={i} style={{ fontSize: 12, color: 'var(--text-light)' }}>{c}</li>
                    ))}
                  </ul>
                  <p style={{ fontSize: 12.5, color: 'var(--text-light)', margin: '10px 0 0' }}>
                    You can still force the swap — overlapping classes will be highlighted for manual review.
                  </p>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
                <button
                  onClick={() => setPendingSwap(null)}
                  className="btn btn-ghost btn-sm cursor-pointer"
                  style={{ color: 'var(--text-light)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSwapConfirm(false)}
                  disabled={saving}
                  className="btn btn-sm gap-1.5 border-none text-white cursor-pointer disabled:opacity-50"
                  style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {pendingSwap.conflicts ? 'Force swap' : 'Swap'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--modal-bg)' }}>
          <div className="bg-base-100 w-full max-w-md" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{confirmDialog.title}</div>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-light)', margin: 0 }}>{confirmDialog.message}</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="btn btn-ghost btn-sm cursor-pointer"
                  style={{ color: 'var(--text-light)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await confirmDialog.action();
                    setConfirmDialog(null);
                  }}
                  disabled={saving}
                  className="btn btn-sm gap-1.5 text-white border-none cursor-pointer disabled:opacity-50"
                  style={{
                    background: confirmDialog.tone === 'danger'
                      ? 'linear-gradient(var(--danger), var(--danger-dark))'
                      : 'linear-gradient(var(--primary), var(--primary-dark))',
                  }}
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {confirmDialog.confirmLabel ?? 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInvite && activeLobby && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--modal-bg)' }}>
          <div className="bg-base-100 w-full max-w-md" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={15} style={{ color: 'var(--primary)' }} /> Invite to lobby
              </div>
              <button onClick={() => setShowInvite(false)} className="btn btn-ghost btn-sm btn-circle cursor-pointer" style={{ color: 'var(--text-light)' }}>
                <X size={15} />
              </button>
            </div>
            <div className="max-h-[360px] overflow-y-auto" style={{ padding: '8px 20px' }}>
              {!inviteStaffList && (
                <div className="text-center py-8 text-xs flex items-center justify-center gap-2" style={{ color: 'var(--text-lighter)' }}>
                  <Loader2 size={14} className="animate-spin" /> Loading staff...
                </div>
              )}
              {inviteStaffList && inviteStaffList.length === 0 && (
                <div className="text-center py-8 text-xs" style={{ color: 'var(--text-lighter)' }}>No staff found</div>
              )}
              {(inviteStaffList ?? [])
                .filter((s) => s.staffId !== staff.staffId)
                .filter((s) => !activeLobby.members.some((m) => m.staffId === s.staffId))
                .map((s) => (
                  <div key={s.staffId} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid var(--divider)' }}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 10 }}>
                      {initialsOf(s.staffName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)' }}>{s.staffName}</div>
                      <div className="truncate" style={{ fontSize: 11, color: 'var(--text-lighter)' }}>{s.unitName}</div>
                    </div>
                    <button
                      onClick={() => inviteStaff(s.staffId)}
                      disabled={inviteBusy === s.staffId}
                      className="btn btn-xs btn-ghost gap-1 cursor-pointer disabled:opacity-50"
                      style={{ color: 'var(--primary)' }}
                    >
                      {inviteBusy === s.staffId ? <Loader2 size={11} className="animate-spin" /> : <UserPlus size={11} />}
                      Invite
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {showGroups && (
        <div className="fixed inset-0 z-50 flex items-center justify-end" style={{ background: 'var(--modal-bg)' }}>
          <div className="h-full w-full max-w-[420px] bg-base-100 flex flex-col" style={{ borderLeft: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Blocks size={15} style={{ color: 'var(--primary)' }} /> Combined Classes
              </div>
              <button onClick={() => setShowGroups(false)} className="btn btn-ghost btn-sm btn-circle cursor-pointer" style={{ color: 'var(--text-light)' }}>
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>Create combined class</div>
              <div className="relative mb-3">
                <select
                  value={groupCourseId}
                  onChange={(e) => {
                    setGroupCourseId(e.target.value);
                    setGroupAssignments(new Set());
                  }}
                  className="w-full appearance-none cursor-pointer"
                  style={{
                    fontSize: 13,
                    padding: '8px 30px 8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--surface-border)',
                    background: 'var(--divider)',
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                >
                  <option value="">Select course...</option>
                  {(unitCourses ?? []).map((c) => (
                    <option key={c.courseId} value={c.courseId}>{c.courseCode} — {c.courseName}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-lighter)' }} />
              </div>
              {groupCourseId && (
                <div className="mb-3">
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>
                    Sections to combine ({groupAssignments.size} selected)
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {groupCourseAssignments.length === 0 && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-lighter)' }}>No teaching assignments for this course this term</div>
                    )}
                    {groupCourseAssignments.map((a) => (
                      <label key={a.assignmentId} className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 12, color: 'var(--text)' }}>
                        <input
                          type="checkbox"
                          checked={groupAssignments.has(a.assignmentId)}
                          onChange={() => {
                            setGroupAssignments((prev) => {
                              const next = new Set(prev);
                              if (next.has(a.assignmentId)) next.delete(a.assignmentId);
                              else next.add(a.assignmentId);
                              return next;
                            });
                          }}
                          style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        Section {a.sectionName} — {a.staffName}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={handleCreateGroup}
                disabled={groupsSaving}
                className="w-full btn btn-sm gap-1.5 border-none text-white cursor-pointer disabled:opacity-50"
                style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
              >
                {groupsSaving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Create combined class
              </button>

              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', margin: '20px 0 10px' }}>Existing classes</div>
              {!groups && (
                <div className="text-center py-6 text-xs flex items-center justify-center gap-2" style={{ color: 'var(--text-lighter)' }}>
                  <Loader2 size={14} className="animate-spin" /> Loading...
                </div>
              )}
              {groups && groups.length === 0 && (
                <div className="text-center py-6 text-xs" style={{ color: 'var(--text-lighter)' }}>No combined classes yet</div>
              )}
              {(groups ?? []).map((g) => (
                <div key={g.groupId} className="px-3 py-3 mb-2" style={{ borderRadius: 'var(--radius-md)', border: '1.5px solid var(--surface-border)', background: 'var(--divider)' }}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{g.groupName}</span>
                    <button
                      onClick={() => handleDeleteGroup(g)}
                      className="btn btn-ghost btn-xs btn-circle cursor-pointer"
                      style={{ color: 'var(--danger)' }}
                      title="Delete combined class"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-lighter)', marginBottom: 6 }}>
                    {g.courseCode} · Semester {g.semesterNo} · {g.members.length} sections
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {g.members.map((m, i) => (
                      <span
                        key={m.assignmentId}
                        className="badge badge-xs"
                        style={{
                          background: `rgba(40,114,161,${0.08 + i * 0.03})`,
                          color: 'var(--primary)',
                          border: 'none',
                          fontWeight: 600,
                        }}
                      >
                        Sec {m.sectionName} · {m.staffName}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCmr && generation && (
        <div className="fixed inset-0 z-50 flex items-center justify-end" style={{ background: 'var(--modal-bg)' }}>
          <div className="h-full w-full max-w-[440px] bg-base-100 flex flex-col" style={{ borderLeft: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={15} style={{ color: 'var(--primary)' }} /> Meeting Requirements
              </div>
              <button onClick={() => setShowCmr(false)} className="btn btn-ghost btn-sm btn-circle cursor-pointer" style={{ color: 'var(--text-light)' }}>
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CourseRequirementsPanel
                unitId={staff.unitId}
                lobbyId={lobby?.lobbyId ?? null}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Timetable generation — hub (create lobby, waiting room, past activity)
// ============================================================================

function EmptyStateCard({ icon, title, message }: { icon: ReactNode; title: string; message: string }) {
  return (
    <div className="bg-base-100 backdrop-blur-xl text-center py-16 px-6" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="mx-auto mb-4 flex items-center justify-center w-14 h-14 rounded-2xl" style={{ background: 'var(--secondary-lighter)', color: 'var(--text-lighter)' }}>
        {icon}
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', margin: '0 0 6px' }}>{title}</h3>
      <p style={{ fontSize: 12.5, color: 'var(--text-light)', margin: 0, maxWidth: 420, marginInline: 'auto' }}>{message}</p>
    </div>
  );
}

function CreateLobbyCard({ onCreate, busy, disabled }: { onCreate: () => void; busy: boolean; disabled?: boolean }) {
  return (
    <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(40,114,161,0.12)', color: 'var(--primary)' }}>
            <CalendarCog size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>Start a Generation Session</h3>
            <p style={{ fontSize: 12, color: 'var(--text-light)', margin: '3px 0 0' }}>Create a shared lobby for this term&apos;s timetable</p>
          </div>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-light)', margin: '0 0 16px', lineHeight: 1.6 }}>
          Invite your teaching staff to join, then generate a conflict-free weekly timetable together.
          The draft is edited collaboratively in real time before publishing.
        </p>
        <button
          onClick={onCreate}
          disabled={busy || disabled}
          className="btn btn-sm gap-1.5 border-none text-white cursor-pointer disabled:opacity-50"
          style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Create lobby
        </button>
      </div>
    </div>
  );
}

function ActiveLobbyCard({
  lobby,
  isHod,
  staffId,
  busy,
  onJoin,
  onInvite,
  onCancel,
  onStart,
}: {
  lobby: TimetableLobbyResponse;
  isHod: boolean;
  staffId: string;
  busy: string | null;
  onJoin: () => void;
  onInvite: () => void;
  onCancel: () => void;
  onStart: () => void;
}) {
  const isMember = lobby.members.some((m) => m.staffId === staffId);
  const hasJoined = lobby.members.some((m) => m.staffId === staffId && m.joined);
  const joined = lobby.members.filter((m) => m.joined);
  const pending = lobby.members.filter((m) => !m.joined);
  const allJoined = lobby.members.length > 0 && pending.length === 0;
  const generating = lobby.status === 'GENERATING';
  return (
    <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1.5px solid rgba(40,114,161,0.35)', boxShadow: '0 4px 20px rgba(40,114,161,0.12)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '18px 24px', borderBottom: '1px solid var(--surface)', flexWrap: 'wrap' }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(40,114,161,0.12)', color: 'var(--primary)' }}>
            {generating ? <Loader2 size={20} className="animate-spin" /> : <Radio size={20} />}
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>
              {lobby.academicYear} Generation Lobby
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-light)', margin: '3px 0 0' }}>
              Led by {lobby.leaderName} · {generating ? 'Generating...' : 'Open'}
            </p>
          </div>
        </div>
        <span
          className="badge gap-1"
          style={{
            background: generating ? 'rgba(217,119,6,0.15)' : 'rgba(40,114,161,0.15)',
            color: generating ? '#d97706' : 'var(--primary)',
            border: 'none',
            fontWeight: 700,
          }}
        >
          {generating && <Loader2 size={11} className="animate-spin" />}
          {generating ? 'GENERATING' : 'OPEN'}
        </span>
      </div>
      <div style={{ padding: '18px 24px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>
          Members — {joined.length}/{lobby.members.length} joined
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {lobby.members.map((m, i) => (
            <div key={m.memberId} className="flex items-center gap-3 px-3 py-2" style={{ borderRadius: 'var(--radius-md)', background: 'var(--divider)' }}>
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${MEMBER_COLORS[i % MEMBER_COLORS.length]} flex items-center justify-center text-white font-bold shrink-0`} style={{ fontSize: 10 }}>
                {initialsOf(m.staffName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)' }}>{m.staffName}</div>
                <div className="truncate" style={{ fontSize: 11, color: 'var(--text-lighter)' }}>{m.unitName}</div>
              </div>
              {m.joined ? (
                <span className="badge badge-xs gap-1 shrink-0" style={{ background: 'rgba(16,185,129,0.15)', color: '#059669', border: 'none', fontWeight: 700 }}>
                  <Check size={10} /> Joined
                </span>
              ) : (
                <span className="badge badge-xs shrink-0" style={{ background: 'rgba(251,191,36,0.15)', color: '#d97706', border: 'none', fontWeight: 700 }}>
                  Pending
                </span>
              )}
            </div>
          ))}
          {lobby.members.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-lighter)' }}>No members invited yet</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {!hasJoined && (
            <button
              onClick={onJoin}
              disabled={busy === 'join' || generating}
              className="btn btn-sm gap-1.5 border-none text-white cursor-pointer disabled:opacity-50"
              style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
            >
              {busy === 'join' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Join lobby
            </button>
          )}
          {isHod && (
            <button
              onClick={onInvite}
              disabled={busy === 'invite' || generating}
              className="btn btn-ghost btn-sm gap-1.5 cursor-pointer disabled:opacity-50"
              style={{ color: 'var(--primary)', border: '1.5px solid var(--surface-border)' }}
            >
              <UserPlus size={13} /> Invite staff
            </button>
          )}
          {isHod && (
            <button
              onClick={onStart}
              disabled={!allJoined || generating}
              className="btn btn-sm gap-1.5 cursor-pointer disabled:opacity-50"
              style={{
                background: allJoined && !generating ? 'linear-gradient(var(--success), #0d9668)' : 'var(--divider)',
                color: allJoined && !generating ? '#fff' : 'var(--text-light)',
                border: 'none',
              }}
              title={allJoined ? 'Create the generation and open the shared workspace' : 'Wait until every member has joined'}
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              {generating ? 'Starting...' : 'Start generation'}
            </button>
          )}
          {isHod && (
            <button
              onClick={onCancel}
              disabled={busy === 'cancel' || generating}
              className="btn btn-ghost btn-sm gap-1.5 cursor-pointer disabled:opacity-50"
              style={{ color: 'var(--danger)' }}
            >
              <XCircle size={13} /> Cancel lobby
            </button>
          )}
          {!isMember && pending.some((m) => m.staffId === staffId) && (
            <span style={{ fontSize: 12, color: 'var(--text-lighter)', alignSelf: 'center' }}>
              You were invited — waiting for the leader to start
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PastLobbiesCard({ lobbies }: { lobbies: TimetableLobbyResponse[] }) {
  return (
    <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={15} style={{ color: 'var(--primary)' }} /> Past Lobbies
        </h3>
      </div>
      <div style={{ padding: '12px 20px' }}>
        {lobbies.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-lighter)' }}>No past lobbies</div>
        )}
        {lobbies.map((l) => (
          <div key={l.lobbyId} className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: '1px solid var(--divider)' }}>
            <div className="min-w-0">
              <div className="truncate" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{l.academicYear}</div>
              <div className="truncate" style={{ fontSize: 11, color: 'var(--text-lighter)' }}>Led by {l.leaderName} · {l.members.length} members</div>
            </div>
            <span
              className="badge badge-xs shrink-0"
              style={{
                background: l.status === 'COMPLETED' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                color: l.status === 'COMPLETED' ? '#059669' : '#dc2626',
                border: 'none',
                fontWeight: 700,
              }}
            >
              {l.status === 'COMPLETED' ? 'Completed' : 'Cancelled'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GeneratedTimetablesCard({
  generations,
  canManage,
  onView,
  onDelete,
}: {
  generations: GenerationSessionResponse[];
  canManage: boolean;
  onView: (generationId: string) => void;
  onDelete: (generation: GenerationSessionResponse) => void;
}) {
  const sorted = [...generations].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  return (
    <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarDays size={15} style={{ color: 'var(--primary)' }} /> Generation Sessions
        </h3>
      </div>
      <div style={{ padding: '12px 20px' }}>
        {sorted.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-lighter)' }}>No generation sessions yet</div>
        )}
        {sorted.slice(0, 6).map((g) => (
          <div key={g.generationId} className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: '1px solid var(--divider)' }}>
            <div className="min-w-0">
              <div className="truncate" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{g.academicYear}</div>
              <div className="truncate" style={{ fontSize: 11, color: 'var(--text-lighter)' }}>by {g.generatedByStaffNo} · {timeLabel(new Date(g.createdAt).getTime())}</div>
            </div>
            <GenerationStatusPill status={g.status} />
            {canManage && (g.status === 'COMPLETED' || g.status === 'PUBLISHED') && (
              <button
                onClick={() => onView(g.generationId)}
                className="btn btn-ghost btn-xs gap-1 cursor-pointer shrink-0"
                style={{ color: 'var(--primary)' }}
              >
                <Eye size={12} /> View
              </button>
            )}
            {canManage && (g.status === 'PENDING' || g.status === 'FAILED') && (
              <button
                onClick={() => onDelete(g)}
                className="btn btn-ghost btn-xs btn-circle cursor-pointer shrink-0"
                style={{ color: 'var(--danger)' }}
                title="Delete generation"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TimetableGenerationSection() {
  const [staff, setStaff] = useState<StaffRecord | null>(null);
  const [terms, setTerms] = useState<AcademicTermRecord[]>([]);
  const [lobbies, setLobbies] = useState<TimetableLobbyResponse[] | null>(null);
  const [generations, setGenerations] = useState<GenerationSessionResponse[] | null>(null);
  const [manage, setManage] = useState<GenerationManageResponse | null>(null);
  const [activeTermId, setActiveTermId] = useState('');
  const [workspaceGenerationId, setWorkspaceGenerationId] = useState<string | null>(null);
  const [draftDismissed, setDraftDismissed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteStaffList, setInviteStaffList] = useState<StaffRecord[] | null>(null);
  const [inviteBusy, setInviteBusy] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const isHod = staff ? staff.positions.includes('HOD') : false;
  const activeLobby = lobbies?.find((l) => l.status === 'OPEN' || l.status === 'GENERATING') ?? null;
  const pastLobbies = (lobbies ?? []).filter((l) => l.status === 'CANCELLED' || l.status === 'COMPLETED');
  // Realtime bookkeeping: dedupe MANAGEMENT_STARTED navigation across repeated
  // events, and remember generation ids that no longer exist so the draft
  // auto-entry effect can never navigate into a deleted session (the source of
  // the "Generation session not found" dead end).
  const lastManagementStartRef = useRef<string | null>(null);
  const deadGenerationIdsRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      // Required data: the hub cannot render without the staff profile and the
      // academic term list. Everything else loads in the background below so a
      // slow or failing optional request never blocks the whole page.
      const [staffRecord, termList] = await Promise.all([
        getCurrentStaff(),
        apiFetch<AcademicTermRecord[]>('/api/terms'),
      ]);
      setStaff(staffRecord);
      setTerms(termList);
      const active = termList.find((t) => t.status === 'ACTIVE') ?? termList[0];
      setActiveTermId((prev) => prev || active?.termId || '');
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load timetable generation');
      setLoading(false);
      return;
    }
    // Optional data: lobby status and generation history refresh independently
    // (and via realtime events); their failure must not freeze the hub.
    getGenerationLobbies()
      .then(setLobbies)
      .catch(() => setNotice('Generation lobby status could not be loaded — it will refresh automatically.'));
    getGenerations()
      .then(setGenerations)
      .catch(() => setNotice('Generation history could not be loaded — it will refresh automatically.'));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial hub load
    load();
  }, [load]);

  useEffect(() => {
    if (!activeTermId) return;
    getGenerationManage(activeTermId)
      .then(setManage)
      .catch(() => {});
  }, [activeTermId, workspaceGenerationId]);

  useEffect(() => {
    const draftId = manage?.generation?.generationId;
    if (!draftId || workspaceGenerationId || draftDismissed) return;
    // Never auto-enter a generation that is known to be gone.
    if (deadGenerationIdsRef.current.has(draftId)) return;
    setWorkspaceGenerationId(draftId);
  }, [manage, workspaceGenerationId, draftDismissed]);

  const refreshLobbies = useCallback(async () => {
    try {
      const list = await getGenerationLobbies();
      setLobbies(list);
    } catch {
      // transient
    }
  }, []);

  // Discovery channel: SSE is lobby-scoped and membership-gated, so a HOD who
  // has not joined any lobby has no stream and would never learn that a lobby
  // was created or cancelled. Poll the authoritative list lightly — only while
  // no active lobby exists, the tab is visible, and stop once subscribed.
  useEffect(() => {
    if (activeLobby) return;
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      refreshLobbies();
    };
    const interval = setInterval(tick, 8000);
    return () => clearInterval(interval);
  }, [activeLobby, refreshLobbies]);

  // Re-authoritative on tab focus / visibility regain regardless of state.
  useEffect(() => {
    const onFocus = () => refreshLobbies();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refreshLobbies]);

  useTimetableRealtime(activeLobby?.lobbyId ?? null, (event) => {
    switch (event.type) {
      case TIMETABLE_REALTIME_EVENTS.MANAGEMENT_STARTED:
        if (event.generationId && deadGenerationIdsRef.current.has(event.generationId)) break;
        // Duplicate delivery (e.g. after reconnect) must not re-navigate.
        if (event.generationId && lastManagementStartRef.current === event.generationId) break;
        if (event.generationId) {
          lastManagementStartRef.current = event.generationId;
          setDraftDismissed(false);
          setWorkspaceGenerationId(event.generationId);
          toast.success('Timetable management started — opening the shared workspace');
        } else {
          // Payload without an id: fall back to the authoritative list.
          refreshLobbies();
        }
        break;
      case TIMETABLE_REALTIME_EVENTS.LOBBY_MEMBER_JOINED:
      case TIMETABLE_REALTIME_EVENTS.LOBBY_CANCELLED:
      case TIMETABLE_REALTIME_EVENTS.GENERATION_STARTED:
      case TIMETABLE_REALTIME_EVENTS.GENERATION_COMPLETED:
      case TIMETABLE_REALTIME_EVENTS.GENERATION_FAILED:
      case TIMETABLE_REALTIME_EVENTS.TIMETABLE_PUBLISHED:
      case TIMETABLE_REALTIME_EVENTS.TIMETABLE_DELETED: {
        const removedId = event.type === TIMETABLE_REALTIME_EVENTS.TIMETABLE_DELETED
          ? event.generationId : null;
        if (removedId) deadGenerationIdsRef.current.add(removedId);
        if (
          removedId &&
          (workspaceGenerationId === removedId || lastManagementStartRef.current === removedId)
        ) {
          lastManagementStartRef.current = null;
        }
        refreshLobbies();
        getGenerations().then(setGenerations).catch(() => {});
        break;
      }
      default:
        break;
    }
  }, () => {
    // Stream (re)connected: SSE has no replay, so merge the authoritative
    // snapshot now. This recovers join/leave/start events missed while the
    // connection was down without requiring any manual refresh.
    refreshLobbies();
    getGenerations().then(setGenerations).catch(() => {});
  });

  const handleCreateLobby = async () => {
    if (!activeTermId || creating) return;
    setCreating(true);
    try {
      const lobby = await createGenerationLobby({ termId: activeTermId });
      setLobbies((prev) => [lobby, ...(prev ?? [])]);
      toast.success('Generation lobby created — invite your staff');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create lobby');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!activeLobby || busy) return;
    setBusy('join');
    try {
      await joinGenerationLobby(activeLobby.lobbyId);
      await refreshLobbies();
      toast.success('You joined the generation lobby');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not join lobby');
    } finally {
      setBusy(null);
    }
  };

  const handleCancelLobby = () => {
    if (!activeLobby) return;
    setConfirmDialog({
      title: 'Cancel this lobby?',
      message: 'All invited members will be notified and the lobby closed.',
      confirmLabel: 'Cancel lobby',
      tone: 'danger',
      action: async () => {
        try {
          await cancelGenerationLobby(activeLobby.lobbyId);
          await refreshLobbies();
          toast.success('Lobby cancelled');
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Could not cancel lobby');
        }
      },
    });
  };

  const handleStartGeneration = async () => {
    if (!activeLobby || busy) return;
    setBusy('start');
    try {
      const updated = await generateFromLobby(activeLobby.lobbyId);
      // Open the shared workspace for the creator right away; the realtime
      // MANAGEMENT_STARTED event redirects the other joined HODs.
      if (updated?.generationId) {
        lastManagementStartRef.current = updated.generationId;
        setDraftDismissed(false);
        setWorkspaceGenerationId(updated.generationId);
      }
    } catch (e) {
      // The dispatch may still succeed server-side on slow database days even
      // after the client gives up waiting. Probe the authoritative lobby a few
      // times with the exact identity; only surface an error when it truly
      // never appeared. Never guess by "latest session".
      let recovered: string | null = null;
      for (let attempt = 0; attempt < 3 && !recovered; attempt++) {
        await new Promise((r) => setTimeout(r, 1200));
        try {
          const list = await getGenerationLobbies();
          setLobbies(list);
          const genId = list.find((l) => l.lobbyId === activeLobby.lobbyId)?.generationId ?? null;
          if (genId && !deadGenerationIdsRef.current.has(genId)) recovered = genId;
        } catch {
          // keep probing
        }
      }
      if (recovered) {
        lastManagementStartRef.current = recovered;
        setDraftDismissed(false);
        setWorkspaceGenerationId(recovered);
        toast.success('Timetable management started — opening the shared workspace');
      } else {
        refreshLobbies().catch(() => {});
        toast.error(e instanceof Error ? e.message : 'Could not start generation');
      }
    } finally {
      setBusy(null);
    }
  };

  const openInvite = async () => {
    setShowInvite(true);
    setInviteStaffList(null);
    try {
      const list = await apiFetch<StaffRecord[]>('/api/staff');
      setInviteStaffList(list);
    } catch {
      setInviteStaffList([]);
    }
  };

  const inviteStaff = async (targetStaffId: string) => {
    if (!activeLobby || inviteBusy) return;
    setInviteBusy(targetStaffId);
    try {
      await inviteLobbyMember(activeLobby.lobbyId, targetStaffId);
      await refreshLobbies();
      toast.success('Invitation sent');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not invite staff');
    } finally {
      setInviteBusy(null);
    }
  };

  const handleViewGeneration = (generationId: string) => {
    setWorkspaceGenerationId(generationId);
  };

  const handleDeleteGeneration = (g: GenerationSessionResponse) => {
    setConfirmDialog({
      title: 'Delete this generation?',
      message: `The ${g.academicYear} generation and its schedules will be permanently removed.`,
      confirmLabel: 'Delete',
      tone: 'danger',
      action: async () => {
        try {
          await deleteGeneration(g.generationId);
          setGenerations((prev) => (prev ?? []).filter((x) => x.generationId !== g.generationId));
          toast.success('Generation deleted');
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Could not delete generation');
        }
      },
    });
  };

  if (workspaceGenerationId && staff) {
    return (
      <SharedTimetableWorkspace
        generationId={workspaceGenerationId}
        onBack={() => {
          setDraftDismissed(true);
          setWorkspaceGenerationId(null);
          load();
        }}
        onNotFound={(goneId) => {
          // The referenced session does not exist (e.g. a stale draft id).
          // Record it so no effect navigates there again, then return to the
          // hub — no reload required.
          deadGenerationIdsRef.current.add(goneId);
          if (lastManagementStartRef.current === goneId) lastManagementStartRef.current = null;
          setDraftDismissed(true);
          setWorkspaceGenerationId(null);
          load();
        }}
        staff={staff}
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="flex items-center gap-2" style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>
            <CalendarCog size={22} style={{ color: 'var(--primary)' }} /> Timetable Generation
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-light)', margin: '4px 0 0' }}>
            Create, collaborate and publish the weekly timetable with your teaching staff
          </p>
        </div>
        {terms.length > 0 && (
          <div className="relative">
            <select
              value={activeTermId}
              onChange={(e) => setActiveTermId(e.target.value)}
              className="appearance-none cursor-pointer"
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: '8px 30px 8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--surface-border)',
                background: 'var(--divider)',
                color: 'var(--text)',
                outline: 'none',
              }}
            >
              {terms.map((t) => (
                <option key={t.termId} value={t.termId}>
                  {t.academicYear} {t.status === 'ACTIVE' ? '· Active' : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-lighter)' }} />
          </div>
        )}
      </div>

      {error && !staff && (
        <div
          className="flex items-center gap-2 px-4 py-3 mt-4"
          style={{ borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.3)', color: 'var(--danger)', fontSize: 12.5 }}
        >
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={load} className="btn btn-ghost btn-xs gap-1.5 cursor-pointer" style={{ color: 'var(--primary)' }}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {notice && (
        <div
          className="flex items-center gap-2 px-4 py-3 mt-4"
          style={{ borderRadius: 'var(--radius-md)', background: 'rgba(251,191,36,0.12)', border: '1.5px solid rgba(217,119,6,0.35)', color: '#b45309', fontSize: 12.5 }}
        >
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} className="btn btn-ghost btn-xs cursor-pointer" style={{ color: 'var(--text-light)' }}>
            <X size={12} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 size={22} className="animate-spin" style={{ color: 'var(--primary)' }} />
          <div style={{ fontSize: 13, color: 'var(--text-lighter)' }}>Loading generation hub...</div>
        </div>
      ) : !staff ? (
        <div style={{ marginTop: 18 }}>
          <EmptyStateCard
            icon={<ShieldCheck size={26} />}
            title="Sign in required"
            message="We could not load your staff profile. Please refresh the page to try again."
          />
        </div>
      ) : !isHod ? (
        <div style={{ marginTop: 18 }}>
          <EmptyStateCard
            icon={<ShieldCheck size={26} />}
            title="HOD access required"
            message="Only HOD lecturers can manage timetable generation. If you believe this is an error, contact the system administrator."
          />
        </div>
      ) : !activeTermId ? (
        <div style={{ marginTop: 18 }}>
          <EmptyStateCard
            icon={<CalendarDays size={26} />}
            title="No academic term"
            message="No active academic term was found. The university server must have an active term before a timetable can be generated."
          />
        </div>
      ) : (
        <div style={{ marginTop: 18, display: 'grid', gap: 18 }}>
          {!activeLobby && (
            <CreateLobbyCard onCreate={handleCreateLobby} busy={creating} />
          )}
          {activeLobby && (
            <ActiveLobbyCard
              lobby={activeLobby}
              isHod={isHod}
              staffId={staff.staffId}
              busy={busy}
              onJoin={handleJoin}
              onInvite={openInvite}
              onCancel={handleCancelLobby}
              onStart={handleStartGeneration}
            />
          )}
          <GeneratedTimetablesCard
            generations={generations ?? []}
            canManage={manage?.canManage === true}
            onView={handleViewGeneration}
            onDelete={handleDeleteGeneration}
          />
          <PastLobbiesCard lobbies={pastLobbies} />
        </div>
      )}

      {showInvite && activeLobby && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--modal-bg)' }}>
          <div className="bg-base-100 w-full max-w-md" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={15} style={{ color: 'var(--primary)' }} /> Invite to lobby
              </div>
              <button onClick={() => setShowInvite(false)} className="btn btn-ghost btn-sm btn-circle cursor-pointer" style={{ color: 'var(--text-light)' }}>
                <X size={15} />
              </button>
            </div>
            <div className="max-h-[360px] overflow-y-auto" style={{ padding: '8px 20px' }}>
              {!inviteStaffList && (
                <div className="text-center py-8 text-xs flex items-center justify-center gap-2" style={{ color: 'var(--text-lighter)' }}>
                  <Loader2 size={14} className="animate-spin" /> Loading staff...
                </div>
              )}
              {inviteStaffList && inviteStaffList.length === 0 && (
                <div className="text-center py-8 text-xs" style={{ color: 'var(--text-lighter)' }}>No staff found</div>
              )}
              {(inviteStaffList ?? [])
                .filter((s) => s.staffId !== staff?.staffId)
                .filter((s) => !activeLobby.members.some((m) => m.staffId === s.staffId))
                .map((s) => (
                  <div key={s.staffId} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid var(--divider)' }}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 10 }}>
                      {initialsOf(s.staffName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)' }}>{s.staffName}</div>
                      <div className="truncate" style={{ fontSize: 11, color: 'var(--text-lighter)' }}>{s.unitName}</div>
                    </div>
                    <button
                      onClick={() => inviteStaff(s.staffId)}
                      disabled={inviteBusy === s.staffId}
                      className="btn btn-xs btn-ghost gap-1 cursor-pointer disabled:opacity-50"
                      style={{ color: 'var(--primary)' }}
                    >
                      {inviteBusy === s.staffId ? <Loader2 size={11} className="animate-spin" /> : <UserPlus size={11} />}
                      Invite
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--modal-bg)' }}>
          <div className="bg-base-100 w-full max-w-md" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{confirmDialog.title}</div>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-light)', margin: 0 }}>{confirmDialog.message}</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="btn btn-ghost btn-sm cursor-pointer"
                  style={{ color: 'var(--text-light)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await confirmDialog.action();
                    setConfirmDialog(null);
                  }}
                  className="btn btn-sm gap-1.5 text-white border-none cursor-pointer"
                  style={{
                    background: confirmDialog.tone === 'danger'
                      ? 'linear-gradient(var(--danger), var(--danger-dark))'
                      : 'linear-gradient(var(--primary), var(--primary-dark))',
                  }}
                >
                  <Check size={13} />
                  {confirmDialog.confirmLabel ?? 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Timetable — published weekly view (all lecturers)
// ============================================================================

export function TimetableSection() {
  const terms = useUniversityData<AcademicTermRecord[]>(
    useCallback(() => apiFetch<AcademicTermRecord[]>('/api/terms'), [])
  );
  const [termId, setTermId] = useState('');
  useEffect(() => {
    if (!termId && terms.data && terms.data.length > 0) {
      const active = terms.data.find((t) => t.status === 'ACTIVE') ?? terms.data[0];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- default to active term
      setTermId(active.termId);
    }
  }, [terms.data, termId]);
  const schedules = useUniversityData<ScheduleResponse[]>(
    useCallback(
      () => (termId ? getPublishedSchedules(termId) : Promise.resolve([])),
      [termId]
    )
  );
  const [todayIdx, setTodayIdx] = useState(-1);
  useEffect(() => {
    const d = new Date().getDay();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- compute today column once on mount
    setTodayIdx(d >= 1 && d <= 5 ? d - 1 : -1);
  }, []);

  const published = useMemo(() => schedules.data ?? [], [schedules.data]);
  const [viewSemester, setViewSemester] = useState<number | 'all'>('all');
  const [viewSection, setViewSection] = useState<string>('all');
  const publishedSemOptions = useMemo(
    () => [...new Set(published.map((s) => s.semesterNo))].sort((a, b) => a - b),
    [published]
  );
  const publishedSectionOptions = useMemo(
    () => [...new Set(published.flatMap((s) => s.sections ?? []))].sort(),
    [published]
  );
  const activePublishedSem = viewSemester;
  const activePublishedSection = viewSection !== 'all' && publishedSectionOptions.includes(viewSection) ? viewSection : 'all';
  const visiblePublished = useMemo(
    () =>
      published.filter(
        (s) =>
          (activePublishedSem === 'all' || s.semesterNo === activePublishedSem) &&
          (activePublishedSection === 'all' || (s.sections ?? []).includes(activePublishedSection))
      ),
    [published, activePublishedSem, activePublishedSection]
  );
  const { periodLabels, lunchLabel } = useTimeSlotLabels();

  return (
    <div>
      {(terms.error && !terms.data) || (schedules.error && !schedules.data) ? (
        <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>
          University server unreachable — retrying—
        </div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>Timetable</h1>
          <p style={{ fontSize: 14, color: 'var(--text-light)', margin: '4px 0 0' }}>Your weekly lecture and lab schedule</p>
        </div>
        {terms.data && terms.data.length > 0 && (
          <div className="relative">
            <select
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              className="appearance-none cursor-pointer"
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: '8px 30px 8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--surface-border)',
                background: 'var(--divider)',
                color: 'var(--text)',
                outline: 'none',
              }}
            >
              {terms.data.map((t) => (
                <option key={t.termId} value={t.termId}>
                  {t.academicYear} {t.status === 'ACTIVE' ? '· Active' : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-lighter)' }} />
          </div>
        )}
      </div>
      <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--surface)', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={15} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
              Weekly View {visiblePublished.length > 0 ? `(${visiblePublished.length} schedules${activePublishedSem !== 'all' ? ` · Semester ${activePublishedSem}` : ' · overview'}${activePublishedSection !== 'all' ? ` · Section ${activePublishedSection}` : ''})` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {publishedSemOptions.length > 1 && (
              <select
                value={String(activePublishedSem)}
                onChange={(e) => setViewSemester(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="cursor-pointer"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1.5px solid var(--surface-border)',
                  background: 'var(--divider)',
                  color: 'var(--text)',
                  outline: 'none',
                }}
                title="Filter the timetable by semester — 'All semesters' is an overview mode where all cohorts are drawn together"
              >
                <option value="all">All semesters (overview)</option>
                {publishedSemOptions.map((n) => (
                  <option key={n} value={n}>Semester {n}</option>
                ))}
              </select>
            )}
            {publishedSectionOptions.length > 1 && (
              <select
                value={activePublishedSection}
                onChange={(e) => setViewSection(e.target.value)}
                className="cursor-pointer"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1.5px solid var(--surface-border)',
                  background: 'var(--divider)',
                  color: 'var(--text)',
                  outline: 'none',
                }}
                title="Filter the timetable by section"
              >
                <option value="all">All sections</option>
                {publishedSectionOptions.map((n) => (
                  <option key={n} value={n}>Section {n}</option>
                ))}
              </select>
            )}
            {activePublishedSem === 'all' && publishedSemOptions.length > 1 && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(251,191,36,0.14)',
                  color: '#b45309',
                  border: '1px dashed rgba(217,119,6,0.4)',
                }}
                title="All cohorts are shown as separate tables here — one table per semester and section, so different cohorts never share a cell"
              >
                Overview — one table per semester &amp; section
              </span>
            )}
            <span className="badge badge-xs" style={{ background: 'rgba(40,114,161,0.15)', color: 'var(--primary)', border: 'none' }}>Lecture</span>
            <span className="badge badge-xs" style={{ background: 'rgba(139,92,246,0.15)', color: '#7c3aed', border: 'none' }}>LMS</span>
            <span className="badge badge-xs" style={{ background: 'rgba(251,191,36,0.15)', color: '#d97706', border: 'none' }}>Assignment</span>
            <span className="badge badge-xs" style={{ background: 'rgba(100,116,139,0.15)', color: '#64748b', border: 'none' }}>Break</span>
          </div>
        </div>
        <div style={{ padding: '16px 18px', overflowX: 'auto' }}>
          {visiblePublished.length === 0 ? (
            <div className="text-center py-16">
              <CalendarCog size={32} className="mx-auto mb-3 opacity-30" />
              <p style={{ fontSize: 12.5, color: 'var(--text-lighter)', margin: 0 }}>
                {published.length === 0
                  ? 'No timetable published for this term yet'
                  : 'No schedules for the selected semester or section in this published timetable'}
              </p>
            </div>
          ) : (
            <WeeklyTimetableGrid
                  schedules={visiblePublished}
                  editable={false}
                  periodLabels={periodLabels}
                  lunchLabel={lunchLabel}
                  todayIdx={todayIdx}
                />
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
