'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch, markAttendance } from '@/components/shared/api';
import type {
  StudentRecord, StaffRecord, AttendanceRecord,
  ClassSessionRecord, ScheduleRecord, AcademicTermRecord,
  UserRecord,
} from '@/components/shared/api';
import { useUniversityData } from '@/components/shared/useUniversityData';
import WelcomeBar from '@/components/shared/WelcomeBar';
import StatCard from '@/components/shared/StatCard';
import FeedPost from '@/components/shared/FeedPost';
import MessageItem from '@/components/shared/MessageItem';
import QuickAccess from '@/components/shared/QuickAccess';
import DataTable from '@/components/shared/DataTable';
import ThemeSwitcher from '@/components/shared/ThemeSwitcher';
import { toast } from 'sonner';
import { useSupabase } from '@/utils/supabase/client';
import { useFeedPosts, useConversations, useEvents, useEventRegistrations } from '@/lib/supabase/hooks';
import { useSession } from '@/components/shared/session';
import {
  Users, GraduationCap,
  ClipboardCheck, CalendarDays, CalendarCheck,
  Coins, Search, MessageSquare, Newspaper,
  Upload, Filter, Plus, Download,
  Check, X, Eye, BookOpen, Bell, MessageCircle, User, Ban,
} from 'lucide-react';
import type {
  StudentData, LecturerData,
  StaffData, RollCallData,
} from '@/components/shared/types';
export { default as FeedSection } from '@/components/shared/FeedSection';
export { default as MessagesSection } from '@/components/shared/MessagesSection';
export { default as LostFoundSection } from '@/components/shared/LostFoundSection';
import BlockedSection from '@/components/shared/BlockedSection';

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => (w[0] || '').toUpperCase()).join('');

const semesterLabel = (n: number) =>
  `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

const timeLabel = (ts: number) => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ts).toLocaleDateString();
};

export function Dashboard() {
  const [feedTab, setFeedTab] = useState('Latest');
  const feedTabs = ['Latest', 'Lost & Found'];
  const { user: session } = useSession();
  const me = session?.email ?? '';
  const { posts, loading: postsLoading } = useFeedPosts(useSupabase());
  const { conversations, loading: convLoading } = useConversations(useSupabase(), me);
  const { events, loading: eventsLoading } = useEvents(useSupabase());
  const eventIds = useMemo(() => (events ?? []).map((e) => e.id), [events]);
  const { registrations } = useEventRegistrations(useSupabase(), eventIds, me);
  const upcomingEvents = useMemo(
    () => (events ?? []).filter((e) => e.event_date >= Date.now()).slice(0, 3),
    [events]
  );
  const { data: users, loading: usersLoading } = useUniversityData<UserRecord[]>(
    useCallback(() => apiFetch<UserRecord[]>('/api/users'), [])
  );
  const counts = useMemo(() => {
    const list = users ?? [];
    return {
      students: list.filter((u) => u.roleName === 'STUDENT').length,
      staff: list.filter((u) => u.roleName === 'STAFF').length,
      admins: list.filter((u) => u.roleName === 'SYSTEM_ADMIN').length,
      total: list.length,
    };
  }, [users]);

  const feedPosts = useMemo(() => {
    const list = posts ?? [];
    if (feedTab !== 'Lost & Found') return list;
    return list.filter((p) =>
      Array.isArray(p.tags) &&
      (p.tags as { label?: string }[]).some((t) =>
        (t.label ?? '').replace(/^#/, '').toLowerCase() === 'lost & found'
      )
    );
  }, [posts, feedTab]);

  return (
    <div>
      <WelcomeBar name="Admin Team" subtitle="University management dashboard overview" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard icon={<Users size={20} />} iconBgClass="bg-primary/10 text-primary" value={usersLoading ? '—' : counts.students} label="Total Students" trend={usersLoading ? 'Loading...' : 'Active accounts'} />
        <StatCard icon={<GraduationCap size={20} />} iconBgClass="bg-info/10 text-info" value={usersLoading ? '—' : counts.staff} label="Lecturers & Staff" trend={usersLoading ? 'Loading...' : 'Active accounts'} />
        <StatCard icon={<BookOpen size={20} />} iconBgClass="bg-warning/10 text-warning" value={usersLoading ? '—' : counts.admins} label="System Admins" trend={usersLoading ? 'Loading...' : 'Active accounts'} />
        <StatCard icon={<Coins size={20} />} iconBgClass="bg-success/10 text-success" value={usersLoading ? '—' : counts.total} label="Total Users" trend={usersLoading ? 'Loading...' : 'All active'} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-[18px]">
        <div>
          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Newspaper size={16} /> University News Feed
              </div>
              <Link href="/admin/feed" style={{ fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, textDecoration: 'none' }}>View All →</Link>
            </div>
            <div style={{ display: 'flex', gap: 4, padding: '0 22px', borderBottom: '1px solid var(--surface)' }}>
              {feedTabs.map((t) => (
                <button key={t} onClick={() => setFeedTab(t)} style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: feedTab === t ? 'var(--primary)' : 'var(--text-light)', cursor: 'pointer', borderBottom: feedTab === t ? '2.5px solid var(--primary)' : '2.5px solid transparent', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{ padding: '6px 0' }}>
              {!postsLoading ? (
                feedPosts && feedPosts.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>{feedTab === 'Lost & Found' ? 'No lost & found posts yet' : 'No posts yet'}</div>
                ) : (
                  feedPosts.slice(0, 2).map((post) => (
                    <FeedPost key={post.id} post={post} />
                  ))
                )
              ) : (
                <div style={{ padding: 22, fontSize: 13, color: 'var(--text-light)' }}>Loading...</div>
              )}
            </div>
          </div>
        </div>
        <div>
          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarDays size={16} /> Upcoming Events
              </div>
              <Link href="/admin/events" style={{ fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, textDecoration: 'none' }}>Calendar →</Link>
            </div>
            {!eventsLoading && upcomingEvents.length === 0 ? (
              <div style={{ padding: '30px 22px', textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>
                No upcoming events
              </div>
            ) : (
              <div style={{ padding: '6px 0' }}>
                {upcomingEvents.map((e) => (
                  <Link
                    key={e.id}
                    href="/admin/events"
                    className="hover:bg-(--surface-soft)"
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 22px', textDecoration: 'none', borderBottom: '1px solid var(--surface)', transition: 'background 0.15s' }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(14,165,233,0.12)', color: 'var(--primary)' }}>
                      <CalendarCheck size={17} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-lighter)', marginTop: 2 }}>
                        {new Date(e.event_date).toLocaleDateString()}
                        {e.location ? ` • ${e.location}` : ''}
                        {registrations?.[e.id] ? ` • ${registrations[e.id].count} registered` : ''}
                      </div>
                    </div>
                    <span className="badge badge-sm shrink-0" style={{ background: 'rgba(14,165,233,0.12)', color: 'var(--primary)', border: 'none' }}>{e.category}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={16} /> Messages
              </div>
              <Link href="/admin/messages" style={{ fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, textDecoration: 'none' }}>Open Chat →</Link>
            </div>
              {!convLoading ? (
                conversations && conversations.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>No messages yet</div>
                ) : (
                  (conversations ?? []).slice(0, 3).map((conv) => (
                    <MessageItem key={conv.id} initials={conv.other.initials} color="from-primary to-secondary" name={conv.other.name} preview={conv.preview} time={timeLabel(conv.lastMessageAt)} />
                  ))
                )
              ) : (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>Loading...</div>
              )}
          </div>
          <QuickAccess />
        </div>
      </div>
    </div>
  );
}


const ROLE_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  SYSTEM_ADMIN: { label: 'Admin', bg: 'rgba(217,70,239,0.14)', color: '#c026d3' },
  STAFF: { label: 'Lecturer / Staff', bg: 'rgba(2,132,199,0.12)', color: '#0284c7' },
  STUDENT: { label: 'Student', bg: 'rgba(52,211,153,0.15)', color: '#16a34a' },
};

const PEOPLE_PAGE_SIZE = 10;

function pageNumbers(total: number, current: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = Array.from(set).filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) out.push('…');
    out.push(n);
    prev = n;
  }
  return out;
}

export function ExploreSection() {
  const { user: session } = useSession();
  const me = session?.email ?? '';
  const role = session?.role ?? '';
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'People', 'Events'];
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const { data: users, loading: usersLoading } = useUniversityData<UserRecord[]>(
    useCallback(() => apiFetch<UserRecord[]>('/api/users'), [])
  );
  const supabase = useSupabase();
  const { events, loading: eventsLoading } = useEvents(supabase);
  const eventIds = useMemo(() => (events ?? []).map((e) => e.id), [events]);
  const { registrations } = useEventRegistrations(supabase, eventIds, me);

  useEffect(() => { setPage(1); }, [query, filter]);

  const people = useMemo(() => {
    const list = users ?? [];
    const q = query.trim().toLowerCase();
    return q
      ? list.filter((u) => u.email.toLowerCase().includes(q) || (u.roleName ?? '').toLowerCase().includes(q))
      : list;
  }, [users, query]);

  const totalPeople = people.length;
  const totalPeoplePages = Math.max(1, Math.ceil(totalPeople / PEOPLE_PAGE_SIZE));
  const safePage = Math.min(page, totalPeoplePages);
  const pagePeople = people.slice((safePage - 1) * PEOPLE_PAGE_SIZE, safePage * PEOPLE_PAGE_SIZE);
  const peopleStart = totalPeople === 0 ? 0 : (safePage - 1) * PEOPLE_PAGE_SIZE + 1;
  const peopleEnd = Math.min(safePage * PEOPLE_PAGE_SIZE, totalPeople);

  const shownEvents = useMemo(() => {
    const list = (events ?? []).filter((e) => e.event_date >= Date.now() - 24 * 60 * 60 * 1000);
    const q = query.trim().toLowerCase();
    return q
      ? list.filter((e) => e.title.toLowerCase().includes(q) || (e.location ?? '').toLowerCase().includes(q) || e.category.toLowerCase().includes(q))
      : list;
  }, [events, query]);

  const showPeople = filter === 'All' || filter === 'People';
  const showEvents = filter === 'All' || filter === 'Events';

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Explore</h1>
      <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>Discover people and events across the university</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--divider)', padding: '9px 16px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--secondary)', flex: 1, maxWidth: 400 }}>
          <Search size={14} style={{ color: 'var(--text-lighter)' }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people or events..."
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, width: '100%', color: 'var(--text)', fontWeight: 500 }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? 'linear-gradient(var(--primary), var(--primary-dark))' : 'var(--secondary-light)', color: filter === f ? '#fff' : 'var(--primary)', borderRadius: 'var(--radius-sm)', padding: '6px 14px', fontSize: 13, fontWeight: 600, border: filter === f ? 'none' : '1.5px solid var(--secondary)', cursor: 'pointer' }}>
            {f}
          </button>
        ))}
      </div>

      {showPeople && (
        <div className="bg-base-100 backdrop-blur-xl mb-5" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} /> People
            </div>
            {!usersLoading && <span style={{ fontSize: 12, color: 'var(--text-lighter)' }}>{totalPeople} result{totalPeople === 1 ? '' : 's'}</span>}
          </div>
          {usersLoading ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>Loading people...</div>
          ) : people.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>No people found</div>
          ) : (
            <div style={{ padding: '6px 0' }}>
              {pagePeople.map((u) => {
                const meta = ROLE_LABEL[u.roleName] ?? ROLE_LABEL.STUDENT;
                return (
                  <div key={u.userId} className="hover:bg-(--surface-soft)" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', borderBottom: '1px solid var(--surface)', transition: 'background 0.15s' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                      {u.email.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent)' }}>{u.email}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-lighter)', marginTop: 2 }}>
                        {u.isActive ? 'Active' : 'Inactive'}
                        {u.registrationStatus ? ` • ${u.registrationStatus}` : ''}
                      </div>
                    </div>
                    <span className="badge badge-sm shrink-0" style={{ background: meta.bg, color: meta.color, border: 'none' }}>{meta.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          {totalPeople > PEOPLE_PAGE_SIZE && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 22px', borderTop: '1px solid var(--surface)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-lighter)' }}>Showing {peopleStart}–{peopleEnd} of {totalPeople}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  style={{ background: 'none', border: '1.5px solid var(--secondary)', borderRadius: 'var(--radius-sm)', padding: '5px 12px', fontSize: 12, fontWeight: 600, color: 'var(--primary)', cursor: safePage <= 1 ? 'not-allowed' : 'pointer', opacity: safePage <= 1 ? 0.4 : 1 }}
                >
                  Prev
                </button>
                {pageNumbers(totalPeoplePages, safePage).map((n, i) =>
                  typeof n === 'number' ? (
                    <button
                      key={i}
                      onClick={() => setPage(n)}
                      style={{ minWidth: 30, background: n === safePage ? 'linear-gradient(var(--primary), var(--primary-dark))' : 'none', color: n === safePage ? '#fff' : 'var(--primary)', border: n === safePage ? 'none' : '1.5px solid var(--secondary)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      {n}
                    </button>
                  ) : (
                    <span key={i} style={{ fontSize: 12, color: 'var(--text-lighter)', padding: '0 2px' }}>{n}</span>
                  )
                )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPeoplePages, p + 1))}
                  disabled={safePage >= totalPeoplePages}
                  style={{ background: 'none', border: '1.5px solid var(--secondary)', borderRadius: 'var(--radius-sm)', padding: '5px 12px', fontSize: 12, fontWeight: 600, color: 'var(--primary)', cursor: safePage >= totalPeoplePages ? 'not-allowed' : 'pointer', opacity: safePage >= totalPeoplePages ? 0.4 : 1 }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showEvents && (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={16} /> Events
            </div>
            <Link href={`/${role}/events`} style={{ fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, textDecoration: 'none' }}>View All →</Link>
          </div>
          {eventsLoading ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>Loading events...</div>
          ) : shownEvents.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>No events yet</div>
          ) : (
            <div style={{ padding: '6px 0' }}>
              {shownEvents.map((e) => (
                <Link
                key={e.id}
              href={`/${role}/events`}
              className="hover:bg-(--surface-soft)"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 22px', textDecoration: 'none', borderBottom: '1px solid var(--surface)', transition: 'background 0.15s' }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(14,165,233,0.12)', color: 'var(--primary)' }}>
                    <CalendarCheck size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-lighter)', marginTop: 2 }}>
                      {new Date(e.event_date).toLocaleDateString()}
                      {e.location ? ` • ${e.location}` : ''}
                      {registrations?.[e.id] ? ` • ${registrations[e.id].count} registered` : ''}
                    </div>
                  </div>
                  <span className="badge badge-sm shrink-0" style={{ background: 'rgba(14,165,233,0.12)', color: 'var(--primary)', border: 'none' }}>{e.category}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export function StudentsSection() {
  const { data, loading, error } = useUniversityData<StudentData[]>(
    useCallback(() => apiFetch<StudentRecord[]>('/api/students').then((records) =>
      records.map((s) => ({
        name: s.studentName,
        initials: initialsOf(s.studentName),
        color: 'from-info to-info/70',
        rollNo: s.rollNo,
        major: s.majorCode,
        majorColor: 'badge-primary',
        email: s.email,
        semester: semesterLabel(s.semesterNo),
      }))
    ), []),
  );
  const students = useMemo(() => data ?? [], [data]);

  const majorStats = useMemo(() => {
    const counts = new Map<string, number>();
    students.forEach((s) => counts.set(s.major, (counts.get(s.major) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [students]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Students</h1>
          <p style={{ fontSize: 14, color: 'var(--text-light)' }}>View and manage all enrolled students</p>
        </div>
        <button style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Add Student
        </button>
      </div>
      {students.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ marginBottom: 18 }}>
          {majorStats.map(([major, count], i) => (
            <div key={i} className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--surface-strong)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, #e8f4fc, #d0e8f5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                  <Users size={20} />
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.5px' }}>{count}</div>
              <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 3, fontWeight: 500 }}>{major}</div>
              <div style={{ fontSize: 11, color: 'var(--text-lighter)', marginTop: 4 }}>{Math.round((count / students.length) * 100)}% of total</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--divider)', padding: '9px 16px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--secondary)', flex: 1, maxWidth: 400 }}>
          <Search size={14} style={{ color: 'var(--text-lighter)' }} />
          <input type="text" placeholder="Search by name, roll no, or major..." style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, width: '100%', color: 'var(--text)', fontWeight: 500 }} />
        </div>
        <select style={{ padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--surface)', fontSize: 14, color: 'var(--text)', fontWeight: 500, minWidth: 140 }}><option>All Semesters</option></select>
        <select style={{ padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--surface)', fontSize: 14, color: 'var(--text)', fontWeight: 500, minWidth: 140 }}><option>All Years</option></select>
        <select style={{ padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--surface)', fontSize: 14, color: 'var(--text)', fontWeight: 500, minWidth: 140 }}><option>All Majors</option></select>
        <select style={{ padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--surface)', fontSize: 14, color: 'var(--text)', fontWeight: 500, minWidth: 140 }}><option>CS</option><option>SE</option><option>IT</option></select>
      </div>
      {loading && !data && <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12 }}>Loading...</div>}
      {error && !data && <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>University server unreachable — retrying…</div>}
      {!loading && !error && students.length === 0 && (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', padding: 40, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>
          No students yet
        </div>
      )}
      {students.length > 0 && (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px' }}>
            <DataTable
              columns={[
                { key: 'name', label: 'Student', render: (_, row: StudentData) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, var(--primary), var(--primary-dark))`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12 }}>{row.initials}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{row.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-light)' }}>{row.email}</div>
                    </div>
                  </div>
                )},
                { key: 'rollNo', label: 'Roll No' },
                { key: 'major', label: 'Major', render: (v: string) => (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', background: v === 'CS' ? 'rgba(30,64,175,0.15)' : v === 'SE' ? 'rgba(107,33,168,0.15)' : 'rgba(30,64,175,0.15)', color: v === 'CS' ? '#1e40af' : v === 'SE' ? '#6b21a8' : '#1e40af' }}>{v}</span>
                )},
                { key: 'semester', label: 'Semester' },
                { key: 'actions', label: '', render: () => (
                  <button style={{ background: 'transparent', color: 'var(--text-light)', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Eye size={14} /></button>
                )},
              ]}
              data={students}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function LecturersSection() {
  const { data, loading, error } = useUniversityData<LecturerData[]>(
    useCallback(() => apiFetch<StaffRecord[]>('/api/staff').then((records) =>
      records.map((s) => ({
        name: s.staffName,
        initials: initialsOf(s.staffName),
        color: 'from-primary to-primary-dark/80',
        department: s.unitName,
        courses: 0,
      }))
    ), []),
  );
  const lecturers = useMemo(() => data ?? [], [data]);

  const deptStats = useMemo(() => {
    const counts = new Map<string, number>();
    lecturers.forEach((l) => counts.set(l.department, (counts.get(l.department) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [lecturers]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Lecturers</h1>
          <p style={{ fontSize: 14, color: 'var(--text-light)' }}>Manage faculty and academic staff</p>
        </div>
        <button style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Add Lecturer
        </button>
      </div>
      {lecturers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-[14px]" style={{ marginBottom: 18 }}>
          {deptStats.map(([dept, count], i) => (
            <div key={i} className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--surface-strong)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.5px' }}>{count}</div>
              <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 3, fontWeight: 500 }}>{dept}</div>
              <div style={{ fontSize: 11, color: 'var(--text-lighter)', marginTop: 4 }}>{Math.round((count / lecturers.length) * 100)}% of total</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <select style={{ padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--surface)', fontSize: 14, color: 'var(--text)', fontWeight: 500, minWidth: 140, maxWidth: 300, width: '100%' }}><option>All Departments</option></select>
      </div>
      {loading && !data && <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12 }}>Loading...</div>}
      {error && !data && <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>University server unreachable — retrying…</div>}
      {!loading && !error && lecturers.length === 0 && (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', padding: 40, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>
          No lecturers yet
        </div>
      )}
      {lecturers.length > 0 && (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px' }}>
            <DataTable
              columns={[
                { key: 'name', label: 'Name', render: (_, row: LecturerData) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, var(--primary), var(--primary-dark))`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12 }}>{row.initials}</div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{row.name}</span>
                  </div>
                )},
                { key: 'department', label: 'Department' },
                { key: 'courses', label: 'Courses', render: (v: number) => (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', background: 'rgba(30,64,175,0.15)', color: '#1e40af' }}>{v} courses</span>
                )},
                { key: 'actions', label: 'Actions', render: () => (
                  <button style={{ background: 'transparent', color: 'var(--text-light)', border: 'none', cursor: 'pointer', padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--radius-sm)' }}>View</button>
                )},
              ]}
              data={lecturers}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function StaffSection() {
  const [staffTab, setStaffTab] = useState('Staff Overview');
  const staffTabs = ['Staff Overview', 'Departments'];

  const { data, loading, error } = useUniversityData<StaffData[]>(
    useCallback(() => apiFetch<StaffRecord[]>('/api/staff').then((records) =>
      records.map((s) => ({
        name: s.staffName,
        initials: initialsOf(s.staffName),
        color: 'from-info to-info/70',
        staffId: s.staffNo,
        department: s.unitName,
        role: '',
        roleColor: 'badge-primary',
        phone: s.phoneNo ?? '',
        email: '',
      }))
    ), []),
  );
  const staff = useMemo(() => data ?? [], [data]);

  const deptCount = useMemo(() => new Set(staff.map((s) => s.department)).size, [staff]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Staff</h1>
          <p style={{ fontSize: 14, color: 'var(--text-light)' }}>University administrative and support staff</p>
        </div>
        <button style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Add Staff
        </button>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--surface)' }}>
        {staffTabs.map((t) => (
          <button key={t} onClick={() => setStaffTab(t)} style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: staffTab === t ? 'var(--primary)' : 'var(--text-light)', cursor: 'pointer', borderBottom: staffTab === t ? '2.5px solid var(--primary)' : '2.5px solid transparent', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
            {t}
          </button>
        ))}
      </div>
      {staff.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-[14px]" style={{ marginBottom: 18 }}>
          {[
            { value: staff.length, label: 'Total Staff' },
            { value: deptCount, label: 'Departments' },
            { value: staff.length, label: 'Staff IDs' },
          ].map((s, i) => (
            <div key={i} className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--surface-strong)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.5px' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--divider)', padding: '9px 16px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--secondary)', flex: 1, maxWidth: 300 }}>
          <Search size={14} style={{ color: 'var(--text-lighter)' }} />
          <input type="text" placeholder="Search staff..." style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, width: '100%', color: 'var(--text)', fontWeight: 500 }} />
        </div>
        <select style={{ padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--surface)', fontSize: 14, color: 'var(--text)', fontWeight: 500, minWidth: 140 }}><option>All Departments</option><option>Administration</option><option>Finance</option><option>IT Support</option><option>Library</option><option>HR</option></select>
      </div>
      {loading && !data && <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12 }}>Loading...</div>}
      {error && !data && <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>University server unreachable — retrying…</div>}
      {!loading && !error && staff.length === 0 && (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', padding: 40, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>
          No staff yet
        </div>
      )}
      {staff.length > 0 && (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px' }}>
            <DataTable
              columns={[
                { key: 'name', label: 'Staff', render: (_, row: StaffData) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, var(--primary), var(--primary-dark))`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12 }}>{row.initials}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{row.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-light)' }}>{row.email}</div>
                    </div>
                  </div>
                )},
                { key: 'staffId', label: 'Staff ID' },
                { key: 'department', label: 'Department' },
                { key: 'role', label: 'Role', render: (v: string, row: StaffData) => (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', background: row.role === 'Office Manager' || row.role === 'Receptionist' ? 'rgba(30,64,175,0.15)' : row.role === 'Accountant' ? 'rgba(34,197,94,0.15)' : row.role === 'Technician' ? 'rgba(0,105,92,0.15)' : row.role === 'Librarian' ? 'rgba(107,33,168,0.15)' : 'rgba(146,64,14,0.15)', color: row.role === 'Office Manager' || row.role === 'Receptionist' ? '#1e40af' : row.role === 'Accountant' ? '#166534' : row.role === 'Technician' ? '#00695c' : row.role === 'Librarian' ? '#6b21a8' : '#92400e' }}>{v}</span>
                )},
                { key: 'phone', label: 'Phone' },
                { key: 'actions', label: '', render: () => (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={{ background: 'transparent', color: 'var(--text-light)', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Eye size={14} /></button>
                    <button style={{ background: 'transparent', color: 'var(--text-light)', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MessageSquare size={14} /></button>
                  </div>
                )},
              ]}
              data={staff}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export { default as ExamResultsSection } from '@/components/shared/ExamResultDistributionSection';

export function RollCallSection() {
  const [rollTab, setRollTab] = useState('Live');
  const rollTabs = ['Dashboard', 'Live', 'My Attendance'];

  const sessions = useUniversityData<ClassSessionRecord[]>(
    useCallback(() => apiFetch<ClassSessionRecord[]>('/api/sessions'), [])
  );
  const firstSession = sessions.data && sessions.data.length > 0 ? sessions.data[0] : null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)' }}>Roll Call</h1>
        <button style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Download size={14} /> Export
        </button>
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>Upload Excel, live marking & attendance tracking</p>
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--surface)' }}>
        {rollTabs.map((t) => (
          <button key={t} onClick={() => setRollTab(t)} style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: rollTab === t ? 'var(--primary)' : 'var(--text-light)', cursor: 'pointer', borderBottom: rollTab === t ? '2.5px solid var(--primary)' : '2.5px solid transparent', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
            {t}
          </button>
        ))}
      </div>
      {sessions.loading && !sessions.data && <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12 }}>Loading...</div>}
      {sessions.error && !sessions.data && <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>University server unreachable — retrying…</div>}
      <RollCallBoard session={firstSession} />
    </div>
  );
}

interface RollCallRow extends RollCallData {
  studentId: string;
}

function RollCallBoard({ session }: { session: ClassSessionRecord | null }) {
  const [rollData, setRollData] = useState<RollCallRow[]>([]);
  const [yearPill, setYearPill] = useState('All');
  const yearPills = ['All', '1st', '2nd', '3rd', '4th'];
  const totalPresent = rollData.filter(r => r.present).length;

  const fetcher = useCallback(() => {
    if (!session) return Promise.resolve([] as RollCallRow[]);
    return apiFetch<AttendanceRecord[]>(`/api/attendance?sessionId=${session.sessionId}`).then((records) =>
      records.map((r) => ({
        studentId: r.studentId,
        rollNo: r.rollNo,
        name: r.studentName,
        initials: initialsOf(r.studentName),
        color: 'from-info to-info/70',
        year: '—',
        present: r.attendanceStatus === 'PRESENT',
      }))
    );
  }, [session]);

  const { data, loading, error } = useUniversityData<RollCallRow[]>(fetcher);

  useEffect(() => {
    if (!data) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync server rows into toggleable state
    setRollData(data);
  }, [data]);

  const persist = useCallback(async (next: RollCallRow[], prev: RollCallRow[]) => {
    if (!session) return;
    try {
      await markAttendance(session.sessionId, next.map((r) => ({
        studentId: r.studentId,
        attendanceStatus: r.present ? 'PRESENT' as const : 'ABSENT' as const,
      })));
    } catch {
      setRollData(prev);
      toast.error('Failed to save attendance');
    }
  }, [session]);

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
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-[18px]">
      <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={16} /> Filter Options
        </h3>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Subject</label>
          <select style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }}>{session ? <option>{session.courseCode} — {session.sectionName}</option> : <option>No active session</option>}</select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Date</label>
          <input type="date" defaultValue={session ? session.sessionDate : ''} style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Year</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {yearPills.map((p) => (
              <button key={p} onClick={() => setYearPill(p)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: yearPill === p ? '1.5px solid var(--primary)' : '1.5px solid var(--secondary)', background: yearPill === p ? 'linear-gradient(135deg, var(--primary), var(--primary-dark))' : 'var(--divider)', color: yearPill === p ? '#fff' : 'var(--text-light)' }}>
                {p}
              </button>
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
        <button onClick={saveAll} style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Check size={14} /> Save Attendance
        </button>
      </div>
      <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardCheck size={16} /> Mark Attendance — {session ? session.courseCode : 'No active session'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-lighter)', fontWeight: 600 }}>{session ? session.sessionDate : '—'} • {rollData.length} students</div>
        </div>
        {session && (
          <div style={{ padding: '12px 22px 0', fontSize: 12.5, color: 'var(--text-light)', fontWeight: 600 }}>
            {session.courseCode} • {session.sectionName} • {session.sessionDate}
          </div>
        )}
        {loading && !data && <div style={{ padding: '12px 22px 0', fontSize: 13, color: 'var(--text-light)' }}>Loading...</div>}
        {error && !data && (
          <div style={{ padding: '12px 22px 0' }}>
            <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>University server unreachable — retrying…</div>
          </div>
        )}
        {!loading && !error && rollData.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>No attendance records yet</div>
        )}
        {rollData.length > 0 && (
          <div style={{ padding: '16px 22px' }}>
            <DataTable
              columns={[
                { key: 'rollNo', label: 'Roll No' },
                { key: 'name', label: 'Student', render: (_, row: RollCallRow) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, var(--primary), var(--primary-dark))`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12 }}>{row.initials}</div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{row.name}</span>
                  </div>
                )},
                { key: 'year', label: 'Year' },
                { key: 'present', label: 'Status', render: (_, row: RollCallRow) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => togglePresent(row.studentId, true)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: row.present ? '#dcfce7' : 'transparent', color: row.present ? '#166534' : 'var(--text-lighter)' }}
                    >
                      <Check size={12} /> Present
                    </button>
                    <button
                      onClick={() => togglePresent(row.studentId, false)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: !row.present ? '#fee2e2' : 'transparent', color: !row.present ? '#991b1b' : 'var(--text-lighter)' }}
                    >
                      <X size={12} /> Absent
                    </button>
                  </div>
                )},
              ]}
              data={rollData}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--divider)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{totalPresent} of {rollData.length} present</span>
              <button onClick={markAllPresent} style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={14} /> Mark All Present
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface TimetableEntry {
  time: string;
  mon: string; tue: string; wed: string; thu: string; fri: string;
}

export function TimetableSection() {
  const terms = useUniversityData<AcademicTermRecord[]>(
    useCallback(() => apiFetch<AcademicTermRecord[]>('/api/terms'), [])
  );
  const activeTerm = useMemo(() => {
    const list = terms.data ?? [];
    return list.find((t) => t.status === 'ACTIVE') ?? list[0] ?? null;
  }, [terms.data]);

  const schedules = useUniversityData<ScheduleRecord[]>(
    useCallback(() => (activeTerm ? apiFetch<ScheduleRecord[]>(`/api/schedules?termId=${activeTerm.termId}`) : Promise.resolve([])), [activeTerm])
  );

  const timetable = useMemo(() => {
    const map: Record<number, Record<number, string>> = {};
    (schedules.data ?? []).forEach((s) => {
      if (s.dayOfWeek >= 1 && s.dayOfWeek <= 5) {
        (map[s.dayOfWeek] ??= {})[s.startPeriodNo] = s.courseCode;
      }
    });
    const maxPeriod = Math.max(0, ...(schedules.data ?? []).map((s) => s.startPeriodNo));
    const rows: TimetableEntry[] = [];
    for (let p = 1; p <= maxPeriod; p++) {
      rows.push({
        time: `Period ${p}`,
        mon: map[1]?.[p] ?? '',
        tue: map[2]?.[p] ?? '',
        wed: map[3]?.[p] ?? '',
        thu: map[4]?.[p] ?? '',
        fri: map[5]?.[p] ?? '',
      });
    }
    return rows;
  }, [schedules.data]);

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Timetable</h1>
      <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>Weekly class schedule</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <select style={{ padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--surface)', fontSize: 14, color: 'var(--text)', fontWeight: 500, minWidth: 140 }}><option>{activeTerm ? `AY ${activeTerm.academicYear} — ${activeTerm.status.toLowerCase()}` : 'No active term'}</option></select>
        <select style={{ padding: '9px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--surface)', fontSize: 14, color: 'var(--text)', fontWeight: 500, minWidth: 140 }}><option>All Courses</option></select>
        <button style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Download size={14} /> Export
        </button>
      </div>
      {(terms.loading || schedules.loading) && !terms.data && <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12 }}>Loading...</div>}
      {(terms.error || schedules.error) && !terms.data && <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>University server unreachable — retrying…</div>}
      {!terms.loading && !terms.error && terms.data && !schedules.loading && !schedules.error && timetable.length === 0 && (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', padding: 40, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>
          No schedules published yet
        </div>
      )}
      {timetable.length > 0 && (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(5, 1fr)', gap: 1, background: 'var(--secondary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--secondary)' }}>
            {['Time', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((h, i) => (
              <div key={i} style={{ background: i === 0 ? 'linear-gradient(135deg, var(--primary), var(--primary-dark))' : 'linear-gradient(135deg, var(--primary), var(--primary-dark))', padding: '12px 8px', fontSize: 12, textAlign: 'center', fontWeight: 700, color: '#fff' }}>{h}</div>
            ))}
            {timetable.flatMap((row) =>
              ['time', 'mon', 'tue', 'wed', 'thu', 'fri'].map((day) => {
                if (day === 'time') {
                  return <div key={row.time + day} style={{ background: 'var(--secondary-lighter)', padding: '12px 8px', fontSize: 11, textAlign: 'center', fontWeight: 700, color: 'var(--accent)' }}>{row.time}</div>;
                }
                const val = row[day as keyof typeof row];
                const isLunch = val.includes('Lunch');
                const isFree = val.includes('Free');
                if (isLunch) {
                  return <div key={row.time + day} style={{ background: 'var(--surface-soft)', padding: '12px 8px', fontSize: 11.5, textAlign: 'center', minHeight: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-lighter)', fontStyle: 'italic' }}>{val.replace('— ', '')}</div>;
                }
                if (isFree) {
                  return <div key={row.time + day} style={{ background: 'var(--surface-soft)', padding: '12px 8px', fontSize: 11.5, textAlign: 'center', minHeight: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-lighter)', fontStyle: 'italic' }}>{val.replace('— ', '')}</div>;
                }
                if (val) {
                  return <div key={row.time + day} style={{ background: 'linear-gradient(135deg, #e8f4fc, #d0e8f5)', borderRadius: 6, margin: 2, padding: '12px 8px', fontSize: 11.5, textAlign: 'center', minHeight: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 11 }}>{val}</div>
                  </div>;
                }
                return <div key={row.time + day} style={{ background: 'var(--surface-soft)', padding: '12px 8px', fontSize: 11.5, textAlign: 'center', minHeight: 70 }} />;
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { default as EventsSection } from '@/components/shared/EventsSection';

export function FinanceSection() {
  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Finance</h1>
      <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>University budget and financial overview</p>
      <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', padding: 40, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 14 }}>
        Nothing here yet
      </div>
    </div>
  );
}


export function SettingsSection() {
  const [settingsTab, setSettingsTab] = useState('Profile');
  const settingsTabs = ['Profile', 'Notifications', 'Security', 'Appearance', 'Blocked'];
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
      <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>Manage system preferences and configurations</p>
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-[18px]">
        <div>
          {settingsTab === 'Profile' && (
            <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}><User size={16} /> Profile Information</div>
              </div>
              <div style={{ padding: '16px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #bae6fd, #bae6fd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: 'var(--primary)' }}>AD</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>Admin User</div>
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>System Administrator • Management Portal</div>
                    <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--secondary-light)', color: 'var(--primary)', border: '1.5px solid var(--secondary)', marginTop: 8 }}><Upload size={13} /> Change Photo</button>
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Full Name</label><input type="text" defaultValue="Admin User" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} /></div>
                <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Email</label><input type="email" defaultValue="admin@university.edu" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} /></div>
                <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Phone Number</label><input type="tel" defaultValue="+95 9 000 000 000" style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)' }} /></div>
                <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Bio</label><textarea placeholder="Tell us about yourself..." style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--secondary)', background: 'var(--secondary-lighter)', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', resize: 'vertical', minHeight: 80 }} defaultValue="System administrator passionate about education technology." /></div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button style={{ background: 'transparent', color: 'var(--text-light)', borderRadius: 'var(--radius-sm)', padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none' }}>Cancel</button>
                  <button style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '10px 20px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Save Changes</button>
                </div>
              </div>
            </div>
          )}
          {settingsTab === 'Notifications' && (
            <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}><Bell size={16} /> Notification Preferences</div>
              </div>
              <div style={{ padding: '16px 22px' }}>
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
          )}
          {settingsTab === 'Security' && (
            <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}><Shield size={16} /> Security</div>
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
          )}
          {settingsTab === 'Appearance' && (
            <ThemeSwitcher />
          )}
          {settingsTab === 'Blocked' && (
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
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', maxHeight: 'fit-content' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0' }}>
            {settingsTabs.map((t) => (
              <button key={t} onClick={() => setSettingsTab(t)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, fontWeight: settingsTab === t ? 700 : 500, color: settingsTab === t ? 'var(--primary)' : 'var(--text)', background: settingsTab === t ? 'linear-gradient(90deg, rgba(14, 165, 233,0.15), transparent)' : 'transparent', border: 'none', borderLeft: settingsTab === t ? '3px solid var(--primary)' : '3px solid transparent', textAlign: 'left' }}>
                {t === 'Profile' && <User size={16} />}
                {t === 'Notifications' && <Bell size={16} />}
                {t === 'Security' && <Shield size={16} />}
                {t === 'Appearance' && <Eye size={16} />}
                {t === 'Blocked' && <Ban size={16} />}
                {t === 'Language' && <Globe size={16} />}
                {t === 'Help & Support' && <MessageCircle size={16} />}
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Shield(props: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function Globe(props: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
