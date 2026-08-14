'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, Newspaper, User } from 'lucide-react';
import Link from 'next/link';
import { useSupabase } from '@/utils/supabase/client';
import { uniqueChannelName } from '@/lib/supabase/hooks';
import { useSession } from './session';
import FeedPost from './FeedPost';
import { useUniversityPeople } from './useUniversityPeople';
import { apiFetch } from './api';
import type { UserRecord, StaffRecord, StudentRecord } from './api';
import type { Database } from '@/utils/supabase/types';

type Post = Database['public']['Tables']['posts']['Row'];

interface PersonDetail {
  rollNo: string;
  major: string;
  semester: string;
  unit: string;
  phone: string;
}

const EMPTY_DETAIL: PersonDetail = { rollNo: '', major: '', semester: '', unit: '', phone: '' };

export default function PersonProfileSection({ email }: { email: string }) {
  const supabase = useSupabase();
  const { user: session } = useSession();
  const { people, loading: peopleLoading } = useUniversityPeople();

  const [posts, setPosts] = useState<Post[] | null>(null);
  const [detail, setDetail] = useState<PersonDetail>(EMPTY_DETAIL);

  const person = people.find((p) => p.email.toLowerCase() === email.toLowerCase());

  useEffect(() => {
    if (!email) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('author_email', email)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      if (error) setPosts([]);
      else setPosts(data ?? []);
    };
    load();
    const ch = supabase
      .channel(uniqueChannelName(`public:posts:author:${email}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `author_email=eq.${email}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, email]);

  const loadDetail = useCallback(async () => {
    if (!email) return;
    try {
      const users = await apiFetch<UserRecord[]>('/api/users');
      const u = users.find((x) => x.email.toLowerCase() === email.toLowerCase());
      if (!u) return;
      if (u.roleName === 'STUDENT') {
        const students = await apiFetch<StudentRecord[]>('/api/students');
        const s = students.find((x) => x.email.toLowerCase() === email.toLowerCase());
        if (s) {
          const year = Math.ceil(s.semesterNo / 2);
          setDetail({
            rollNo: s.rollNo,
            major: s.majorCode,
            semester: `Semester ${s.semesterNo} \u2022 ${year}${['st', 'nd', 'rd'][year - 1] || 'th'} Year`,
            unit: '',
            phone: s.phoneNo || '',
          });
        }
      } else {
        const staff = await apiFetch<StaffRecord[]>('/api/staff');
        const s = staff.find((x) => x.userId === u.userId);
        if (s) setDetail({ rollNo: '', major: '', semester: '', unit: s.unitName, phone: s.phoneNo || '' });
      }
    } catch {
      // university server unreachable; details are best-effort
    }
  }, [email]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load person details on mount
    loadDetail();
  }, [loadDetail]);

  const backPath = `/${session?.role ?? 'student'}/feed`;
  const roleKey = person?.role.toLowerCase() ?? '';
  const avatarGradient =
    roleKey === 'student' ? 'from-info to-info/70' :
    roleKey === 'staff' ? 'from-success to-success/70' : 'from-primary to-secondary';

  const detailRows = [
    ['Roll No', detail.rollNo],
    ['Major', detail.major],
    ['Semester', detail.semester],
    ['Unit', detail.unit],
    ['Phone', detail.phone],
  ].filter(([, v]) => v) as [string, string][];

  if (peopleLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="max-w-[760px] mx-auto text-center py-16">
        <User size={40} style={{ color: 'var(--text-lighter)', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>User not found</div>
        <div style={{ fontSize: 13, color: 'var(--text-lighter)', marginTop: 4 }}>{email}</div>
        <Link
          href={backPath}
          className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 rounded-lg no-underline cursor-pointer"
          style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', fontSize: 13, fontWeight: 600 }}
        >
          <ArrowLeft size={14} /> Back to Feed
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto">
      <Link
        href={backPath}
        className="inline-flex items-center gap-1.5 mb-4 no-underline"
        style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--primary)' }}
      >
        <ArrowLeft size={14} /> Back to Feed
      </Link>

      <div className="bg-base-100 backdrop-blur-xl mb-4" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-7" style={{ background: 'linear-gradient(160deg, rgba(58,139,194,0.12), transparent)' }}>
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center text-white font-extrabold shrink-0 bg-gradient-to-br ${avatarGradient}`}
            style={{ fontSize: 26, boxShadow: '0 6px 18px rgba(58,139,194,0.25)' }}
          >
            {person.initials}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--accent)' }}>{person.name}</span>
              <BadgeCheck size={16} style={{ color: 'var(--primary)' }} />
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-lighter)' }}>{person.email}</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="badge badge-sm" style={{ background: 'rgba(58,139,194,0.12)', color: 'var(--primary)' }}>{person.role}</span>
              {person.sub && <span style={{ fontSize: 11.5, color: 'var(--text-light)' }}>{person.sub}</span>}
            </div>
          </div>
        </div>
        {detailRows.length > 0 && (
          <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5" style={{ borderTop: '1px solid var(--surface)' }}>
            {detailRows.map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-lighter)' }}>{k}</span>
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid var(--surface)' }}>
          <Newspaper size={16} style={{ color: 'var(--primary)' }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>Published Posts</div>
          {posts && <span className="text-xs" style={{ color: 'var(--text-lighter)' }}>({posts.length})</span>}
        </div>
        {!posts && (
          <div className="text-center py-10 text-sm" style={{ color: 'var(--text-lighter)' }}>Loading posts...</div>
        )}
        {posts && posts.length === 0 && (
          <div className="text-center py-10 text-sm" style={{ color: 'var(--text-lighter)' }}>
            No published posts yet.
          </div>
        )}
        {posts?.map((post) => (
          <div key={post.id} style={{ borderBottom: '1px solid var(--surface)' }}>
            <FeedPost post={post} />
          </div>
        ))}
      </div>
    </div>
  );
}
