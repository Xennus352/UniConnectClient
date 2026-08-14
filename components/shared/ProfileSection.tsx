'use client';

import { useCallback, useEffect, useState } from 'react';
import { User, Save, Newspaper, BadgeCheck, Mail, Lock } from 'lucide-react';
import { useSupabase } from '@/utils/supabase/client';
import { uniqueChannelName } from '@/lib/supabase/hooks';
import { useSession } from './session';
import { toast } from 'sonner';
import { apiFetch } from './api';
import type { UserRecord, StaffRecord, StudentRecord } from './api';

const POST_STATUS_META: Record<string, { label: string; badge: string; color: string }> = {
  approved: { label: 'Published', badge: 'badge-success', color: 'var(--success)' },
  pending_review: { label: 'Pending Review', badge: 'badge-warning', color: 'var(--warning)' },
  pending_ai: { label: 'AI Filtering', badge: 'badge-warning', color: 'var(--warning)' },
  rejected: { label: 'Rejected', badge: 'badge-error', color: 'var(--danger)' },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

interface BackendProfile {
  account: UserRecord | null;
  name: string;
  major: string;
  semester: string;
  rollNo: string;
  unit: string;
  phone: string;
}

const EMPTY_PROFILE: BackendProfile = {
  account: null,
  name: '',
  major: '',
  semester: '',
  rollNo: '',
  unit: '',
  phone: '',
};

export default function ProfileSection() {
  const { user: session } = useSession();
  const supabase = useSupabase();
  const me = session?.email ?? '';

  const [myPosts, setMyPosts] = useState<any[] | null>(null);

  useEffect(() => {
    if (!me) { setMyPosts([]); return; }
    const load = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('author_email', me)
        .order('created_at', { ascending: false });
      if (error) setMyPosts([]);
      else setMyPosts(data ?? []);
    };
    load();
    const ch = supabase
      .channel(uniqueChannelName('public:posts:myprofile'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, me]);

  const [profile, setProfile] = useState<BackendProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!me) return;
    try {
      const account = await apiFetch<UserRecord>('/api/users/me');
      let name = '';
      let major = '';
      let semester = '';
      let rollNo = '';
      let unit = '';
      let phone = '';
      if (account.roleName === 'STUDENT') {
        const students = await apiFetch<StudentRecord[]>('/api/students');
        const mine = students.find((s) => s.email.toLowerCase() === me.toLowerCase());
        if (mine) {
          name = mine.studentName;
          major = mine.majorCode;
          rollNo = mine.rollNo;
          phone = mine.phoneNo || '';
          const year = Math.ceil(mine.semesterNo / 2);
          semester = `Semester ${mine.semesterNo} \u2022 ${year}${['st', 'nd', 'rd'][year - 1] || 'th'} Year`;
        }
      } else {
        const staff = await apiFetch<StaffRecord[]>('/api/staff');
        const mine = staff.find((s) => s.userId === account.userId);
        if (mine) {
          name = mine.staffName;
          unit = mine.unitName;
          phone = mine.phoneNo || '';
        }
      }
      setProfile({ account, name, major, semester, rollNo, unit, phone });
      setEmail(account.email);
    } catch {
      // university server unreachable
    } finally {
      setLoading(false);
    }
  }, [me]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load profile on mount
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          email: email || undefined,
          currentPassword: password ? currentPassword || undefined : undefined,
          newPassword: password || undefined,
        }),
      });
      toast.success('Profile updated');
      setPassword('');
      setCurrentPassword('');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    fontSize: 13.5,
    color: 'var(--text)',
    background: 'var(--divider)',
    border: '1.5px solid var(--surface-border)',
    borderRadius: 'var(--radius-md)',
    outline: 'none',
  };

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="flex items-center gap-2.5 mb-5">
        <User size={20} style={{ color: 'var(--primary)' }} />
        <h2 className="text-xl font-bold" style={{ color: 'var(--accent)' }}>My Profile</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-[18px]">
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', alignSelf: 'start' }}>
          <div className="flex flex-col items-center px-6 py-8" style={{ background: 'linear-gradient(160deg, rgba(58,139,194,0.12), transparent)' }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center font-extrabold text-white mb-3" style={{ fontSize: 26, background: 'linear-gradient(to bottom right, #CBDDE9, #8abbd4)', color: '#2872A1', boxShadow: '0 6px 18px rgba(58,139,194,0.25)' }}>
              {session?.initials || 'U'}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
              {loading ? 'Loading...' : profile.name || session?.name || 'User'}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-lighter)' }}>{me}</div>
            <div className="flex items-center gap-1 mt-3">
              <BadgeCheck size={14} style={{ color: 'var(--primary)' }} />
              <span className="badge badge-sm" style={{ background: 'rgba(58,139,194,0.12)', color: 'var(--primary)' }}>
                {profile.account?.roleName === 'SYSTEM_ADMIN' ? 'admin' : profile.account?.roleName ? profile.account.roleName.toLowerCase() : session?.role || ''}
              </span>
            </div>
          </div>
          <div className="px-6 py-4 flex flex-col gap-2" style={{ borderTop: '1px solid var(--surface)' }}>
            {[
              ['Roll No', profile.rollNo || '—'],
              ['Major', profile.major || '—'],
              ['Semester', profile.semester || '—'],
              ['Unit', profile.unit || '—'],
              ['Phone', profile.phone || '—'],
              ['Status', profile.account ? (profile.account.isActive ? 'Active' : 'Inactive') : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-lighter)' }}>{k}</span>
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-[18px]">
          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>Account Settings</div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold cursor-pointer border-none disabled:opacity-40"
                style={{ borderRadius: 'var(--radius-sm)', background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff' }}
              >
                <Save size={13} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 p-5">
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: 5 }}>
                  <Mail size={12} style={{ verticalAlign: -2 }} /> Email
                </label>
                <input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: 5 }}>
                  <Lock size={12} style={{ verticalAlign: -2 }} /> Current Password
                </label>
                <input style={inputStyle} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Required to change password" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: 5 }}>
                  <Lock size={12} style={{ verticalAlign: -2 }} /> New Password
                </label>
                <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep current" />
              </div>
            </div>
          </div>

          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <Newspaper size={16} style={{ color: 'var(--primary)' }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>My Posts</div>
            </div>
            {!myPosts && (
              <div className="text-center py-10 text-sm" style={{ color: 'var(--text-lighter)' }}>Loading...</div>
            )}
            {myPosts && myPosts.length === 0 && (
              <div className="text-center py-10 text-sm" style={{ color: 'var(--text-lighter)' }}>
                You haven&apos;t posted anything yet.
              </div>
            )}
            {myPosts?.map((post) => {
              const meta = POST_STATUS_META[post.status] ?? POST_STATUS_META.pending_review;
              return (
                <div key={post.id} className="px-5 py-4" style={{ borderBottom: '1px solid var(--surface)' }}>
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span className="badge badge-sm gap-1" style={{ background: meta.color, color: '#fff', border: 'none' }}>
                      {meta.label}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-lighter)' }}>{timeAgo(post.created_at)}</span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text)', lineHeight: 1.6 }}>{post.content}</p>
                  {post.image && (
                    <img src={post.image} alt="" className="rounded-lg mt-2 w-full object-cover" style={{ maxHeight: 180 }} />
                  )}
                  {post.status === 'rejected' && (
                    <p className="text-xs mt-2" style={{ color: 'var(--danger)' }}>
                      {post.moderation_note ? `Reason: ${post.moderation_note}` : 'Rejected by moderation'}
                    </p>
                  )}
                  {post.ai_flags && post.status === 'rejected' && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-lighter)' }}>AI flags: {post.ai_flags}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}