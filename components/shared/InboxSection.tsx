'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Inbox, UserCheck, UserX, MessageSquare, Clock, Ban, GraduationCap, FileText } from 'lucide-react';
import { useSupabase } from '@/utils/supabase/client';
import { useConversations } from '@/lib/supabase/hooks';
import { toast } from 'sonner';
import { useSession } from './session';
import { apiFetch, type StudentRecord, type ResultDocumentRecord } from './api';

interface ConvItem {
  id: string;
  status: 'pending' | 'active' | 'blocked';
  requestedBy: string;
  blockedBy: string;
  lastMessageAt: number;
  preview: string;
  unread: number;
  other: { email: string; name: string; initials: string };
}

export default function InboxSection() {
  const supabase = useSupabase();
  const { user: session } = useSession();
  const me = session?.email ?? '';
  const role = session?.role ?? '';

  const router = useRouter();
  const pathname = usePathname();

  const { conversations, loading } = useConversations(supabase, me);

  const [results, setResults] = useState<ResultDocumentRecord[] | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  const isStudent = role === 'student';

  const tabs = isStudent
    ? [
        { id: 'results', label: 'Exam Results' },
        { id: 'requests', label: 'Message Requests' },
        { id: 'conversations', label: 'Conversations' },
      ]
    : [
        { id: 'requests', label: 'Message Requests' },
        { id: 'conversations', label: 'Conversations' },
      ];

  const [activeTab, setActiveTab] = useState<string>(tabs[0].id);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync URL tab after hydration
    const param = new URLSearchParams(window.location.search).get('tab');
    if (param && tabs.some((t) => t.id === param)) setActiveTab(param);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTab = (id: string) => {
    setActiveTab(id);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (!me || !isStudent) return;
    let cancelled = false;
    setResultsLoading(true);
    (async () => {
      try {
        const students = await apiFetch<StudentRecord[]>('/api/students');
        const self = students.find((s) => s.email.toLowerCase() === me.toLowerCase());
        if (!self) {
          if (!cancelled) { setResults([]); setResultsLoading(false); }
          return;
        }
        const res = await apiFetch<ResultDocumentRecord[]>(`/api/students/${self.studentId}/results`);
        if (!cancelled) setResults(res ?? []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setResultsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [me, isStudent]);

  const releasedResults = useMemo(
    () => (results ?? []).filter((r) => r.releaseStatus === 'RELEASED'),
    [results]
  );

  const releasedKey = releasedResults.map((r) => r.resultDocumentId).join('|');

  useEffect(() => {
    if (!me || !isStudent || releasedResults.length === 0) return;
    const payload = releasedResults.map((r) => ({ id: r.resultDocumentId, examType: r.examTypeName }));
    fetch('/api/exam-results/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: payload }),
    }).catch(() => {});
  }, [me, isStudent, releasedKey, releasedResults.length]);

  const items = (conversations as ConvItem[] | null) ?? [];
  const requests = useMemo(
    () => items.filter((c) => c.status === 'pending' && c.requestedBy !== me),
    [items, me]
  );
  const chats = useMemo(
    () => items.filter((c) => c.status !== 'pending' || c.requestedBy === me),
    [items, me]
  );

  const handleAccept = async (convId: string) => {
    const res = await fetch(`/api/conversations/${convId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept' }),
    });
    if (res.ok) toast.success('Message request accepted');
    else toast.error('Could not accept request');
  };

  const handleReject = async (convId: string) => {
    const res = await fetch(`/api/conversations/${convId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    });
    if (res.ok) toast.success('Message request declined');
    else toast.error('Could not decline request');
  };

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-5">
        <Inbox size={20} style={{ color: 'var(--primary)' }} />
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--accent)' }}>Inbox</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-lighter)' }}>
            {activeTab === 'results' && releasedResults.length > 0
              ? `${releasedResults.length} released exam result${releasedResults.length > 1 ? 's' : ''} ready to view`
              : requests.length > 0
                ? `You have ${requests.length} pending message request${requests.length > 1 ? 's' : ''}`
                : 'No pending message requests'}
          </p>
        </div>
      </div>

      <div className="flex gap-1 mb-5" style={{ borderBottom: '1px solid var(--surface)' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            style={{
              padding: '12px 16px', fontSize: 13, fontWeight: 600,
              color: activeTab === t.id ? 'var(--primary)' : 'var(--text-light)',
              cursor: 'pointer', borderBottom: activeTab === t.id ? '2.5px solid var(--primary)' : '2.5px solid transparent',
              background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {t.id === 'results' && <GraduationCap size={15} />}
            {t.id === 'requests' && <Clock size={15} />}
            {t.id === 'conversations' && <MessageSquare size={15} />}
            {t.label}
            {t.id === 'results' && releasedResults.length > 0 && (
              <span className="badge badge-sm" style={{ background: 'rgba(52,211,153,0.15)', color: '#16a34a', border: 'none' }}>
                {releasedResults.length}
              </span>
            )}
            {t.id === 'requests' && requests.length > 0 && (
              <span className="badge badge-sm" style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706', border: 'none' }}>
                {requests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'results' && isStudent && (
        <div className="bg-base-100 backdrop-blur-xl mb-5" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <GraduationCap size={16} style={{ color: 'var(--primary)' }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>Exam Results</div>
            </div>
            <Link href={`/${role}/exam-results`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>
              View all →
            </Link>
          </div>
          {resultsLoading && (
            <div className="text-center py-8 text-sm" style={{ color: 'var(--text-lighter)' }}>Loading results...</div>
          )}
          {!resultsLoading && releasedResults.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: 'var(--text-lighter)' }}>No exam results published yet</div>
          )}
          {releasedResults.map((r) => (
            <Link
              key={r.resultDocumentId}
              href={`/${role}/exam-results`}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-(--surface-soft)"
              style={{ borderBottom: '1px solid var(--surface)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(14,165,233,0.12)', color: 'var(--primary)' }}>
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{r.examTypeName} — {r.pdfFileName}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-lighter)' }}>
                  Roll No {r.rollNo} • Your result is ready to view
                </div>
              </div>
              <span className="badge badge-sm shrink-0" style={{ background: 'rgba(52,211,153,0.15)', color: '#16a34a', border: 'none' }}>
                Released
              </span>
            </Link>
          ))}
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="bg-base-100 backdrop-blur-xl mb-5" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
            <Clock size={16} style={{ color: 'var(--warning)' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>Message Requests</div>
          </div>
          {requests.length === 0 && (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--text-lighter)' }}>
              No message requests right now
            </div>
          )}
          {requests.map((req) => (
            <div key={req.id} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid var(--surface)' }}>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 12 }}>
                {req.other.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{req.other.name}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-lighter)' }}>
                  {req.other.email} wants to start a conversation with you
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleAccept(req.id)}
                  className="btn btn-sm gap-1.5 border-none text-white"
                  style={{ background: 'linear-gradient(var(--success), var(--success-dark))' }}
                >
                  <UserCheck size={14} /> Accept
                </button>
                <button
                  onClick={() => handleReject(req.id)}
                  className="btn btn-sm gap-1.5 border-none text-white"
                  style={{ background: 'linear-gradient(var(--danger), var(--danger-dark))' }}
                >
                  <UserX size={14} /> Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'conversations' && (
        <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
            <MessageSquare size={16} style={{ color: 'var(--primary)' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>Conversations</div>
          </div>
          {chats.length === 0 && (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--text-lighter)' }}>
              No conversations yet
            </div>
          )}
          {chats.map((conv) => {
            const hasUnread = (conv.unread ?? 0) > 0;
            return (
              <Link
                key={conv.id}
                href={`/${session?.role ?? ''}/messages`}
                className="flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-(--surface-soft)"
                style={{ borderBottom: '1px solid var(--surface)', display: 'flex' }}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 12 }}>
                  {conv.other.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div style={{ fontSize: 14, fontWeight: hasUnread ? 700 : 600, color: 'var(--accent)' }}>{conv.other.name}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      {hasUnread && (
                        <span
                          className="flex items-center justify-center rounded-full text-white font-bold"
                          style={{ minWidth: 18, height: 18, padding: '0 5px', fontSize: 10.5, background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
                        >
                          {conv.unread}
                        </span>
                      )}
                      {conv.status === 'blocked' && (
                        <span className="badge badge-sm gap-1" style={{ background: 'rgba(248,113,113,0.15)', color: '#dc2626', border: 'none' }}>
                          <Ban size={10} /> Blocked
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className="text-xs mt-0.5 truncate"
                    style={{ color: hasUnread ? 'var(--text)' : 'var(--text-lighter)', fontWeight: hasUnread ? 600 : 400 }}
                  >
                    {conv.preview}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}