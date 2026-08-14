'use client';

import { useState, useEffect, useCallback } from 'react';
import { Ban, Search, RotateCcw, Plus, Loader2, UserX, MessageSquare } from 'lucide-react';
import { useSupabase } from '@/utils/supabase/client';
import { uniqueChannelName } from '@/lib/supabase/hooks';
import { useSession } from './session';
import { useUniversityPeople, type UniversityPerson } from './useUniversityPeople';
import { toast } from 'sonner';

type ConvStatus = 'pending' | 'active' | 'blocked';

interface BlockedConv {
  id: string;
  status: ConvStatus;
  blockedBy: string;
  createdAt: number;
  lastMessageAt: number;
  preview: string;
  isGroup: boolean;
  other: { email: string; name: string; initials: string };
}

interface ConversationRow {
  id: string;
  participant_ids: string[];
  status: string;
  requested_by: string | null;
  blocked_by: string | null;
  participant_meta: Array<{ email: string; name?: string; initials?: string }> | null;
  created_at: number;
  last_message_at: number;
  preview: string | null;
}

function timeLabel(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const d = new Date(ts);
  return `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
}

export default function BlockedSection({ bare = false }: { bare?: boolean }) {
  const supabase = useSupabase();
  const { user: session } = useSession();
  const me = session?.email ?? '';

  const [blocked, setBlocked] = useState<BlockedConv[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'iBlocked' | 'blockedMe'>('all');
  const [search, setSearch] = useState('');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockSearch, setBlockSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const { people, loading: peopleLoading, error: peopleError, refresh: peopleRefresh } = useUniversityPeople();

  useEffect(() => {
    if (!me) return;
    const load = async () => {
      const { data, error } = (await supabase
        .from('conversations')
        .select('*')
        .contains('participant_ids', [me])
        .eq('status', 'blocked')
        .order('created_at', { ascending: false })) as { data: ConversationRow[] | null; error: { message: string } | null };
      if (error) { console.error(error); setBlocked([]); return; }
      const enriched: BlockedConv[] = (data ?? []).map((conv) => {
        const meta = conv.participant_meta ?? [];
        const participants = (conv.participant_ids as string[]) || [];
        const groupEntry = meta.find((m) => m.email === '__GROUP__');
        const isGroup = participants.length > 2 || !!groupEntry;
        const otherEmail = participants.find((p) => p !== me) || '';
        const otherMeta = meta.find((m) => m.email === otherEmail);
        const other = {
          email: otherEmail,
          name: otherMeta?.name || otherEmail,
          initials: otherMeta?.initials || otherEmail.slice(0, 2).toUpperCase(),
        };
        return {
          id: conv.id,
          status: (conv.status as ConvStatus) || 'blocked',
          blockedBy: conv.blocked_by || '',
          createdAt: conv.created_at || 0,
          lastMessageAt: conv.last_message_at || 0,
          preview: conv?.preview ?? '',
          isGroup,
          other,
        };
      });
      setBlocked(enriched.filter((c) => !c.isGroup));
    };
    load();
    const ch = supabase
      .channel(uniqueChannelName('public:conversations:blocked'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, me]);

  const unblock = async (conv: BlockedConv) => {
    if (busyId) return;
    setBusyId(conv.id);
    try {
      const res = await fetch(`/api/conversations/${conv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unblock' }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Could not unblock' }))).message);
      toast.success(`${conv.other.name} unblocked`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not unblock');
    } finally {
      setBusyId(null);
    }
  };

  const blockUser = async (p: UniversityPerson) => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherEmail: p.email, otherName: p.name, otherInitials: p.initials }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Could not start conversation' }))).message);
      const { conversationId } = await res.json();
      const res2 = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'block' }),
      });
      if (!res2.ok) throw new Error((await res2.json().catch(() => ({ message: 'Could not block' }))).message);
      toast.success(`${p.name} blocked`);
      setBlockSearch('');
      setShowBlockModal(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not block');
    }
  };

  const alreadyBlocked = useCallback(
    (email: string) => (blocked ?? []).some((c) => c.other.email.toLowerCase() === email.toLowerCase()),
    [blocked]
  );

  const filtered = (blocked ?? []).filter((c) => {
    if (filter === 'iBlocked' && c.blockedBy !== me) return false;
    if (filter === 'blockedMe' && c.blockedBy === me) return false;
    const q = search.trim().toLowerCase();
    if (q && !c.other.name.toLowerCase().includes(q) && !c.other.email.toLowerCase().includes(q)) return false;
    return true;
  });

  const blockable = people.filter(
    (p) => p.email !== me && p.name.toLowerCase().includes(blockSearch.toLowerCase())
  );

  const iBlockedCount = (blocked ?? []).filter((c) => c.blockedBy === me).length;
  const blockedMeCount = (blocked ?? []).filter((c) => c.blockedBy !== me).length;

  const pills: { key: typeof filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: blocked?.length ?? 0 },
    { key: 'iBlocked', label: 'I blocked', count: iBlockedCount },
    { key: 'blockedMe', label: 'Blocked me', count: blockedMeCount },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: bare ? 'flex-end' : 'space-between', marginBottom: bare ? 14 : 4 }}>
        {!bare && (
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)' }}>Blocked Users</h1>
            <p style={{ fontSize: 14, color: 'var(--text-light)', margin: '4px 0 0' }}>Manage who you block and who blocked you</p>
          </div>
        )}
        <button
          onClick={() => setShowBlockModal(true)}
          className="btn btn-sm gap-1.5 border-none text-white cursor-pointer"
          style={{ background: 'linear-gradient(var(--danger), var(--danger-dark))' }}
        >
          <Ban size={14} /> Block user
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: bare ? 0 : 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pills.map((p) => (
            <button
              key={p.key}
              onClick={() => setFilter(p.key)}
              className="cursor-pointer"
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                padding: '7px 14px',
                borderRadius: 18,
                border: filter === p.key ? '1.5px solid var(--primary)' : '1.5px solid var(--surface-border)',
                background: filter === p.key ? 'rgba(14, 165, 233,0.15)' : 'var(--divider)',
                color: filter === p.key ? 'var(--primary)' : 'var(--text-light)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {p.label}
              <span
                className="flex items-center justify-center rounded-full"
                style={{
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  fontSize: 10.5,
                  fontWeight: 700,
                  background: filter === p.key ? 'linear-gradient(var(--primary), var(--primary-dark))' : 'var(--surface-soft)',
                  color: filter === p.key ? '#fff' : 'var(--text-light)',
                }}
              >
                {p.count}
              </span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--divider)', padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--surface-border)', flex: 1, maxWidth: 340 }}>
          <Search size={14} style={{ color: 'var(--text-lighter)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: 13, color: 'var(--text)', border: 'none' }}
          />
        </div>
      </div>

      <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
          <Ban size={15} style={{ color: 'var(--danger)' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
            Block list ({filtered.length})
          </span>
        </div>

        {!blocked && (
          <div className="text-center py-12 text-xs" style={{ color: 'var(--text-lighter)' }}>Loading...</div>
        )}
        {blocked && filtered.length === 0 && (
          <div className="text-center py-12">
            <UserX size={30} className="mx-auto mb-3 opacity-40" />
            <p className="text-xs mb-4" style={{ color: 'var(--text-lighter)' }}>
              {filter === 'all' && !search ? 'No blocked users yet' : 'No users match your filters'}
            </p>
            <button
              onClick={() => setShowBlockModal(true)}
              className="btn btn-sm gap-1.5 border-none text-white cursor-pointer"
              style={{ background: 'linear-gradient(var(--danger), var(--danger-dark))' }}
            >
              <Plus size={13} /> Block user
            </button>
          </div>
        )}

        {filtered.map((conv) => {
          const iBlocked = conv.blockedBy === me;
          return (
            <div
              key={conv.id}
              className="flex items-center gap-3 px-5 py-4 transition-colors"
              style={{ borderBottom: '1px solid var(--surface)', background: 'transparent' }}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-error to-error/70 flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 12 }}>
                {conv.other.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent)' }}>{conv.other.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-lighter)', whiteSpace: 'nowrap' }}>
                    {iBlocked ? `Blocked ${timeLabel(conv.createdAt)}` : `Blocked you ${timeLabel(conv.createdAt)}`}
                  </span>
                </div>
                <div className="truncate mt-0.5" style={{ fontSize: 11.5, color: 'var(--text-lighter)' }}>
                  {conv.other.email}
                </div>
                {conv.preview && (
                  <div className="flex items-center gap-1.5 mt-1" style={{ fontSize: 11.5, color: 'var(--text-lighter)' }}>
                    <MessageSquare size={11} />
                    <span className="truncate">{conv.preview}</span>
                  </div>
                )}
              </div>
              <span
                className="badge badge-sm gap-1 shrink-0"
                style={{ background: iBlocked ? 'rgba(248,113,113,0.15)' : 'rgba(251,191,36,0.15)', color: iBlocked ? '#dc2626' : '#d97706', border: 'none' }}
              >
                {iBlocked ? 'You blocked' : 'Blocked you'}
              </span>
              {iBlocked && (
                <button
                  onClick={() => unblock(conv)}
                  disabled={busyId === conv.id}
                  className="btn btn-ghost btn-sm gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                  style={{ color: 'var(--primary)', border: '1.5px solid var(--surface-border)' }}
                  title={`Unblock ${conv.other.name}`}
                >
                  {busyId === conv.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                  Unblock
                </button>
              )}
            </div>
          );
        })}
      </div>

      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--modal-bg)' }}>
          <div className="bg-base-100 w-full max-w-md" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Ban size={15} style={{ color: 'var(--danger)' }} /> Block user
              </div>
              <button onClick={() => { setShowBlockModal(false); setBlockSearch(''); }} className="btn btn-ghost btn-sm btn-circle" style={{ color: 'var(--text-light)' }}>✕</button>
            </div>

            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--divider)', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--surface-border)' }}>
                <Search size={14} style={{ color: 'var(--text-lighter)' }} />
                <input
                  type="text"
                  value={blockSearch}
                  onChange={(e) => setBlockSearch(e.target.value)}
                  placeholder="Search people to block..."
                  className="flex-1 bg-transparent outline-none"
                  style={{ fontSize: 13, color: 'var(--text)', border: 'none' }}
                />
              </div>
            </div>

            <div className="max-h-[320px] overflow-y-auto">
              {peopleLoading && !peopleError && (
                <div className="text-center py-10 text-xs" style={{ color: 'var(--text-lighter)' }}>Loading people...</div>
              )}
              {!peopleLoading && peopleError && (
                <div className="text-center py-10">
                  <div className="text-xs mb-3" style={{ color: 'var(--warning)' }}>Could not load people — {peopleError}</div>
                  <button onClick={peopleRefresh} className="btn btn-ghost btn-sm" style={{ color: 'var(--primary)' }}>Retry</button>
                </div>
              )}
              {!peopleLoading && !peopleError && blockable.length === 0 && (
                <div className="text-center py-10 text-xs" style={{ color: 'var(--text-lighter)' }}>No users found</div>
              )}
              {blockable.map((p) => {
                const isBlocked = alreadyBlocked(p.email);
                return (
                  <div key={p.email} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 11 }}>
                      {p.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{p.name}</div>
                      <div className="truncate" style={{ fontSize: 11, color: 'var(--text-lighter)' }}>{p.email}</div>
                    </div>
                    {isBlocked ? (
                      <span className="badge badge-sm gap-1 shrink-0" style={{ background: 'rgba(248,113,113,0.15)', color: '#dc2626', border: 'none' }}>
                        <Ban size={10} /> Blocked
                      </span>
                    ) : (
                      <button
                        onClick={() => blockUser(p)}
                        className="btn btn-xs btn-ghost gap-1 border-none shrink-0 cursor-pointer"
                        style={{ color: 'var(--danger)' }}
                        title={`Block ${p.name}`}
                      >
                        <UserX size={12} /> Block
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
