'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, Ban, MessageSquare, Newspaper, RotateCcw, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/utils/supabase/client';
import { uniqueChannelName } from '@/lib/supabase/hooks';
import { useSession } from './session';
import FeedPost from './FeedPost';
import { useUniversityPeople, useUniversityRaw } from './useUniversityPeople';
import { toast } from 'sonner';
import type { Database } from '@/utils/supabase/types';

type Post = Database['public']['Tables']['posts']['Row'];

type ConvStatus = 'pending' | 'active' | 'blocked';

interface PersonConvRow {
  id: string;
  participant_ids: string[];
  status: ConvStatus;
  blocked_by: string | null;
  requested_by: string | null;
}

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
  const router = useRouter();
  const { user: session } = useSession();
  const me = session?.email ?? '';
  const { people, loading: peopleLoading } = useUniversityPeople();
  const { users, students, staff, loading: rawLoading } = useUniversityRaw();

  const [posts, setPosts] = useState<Post[] | null>(null);
  const [detail, setDetail] = useState<PersonDetail>(EMPTY_DETAIL);
  const [convId, setConvId] = useState<string | null>(null);
  const [convStatus, setConvStatus] = useState<ConvStatus | null>(null);
  const [blockedBy, setBlockedBy] = useState('');
  const [busy, setBusy] = useState(false);

  const person = people.find((p) => p.email.toLowerCase() === email.toLowerCase());
  const isSelf = !!me && !!person && person.email.toLowerCase() === me.toLowerCase();
  const isBlockedByMe = convStatus === 'blocked' && blockedBy === me;

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
    if (!email || rawLoading) return;
    const u = users.find((x) => x.email.toLowerCase() === email.toLowerCase());
    if (!u) return;
    if (u.roleName === 'STUDENT') {
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
      const s = staff.find((x) => x.userId === u.userId);
      if (s) setDetail({ rollNo: '', major: '', semester: '', unit: s.unitName, phone: s.phoneNo || '' });
    }
  }, [email, rawLoading, users, students, staff]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load person details on mount
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!me || !email || me.toLowerCase() === email.toLowerCase()) return;
    const load = async () => {
      const { data } = (await supabase
        .from('conversations')
        .select('*')
        .contains('participant_ids', [me])
        .order('last_message_at', { ascending: false })) as unknown as { data: PersonConvRow[] | null };
      const conv = (data ?? []).find(
        (c) => (c.participant_ids ?? []).length === 2 && c.participant_ids.includes(email.toLowerCase()),
      );
      if (conv) {
        setConvId(conv.id);
        setConvStatus(conv.status);
        setBlockedBy(conv.blocked_by || '');
      } else {
        setConvId(null);
        setConvStatus(null);
        setBlockedBy('');
      }
    };
    load();
    const ch = supabase
      .channel(uniqueChannelName(`public:conversations:${me}:${email}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, me, email]);

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

  const messagePerson = async () => {
    if (!person || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherEmail: person.email, otherName: person.name, otherInitials: person.initials }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Could not start conversation' }))).message);
      const { conversationId } = await res.json();
      router.push(`/${session?.role ?? 'student'}/messages?conv=${conversationId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start conversation');
    } finally {
      setBusy(false);
    }
  };

  const blockOrUnblock = async () => {
    if (!person || busy || !me) return;
    setBusy(true);
    try {
      let id = convId;
      if (!id) {
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ otherEmail: person.email, otherName: person.name, otherInitials: person.initials }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Could not start conversation' }))).message);
        id = (await res.json()).conversationId;
      }
      const action = isBlockedByMe ? 'unblock' : 'block';
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Action failed' }))).message);
      toast.success(action === 'block' ? `${person.name} blocked` : `${person.name} unblocked`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

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
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-7" style={{ background: 'linear-gradient(160deg, rgba(14, 165, 233,0.12), transparent)' }}>
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center text-white font-extrabold shrink-0 bg-gradient-to-br ${avatarGradient}`}
            style={{ fontSize: 26, boxShadow: '0 6px 18px rgba(14, 165, 233,0.25)' }}
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
              <span className="badge badge-sm" style={{ background: 'rgba(14, 165, 233,0.12)', color: 'var(--primary)' }}>{person.role}</span>
              {person.sub && <span style={{ fontSize: 11.5, color: 'var(--text-light)' }}>{person.sub}</span>}
            </div>
          </div>
          {!isSelf && (
            <div className="flex flex-row sm:flex-col items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={messagePerson}
                disabled={busy}
                className="btn btn-primary btn-sm w-full"
                style={{ borderRadius: 'var(--radius-md)', minWidth: 110 }}
              >
                {busy ? <span className="loading loading-spinner loading-xs" /> : <MessageSquare size={14} />}
                Message
              </button>
              {isBlockedByMe ? (
                <button
                  type="button"
                  onClick={blockOrUnblock}
                  disabled={busy}
                  className="btn btn-outline btn-sm w-full"
                  style={{ borderRadius: 'var(--radius-md)', minWidth: 110 }}
                >
                  {busy ? <span className="loading loading-spinner loading-xs" /> : <RotateCcw size={14} />}
                  Unblock
                </button>
              ) : (
                <button
                  type="button"
                  onClick={blockOrUnblock}
                  disabled={busy}
                  className="btn btn-sm w-full"
                  style={{ borderRadius: 'var(--radius-md)', minWidth: 110, border: '1px solid var(--danger)', color: 'var(--danger)', background: 'transparent' }}
                >
                  {busy ? <span className="loading loading-spinner loading-xs" /> : <Ban size={14} />}
                  Block
                </button>
              )}
              {convStatus === 'blocked' && blockedBy && blockedBy !== me && (
                <span className="text-[11px] font-semibold" style={{ color: 'var(--danger)' }}>Blocked you</span>
              )}
            </div>
          )}
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
