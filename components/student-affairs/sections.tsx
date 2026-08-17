'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import WelcomeBar from '@/components/shared/WelcomeBar';
import StatCard from '@/components/shared/StatCard';
import MessageItem from '@/components/shared/MessageItem';
import LostFoundPage from '@/components/shared/LostFoundSection';
import DataTable from '@/components/shared/DataTable';
import ThemeSwitcher from '@/components/shared/ThemeSwitcher';
import PendingPostApprovals from '@/components/shared/PendingPostApprovals';
import {
  Users, CalendarCheck, MessageSquare, ClipboardList,
  GraduationCap, BookOpen, Search, Plus,
  Eye, Upload, Save, Ban,
} from 'lucide-react';
import type { StudentData } from '@/components/shared/types';
import { apiFetch } from '@/components/shared/api';
import type {
  StudentRecord, UserRecord,
} from '@/components/shared/api';
import { useUniversityData } from '@/components/shared/useUniversityData';
import { useSupabase } from '@/utils/supabase/client';
import { useConversations, useEvents, useEventRegistrations } from '@/lib/supabase/hooks';
import { useSession } from '@/components/shared/session';
export { default as FeedSection } from '@/components/shared/FeedSection';
export { default as MessagesSection } from '@/components/shared/MessagesSection';
export { ExploreSection } from '@/components/admin/sections';
export { default as ExamResultsSection } from '@/components/shared/ExamResultDistributionSection';
import BlockedSection from '@/components/shared/BlockedSection';

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
  const { conversations, loading: convLoading } = useConversations(supabase, me);
  const { events, loading: eventsLoading } = useEvents(supabase);
  const eventIds = useMemo(() => (events ?? []).map((e) => e.id), [events]);
  const { registrations } = useEventRegistrations(supabase, eventIds, me);
  const { data: users, loading: usersLoading } = useUniversityData<UserRecord[]>(
    useCallback(() => apiFetch<UserRecord[]>('/api/users'), [])
  );

  const counts = useMemo(() => {
    const list = users ?? [];
    return { students: list.filter((u) => u.roleName === 'STUDENT').length };
  }, [users]);

  const upcomingEvents = useMemo(
    () => (events ?? []).filter((e) => e.event_date >= Date.now()).sort((a, b) => a.event_date - b.event_date).slice(0, 3),
    [events]
  );
  const upcomingCount = useMemo(
    () => (events ?? []).filter((e) => e.event_date >= Date.now()).length,
    [events]
  );

  const unreadTotal = useMemo(
    () => (conversations ?? []).reduce((s, c) => s + (c.unread ?? 0), 0),
    [conversations]
  );
  const pendingRequests = useMemo(
    () => (conversations ?? []).filter((c) => c.status === 'pending' && c.requestedBy !== me).length,
    [conversations, me]
  );

  return (
    <div>
      <WelcomeBar
        name="Student Affairs Office"
        subtitle={`Student services overview — ${pendingRequests} pending request${pendingRequests === 1 ? '' : 's'} and ${upcomingCount} upcoming event${upcomingCount === 1 ? '' : 's'} this week`}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard icon={<GraduationCap size={20} />} iconBgClass="bg-primary/10 text-primary" value={usersLoading ? '—' : counts.students} label="Active Students" trend={usersLoading ? 'Loading...' : 'Active accounts'} />
        <StatCard icon={<CalendarCheck size={20} />} iconBgClass="bg-success/10 text-success" value={eventsLoading ? '—' : upcomingCount} label="Upcoming Events" trend={eventsLoading ? 'Loading...' : 'Scheduled'} />
        <StatCard icon={<MessageSquare size={20} />} iconBgClass="bg-warning/10 text-warning" value={convLoading ? '—' : (conversations?.length ?? 0)} label="New Messages" trend={convLoading ? 'Loading...' : `${unreadTotal} unread`} />
        <StatCard icon={<ClipboardList size={20} />} iconBgClass="bg-error/10 text-error" value={pendingRequests} label="Pending Requests" trend="Need review" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-[18px]">
        <div>
          <PendingPostApprovals viewAllHref="/student-affair/moderation" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: 16, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarCheck size={16} /> Upcoming Events
              </div>
              <Link href="/student-affair/events" style={{ fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, padding: '6px 14px', borderRadius: 'var(--radius-sm)', textDecoration: 'none', display: 'inline-block' }}>
                Calendar <span style={{ fontSize: 10 }}>→</span>
              </Link>
            </div>
            {!eventsLoading && upcomingEvents.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-lighter)', fontSize: 13 }}>No upcoming events</div>
            ) : (
              <div style={{ padding: '6px 0' }}>
                {upcomingEvents.map((e) => (
                  <Link
                    key={e.id}
                    href="/student-affair/events"
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
          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', flex: 1 }}>
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
        </div>
      </div>
    </div>
  );
}



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

export { default as EventsSection } from '@/components/shared/EventsSection';

export function LostFoundSection() {
  return <LostFoundPage />;
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
