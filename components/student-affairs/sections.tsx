'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import WelcomeBar from '@/components/shared/WelcomeBar';
import StatCard from '@/components/shared/StatCard';
import MessageItem from '@/components/shared/MessageItem';
import FeedPost from '@/components/shared/FeedPost';
import LostFoundPage from '@/components/shared/LostFoundSection';
import QuickAccess from '@/components/shared/QuickAccess';
import DataTable from '@/components/shared/DataTable';
import ThemeSwitcher from '@/components/shared/ThemeSwitcher';
import {
  Users, CalendarCheck, MessageSquare, ClipboardList,
  GraduationCap, BookOpen, Search, Filter, Plus, Download,
  Check, X, Eye,
  ClipboardCheck, Mail, Newspaper, Upload, Save, Bell, Ban,
} from 'lucide-react';
import type { StudentData, RollCallData } from '@/components/shared/types';
import { apiFetch, markAttendance } from '@/components/shared/api';
import type {
  AcademicTermRecord, AttendanceRecord, ClassSessionRecord,
  ScheduleRecord, StudentRecord,
} from '@/components/shared/api';
import { useUniversityData } from '@/components/shared/useUniversityData';
import { useSupabase } from '@/utils/supabase/client';
import { useFeedPosts, useConversations } from '@/lib/supabase/hooks';
import { useSession } from '@/components/shared/session';
import { toast } from 'sonner';
export { default as FeedSection } from '@/components/shared/FeedSection';
export { default as MessagesSection } from '@/components/shared/MessagesSection';
import BlockedSection from '@/components/shared/BlockedSection';

interface TimetableEntry {
  time: string;
  mon: string; tue: string; wed: string; thu: string; fri: string;
}

const PERIOD_START_MIN = [8 * 60, 9 * 60 + 45, 11 * 60 + 30, 14 * 60, 15 * 60 + 45, 17 * 60 + 30, 19 * 60 + 15];

function initialsOf(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => (w[0] || '').toUpperCase()).join('');
}

function ordinalSuffix(n: number): string {
  const rem = n % 10;
  const hundred = n % 100;
  if (hundred >= 11 && hundred <= 13) return `${n}th`;
  if (rem === 1) return `${n}st`;
  if (rem === 2) return `${n}nd`;
  if (rem === 3) return `${n}rd`;
  return `${n}th`;
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
  const d = new Date(ts);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function Dashboard() {
  const { user: session } = useSession();
  const me = session?.email ?? '';
  const supabase = useSupabase();
  const { posts, loading: postsLoading } = useFeedPosts(supabase);
  const { conversations, loading: convLoading } = useConversations(supabase, me);

  return (
    <div>
      <WelcomeBar name="Student Affairs Office" subtitle="Student services overview — 3 pending requests and 2 upcoming events this week" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard icon={<GraduationCap size={20} />} iconBgClass="bg-primary/10 text-primary" value="2,847" label="Active Students" trend="+124 this year" />
        <StatCard icon={<CalendarCheck size={20} />} iconBgClass="bg-success/10 text-success" value={16} label="Upcoming Events" trend="This month" />
        <StatCard icon={<MessageSquare size={20} />} iconBgClass="bg-warning/10 text-warning" value={24} label="New Messages" trend="8 unread" />
        <StatCard icon={<ClipboardList size={20} />} iconBgClass="bg-error/10 text-error" value={12} label="Pending Requests" trend="Need review" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-[18px]">
        <div>
          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Newspaper size={16} /> University News Feed
              </div>
              <Link href="/student-affair/feed" style={{ fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, padding: '6px 14px', borderRadius: 'var(--radius-sm)', textDecoration: 'none', display: 'inline-block' }}>
                View All <span style={{ fontSize: 10 }}>→</span>
              </Link>
            </div>
            <div style={{ display: 'flex', gap: 4, padding: '0 22px', borderBottom: '1px solid var(--surface)' }}>
              {['Latest', 'Trending', 'Official'].map((tab, i) => (
                <button key={tab} style={{
                  padding: '12px 16px', fontSize: 13, fontWeight: 600,
                  color: i === 0 ? 'var(--primary)' : 'var(--text-light)',
                  cursor: 'pointer', borderBottom: '2.5px solid transparent',
                  borderBottomColor: i === 0 ? 'var(--primary)' : 'transparent',
                  background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                  marginBottom: -1,
                }}>
                  {tab}
                </button>
              ))}
            </div>
            <div style={{ padding: 0 }}>
              {!posts && postsLoading && (
                <div style={{ padding: '24px 22px', textAlign: 'center', color: 'var(--text-lighter)', fontSize: 13 }}>Loading...</div>
            )}
            {posts && posts.length === 0 && (
              <div style={{ padding: '24px 22px', textAlign: 'center', color: 'var(--text-lighter)', fontSize: 13 }}>No posts yet</div>
            )}
            {posts?.slice(0, 2).map((post) => (
              <FeedPost key={post.id} post={post} />
            ))}
            </div>
          </div>
        </div>
        <div>
          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarCheck size={16} /> Upcoming Events
              </div>
              <Link href="/student-affair/events" style={{ fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, padding: '6px 14px', borderRadius: 'var(--radius-sm)', textDecoration: 'none', display: 'inline-block' }}>
                Calendar <span style={{ fontSize: 10 }}>→</span>
              </Link>
            </div>
            <div>
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 13 }}>No upcoming events</div>
            </div>
          </div>
          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={16} /> Messages
              </div>
              <Link href="/student-affair/messages" style={{ fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, padding: '6px 14px', borderRadius: 'var(--radius-sm)', textDecoration: 'none', display: 'inline-block' }}>
                Open Chat <span style={{ fontSize: 10 }}>→</span>
              </Link>
            </div>
            <div>
              {!conversations && convLoading && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 13 }}>Loading...</div>
              )}
              {conversations && conversations.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 13 }}>No messages yet</div>
              )}
              {conversations?.slice(0, 3).map((conv) => (
                <MessageItem key={conv.id} initials={conv.other.initials} color="from-primary to-secondary" name={conv.other.name} preview={conv.preview} time={timeLabel(conv.lastMessageAt)} />
              ))}
            </div>
          </div>
          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={16} /> Quick Access
              </div>
            </div>
            <div style={{ padding: '8px 18px 16px' }}>
              <QuickAccess />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export { default as InboxSection } from '@/components/shared/InboxSection';

export function StudentsSection() {
  const { data, loading, error } = useUniversityData<StudentRecord[]>(
    useCallback(() => apiFetch<StudentRecord[]>('/api/students'), [])
  );
  const rows: StudentData[] = (data ?? []).map((s) => ({
    name: s.studentName,
    initials: initialsOf(s.studentName),
    color: 'from-info to-info/70',
    rollNo: s.rollNo,
    major: s.majorCode,
    majorColor: 'badge-primary',
    email: s.email,
    semester: ordinalSuffix(s.semesterNo),
  }));

  return (
    <div>
      {loading && !data && (
        <div style={{ fontSize: 12, color: 'var(--text-lighter)', marginBottom: 12 }}>Loading...</div>
      )}
      {error && !data && (
        <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>University server unreachable — retrying…</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Students</h1>
          <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 0 }}>2,847 total • 12 majors</p>
        </div>
        <button style={{
          background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff',
          borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, fontWeight: 600,
          border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(2, 132, 199,0.3)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(2, 132, 199,0.4)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(2, 132, 199,0.3)' }}
        >
          <Plus size={14} /> Add Student
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-[18px]">
        <StatCard icon={<BookOpen size={20} />} iconBgClass="bg-primary/10 text-primary" value="1,024" label="Computer Science" extra="36% of total" />
        <StatCard icon={<Users size={20} />} iconBgClass="bg-secondary/10 text-secondary" value="987" label="Computer Technology" extra="35% of total" />
        <StatCard icon={<GraduationCap size={20} />} iconBgClass="bg-success/10 text-success" value="836" label="CS & Technology" extra="29% of total" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--divider)',
          padding: '9px 16px', borderRadius: 'var(--radius-md)',
          border: '1.5px solid var(--secondary)', minWidth: 300,
        }}>
          <Search size={14} style={{ color: 'var(--text-lighter)' }} />
          <input type="text" placeholder="Search by name, roll no, or major..."
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, width: '100%', color: 'var(--text)', fontWeight: 500 }} />
        </div>
        <select style={{ padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--surface)', fontSize: 14, color: 'var(--text)', fontWeight: 500, minWidth: 140 }}>
          <option>All Semesters</option>
          <option>1st</option>
          <option>2nd</option>
          <option>3rd</option>
          <option>4th</option>
        </select>
        <select style={{ padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--surface)', fontSize: 14, color: 'var(--text)', fontWeight: 500, minWidth: 140 }}>
          <option>All Years</option>
          <option>Year 1</option>
          <option>Year 2</option>
          <option>Year 3</option>
          <option>Year 4</option>
        </select>
        <select style={{ padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--surface)', fontSize: 14, color: 'var(--text)', fontWeight: 500, minWidth: 140 }}>
          <option>All Majors</option>
          <option>CS</option>
          <option>SE</option>
          <option>IT</option>
        </select>
      </div>
      <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {rows.length > 0 ? (
          <DataTable
            columns={[
              { key: 'name', label: 'Student', render: (_: any, row: StudentData) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className={`w-[34px] h-[34px] rounded-full bg-gradient-to-br ${row.color} flex items-center justify-center text-white font-bold text-xs`}>{row.initials}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{row.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-light)' }}>{row.email}</div>
                  </div>
                </div>
              )},
              { key: 'rollNo', label: 'Roll No', render: (v: string) => <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: 'var(--text)' }}>{v}</span> },
              { key: 'major', label: 'Major', render: (v: string) => (
                <span style={{
                  display: 'inlineFlex', alignItems: 'center', gap: 4, fontSize: 11,
                  padding: '3px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                  background: v === 'CS' ? 'rgba(30,64,175,0.15)' : v === 'SE' ? 'rgba(107,33,168,0.15)' : 'rgba(0,105,92,0.15)',
                  color: v === 'CS' ? '#1e40af' : v === 'SE' ? '#6b21a8' : '#00695c',
                }}>{v}</span>
              )},
              { key: 'semester', label: 'Semester' },
              { key: 'actions', label: '', render: () => (
                <button style={{
                  padding: '6px 14px', fontSize: 12, color: 'var(--primary)', cursor: 'pointer',
                  fontWeight: 600, borderRadius: 'var(--radius-sm)', border: 'none', background: 'none',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(14, 165, 233,0.15)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <Eye size={14} />
                </button>
              )},
            ]}
            data={rows}
          />
        ) : (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>No students yet</div>
        )}
      </div>
    </div>
  );
}

export function EventsSection() {
  const [eventFilter, setEventFilter] = useState('All Events');
  const filters = ['All Events', 'Sports', 'Academic', 'Cultural', 'My Registrations'];

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Events</h1>
      <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>University events, sports, and activities</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {filters.map((f) => (
          <button key={f} onClick={() => setEventFilter(f)}
            style={{
              background: f === eventFilter ? 'linear-gradient(var(--primary), var(--primary-dark))' : 'var(--secondary-light)',
              color: f === eventFilter ? '#fff' : 'var(--primary)',
              border: f === eventFilter ? 'none' : '1.5px solid var(--secondary)',
              borderRadius: 'var(--radius-sm)', padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              boxShadow: f === eventFilter ? '0 4px 14px rgba(2, 132, 199,0.3)' : 'none',
            }}
            onMouseEnter={(e) => { if (f !== eventFilter) { e.currentTarget.style.background = 'var(--secondary)' } }}
            onMouseLeave={(e) => { if (f !== eventFilter) { e.currentTarget.style.background = 'var(--secondary-light)' } }}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-base-100 backdrop-blur-xl lg:col-span-2" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ padding: 56, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>No events yet</div>
        </div>
      </div>
    </div>
  );
}

export function LostFoundSection() {
  return <LostFoundPage />;
}

export function TimetableSection() {
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
      {((terms.loading && !terms.data) || (schedules.loading && !schedules.data)) && (
        <div style={{ fontSize: 12, color: 'var(--text-lighter)', marginBottom: 12 }}>Loading...</div>
      )}
      {((terms.error && !terms.data) || (schedules.error && !schedules.data)) && (
        <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>University server unreachable — retrying…</div>
      )}
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Timetable</h1>
      <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>Your weekly class schedule</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <select style={{ padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--surface)', fontSize: 14, color: 'var(--text)', fontWeight: 500, minWidth: 180 }}>
          <option>Semester 2 - 2026</option>
          <option>Semester 1 - 2026</option>
        </select>
        <select style={{ padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--surface)', fontSize: 14, color: 'var(--text)', fontWeight: 500, minWidth: 140 }}>
          <option>All Courses</option>
          <option>CS-401</option>
          <option>CS-402</option>
          <option>CS-403</option>
        </select>
        <button style={{
          background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff',
          borderRadius: 'var(--radius-sm)', padding: '6px 14px', fontSize: 12, fontWeight: 600,
          border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(2, 132, 199,0.3)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(2, 132, 199,0.4)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(2, 132, 199,0.3)' }}
        >
          <Download size={14} /> Export
        </button>
      </div>
      {ttRows.length === 0 ? (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ padding: 56, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>No schedules published yet</div>
        </div>
      ) : (
      <div style={{
        display: 'grid', gridTemplateColumns: '80px repeat(5, 1fr)', gap: 1,
        background: 'var(--secondary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        border: '1px solid var(--secondary)',
      }}>
        {['Time', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((h, i) => (
          <div key={h} style={{
            background: i === 0 ? 'linear-gradient(135deg, var(--primary), var(--primary-dark))' : 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
            color: '#fff', fontWeight: 700, fontSize: i === 0 ? 11 : 12,
            padding: '12px 8px', textAlign: 'center',
          }}>{h}</div>
        ))}
        {ttRows.map((row, i) => (
          <React.Fragment key={i}>
            <div style={{
              background: 'var(--secondary-lighter)', fontWeight: 700,
              color: 'var(--accent)', fontSize: 11, padding: '12px 8px',
              textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{row.time}</div>
            {['mon', 'tue', 'wed', 'thu', 'fri'].map((day) => {
              const val = row[day as keyof typeof row];
              const isLunch = val.includes('Lunch');
              const isFree = val.includes('Free');
              const isClass = !isLunch && !isFree;
              return (
                <div key={`${day}-${i}`} style={{
                  background: isLunch ? 'var(--white)' : isClass ? 'linear-gradient(135deg, #e8f4fc, #d0e8f5)' : 'var(--white)',
                  padding: '12px 8px', fontSize: isLunch ? 11 : 11.5, textAlign: 'center',
                  minHeight: 70, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  borderRadius: isClass ? 6 : 0,
                  margin: isClass ? 2 : 0,
                  color: isLunch ? 'var(--text-lighter)' : isFree ? 'var(--text-lighter)' : 'inherit',
                  fontStyle: isLunch || isFree ? 'italic' : 'normal',
                }}>
                  {isClass ? (
                    <>
                      <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 11 }}>{val.split('\n')[0]}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 2 }}>{val.split('\n')[1]}</div>
                    </>
                  ) : (
                    <span style={{ fontSize: 11 }}>{val.replace(/— /g, '')}</span>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      )}
    </div>
  );
}

interface RollCallRow extends RollCallData {
  studentId: string;
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

  const persist = useCallback(async (next: RollCallRow[], prev: RollCallRow[]) => {
    if (!firstSession) return;
    try {
      await markAttendance(firstSession.sessionId, next.map((r) => ({
        studentId: r.studentId,
        attendanceStatus: r.present ? 'PRESENT' as const : 'ABSENT' as const,
      })));
    } catch {
      setRollData(prev);
      toast.error('Failed to save attendance');
    }
  }, [firstSession]);

  const togglePresent = (studentId: string, present: boolean) => {
    const prev = rollData;
    const next = prev.map(r => r.studentId === studentId ? { ...r, present } : r);
    setRollData(next);
    void persist(next, prev);
  };

  const markAllPresent = () => {
    const prev = rollData;
    const next = prev.map(r => ({ ...r, present: true }));
    setRollData(next);
    void persist(next, prev);
  };

  const saveAll = () => {
    void persist(rollData, rollData);
  };

  return (
    <div>
      {((sessions.loading && !sessions.data) || (attendance.loading && !attendance.data)) && (
        <div style={{ fontSize: 12, color: 'var(--text-lighter)', marginBottom: 12 }}>Loading...</div>
      )}
      {((sessions.error && !sessions.data) || (attendance.error && !attendance.data)) && (
        <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>University server unreachable — retrying…</div>
      )}
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Roll Call</h1>
      <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>Upload Excel, live marking & attendance tracking</p>
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--surface)' }}>
        {['Dashboard', 'Live', 'My Attendance'].map((tab, i) => (
          <button key={tab} style={{
            padding: '12px 16px', fontSize: 13, fontWeight: 600,
            color: i === 1 ? 'var(--primary)' : 'var(--text-light)',
            cursor: 'pointer', borderBottom: '2.5px solid transparent',
            borderBottomColor: i === 1 ? 'var(--primary)' : 'transparent',
            background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
            marginBottom: -1,
          }}>{tab}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-[18px]">
        <div className="bg-base-100 backdrop-blur-xl" style={{
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)',
          padding: 20,
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={14} /> Filter Options
          </h3>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Subject</label>
            <select style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }}>
              <option>Data Structures</option>
              <option>Database Systems</option>
              <option>Web Development</option>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Date</label>
            <input type="date" defaultValue="2026-07-29"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Year</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['All', '1st', '2nd', '3rd', '4th'].map((y) => (
                <button key={y} style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', border: '1.5px solid var(--secondary)',
                  background: y === 'All' ? 'linear-gradient(135deg, var(--primary), var(--primary-dark))' : 'var(--white)',
                  color: y === 'All' ? '#fff' : 'var(--text-light)',
                  borderColor: y === 'All' ? 'var(--primary)' : 'var(--secondary)',
                  boxShadow: y === 'All' ? '0 2px 8px rgba(14, 165, 233,0.3)' : 'none',
                }}>{y}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
            <div style={{ textAlign: 'center', flex: 1, padding: 12, background: 'var(--secondary-lighter)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{rollData.length}</div>
              <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>Total</div>
            </div>
            <div style={{ textAlign: 'center', flex: 1, padding: 12, background: 'var(--secondary-lighter)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)' }}>{totalPresent}</div>
              <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>Present</div>
            </div>
            <div style={{ textAlign: 'center', flex: 1, padding: 12, background: 'var(--secondary-lighter)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--danger)' }}>{rollData.length - totalPresent}</div>
              <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>Absent</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-light)', marginBottom: 12 }}>
            {rollData.length > 0 ? Math.round(totalPresent / rollData.length * 100) : 0}% attendance
          </div>
          <button onClick={saveAll} style={{
            background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff',
            borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, fontWeight: 600,
            border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(2, 132, 199,0.3)',
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(2, 132, 199,0.4)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(2, 132, 199,0.3)' }}
          >
            <Save size={14} /> Save Attendance
          </button>
        </div>
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardCheck size={16} /> Mark Attendance — {firstSession ? `${firstSession.courseCode} \u2022 ${firstSession.sectionName}` : 'No active session'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-lighter)', fontWeight: 600 }}>{firstSession ? firstSession.sessionDate : '\u2014'} • {rollData.length} students</div>
          </div>
          {rollData.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>No attendance records yet</div>
          ) : (
          <DataTable
            columns={[
              { key: 'rollNo', label: 'Roll No', render: (v: string) => <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>{v}</span> },
              { key: 'name', label: 'Student', render: (_: any, row: RollCallRow) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className={`w-[34px] h-[34px] rounded-full bg-gradient-to-br ${row.color} flex items-center justify-center text-white font-bold text-xs`}>{row.initials}</div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{row.name}</span>
                </div>
              )},
              { key: 'year', label: 'Year' },
              { key: 'present', label: 'Status', render: (_: any, row: RollCallRow) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => togglePresent(row.studentId, true)}
                    style={{
                      display: 'inlineFlex', alignItems: 'center', gap: 6,
                      padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                      background: row.present ? '#dcfce7' : 'var(--secondary-lighter)',
                      color: row.present ? '#166534' : 'var(--text-light)',
                    }}>
                    <Check size={12} /> Present
                  </button>
                  <button onClick={() => togglePresent(row.studentId, false)}
                    style={{
                      display: 'inlineFlex', alignItems: 'center', gap: 6,
                      padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                      background: !row.present ? '#fee2e2' : 'var(--secondary-lighter)',
                      color: !row.present ? '#991b1b' : 'var(--text-light)',
                    }}>
                    <X size={12} /> Absent
                  </button>
                </div>
              )},
            ]}
            data={rollData}
          />
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderTop: '1px solid var(--surface)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-light)', fontWeight: 500 }}>
              {totalPresent} of {rollData.length} present
            </span>
            <button onClick={markAllPresent}
              style={{
                background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff',
                borderRadius: 'var(--radius-sm)', padding: '6px 14px', fontSize: 13, fontWeight: 600,
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 4px 14px rgba(2, 132, 199,0.3)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(2, 132, 199,0.4)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(2, 132, 199,0.3)' }}
            >
              <Check size={14} /> Mark All Present
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


export function SettingsSection() {
  const [settingsTab, setSettingsTab] = useState('Profile');
  const [notifPrefs, setNotifPrefs] = useState({ push: true, emailDigest: false, messageAlerts: true, eventReminders: true });

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
      <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {['Profile', 'Notifications', 'Appearance', 'Blocked'].map((tab) => (
              <button key={tab} onClick={() => setSettingsTab(tab)} style={{
                padding: '12px 16px', fontSize: 13, fontWeight: 600,
                color: settingsTab === tab ? 'var(--primary)' : 'var(--text-light)',
                cursor: 'pointer', borderBottom: '2.5px solid transparent',
                borderBottomColor: settingsTab === tab ? 'var(--primary)' : 'transparent',
                background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              }}>{tab}</button>
            ))}
          </div>
        </div>
        {settingsTab === 'Profile' ? (
          <div style={{ padding: '24px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--surface)' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, var(--secondary-light), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20, color: 'var(--primary)' }}>SA</div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>Student Affairs Office</h3>
                <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>Student Affairs • University Portal</p>
              </div>
              <button style={{ background: 'var(--secondary-light)', color: 'var(--primary)', border: '1.5px solid var(--secondary)', borderRadius: 'var(--radius-sm)', padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}><Upload size={13} /> Change Photo</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: 24 }}>
              <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Full Name</label><input type="text" defaultValue="Student Affairs Office" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} /></div>
              <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Email Address</label><input type="email" defaultValue="student.affairs@uni.edu" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} /></div>
              <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Department</label><input type="text" defaultValue="Student Affairs" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} /></div>
              <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Phone Number</label><input type="text" defaultValue="+95 9 123 456 789" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} /></div>
            </div>
            <div style={{ paddingTop: 16, borderTop: '1px solid var(--surface)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button style={{ background: 'var(--secondary-light)', color: 'var(--primary)', border: '1.5px solid var(--secondary)', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(2, 132, 199,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(2, 132, 199,0.4)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(2, 132, 199,0.3)' }}><Save size={14} /> Save Changes</button>
            </div>
          </div>
        ) : settingsTab === 'Appearance' ? (
          <ThemeSwitcher bare />
        ) : settingsTab === 'Notifications' ? (
          <div style={{ padding: '24px 22px' }}>
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
        ) : (
          <div style={{ padding: '24px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}><Ban size={16} /> Blocked Users</h3>
            </div>
            <BlockedSection bare />
          </div>
        )}
      </div>
    </div>
  );
}
