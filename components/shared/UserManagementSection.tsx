'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GraduationCap, Presentation, ShieldCheck, UserCog, Plus, Search, Power, Mail,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, type UserRecord, type StudentRecord, type StaffRecord, type MajorRecord, type OrganizationalUnitRecord } from './api';
import { useUniversityData } from './useUniversityData';

export type UserTarget = 'students' | 'lecturers' | 'student-affairs' | 'admins';

const TARGET_META: Record<UserTarget, { title: string; subtitle: string; icon: React.ReactNode; roleName: 'STUDENT' | 'STAFF' | 'SYSTEM_ADMIN' }> = {
  students: { title: 'Students', subtitle: 'Create and manage student accounts', icon: <GraduationCap size={16} />, roleName: 'STUDENT' },
  lecturers: { title: 'Lecturers', subtitle: 'Create and manage lecturer accounts', icon: <Presentation size={16} />, roleName: 'STAFF' },
  'student-affairs': { title: 'Student Affairs', subtitle: 'Create and manage student affairs staff accounts', icon: <ShieldCheck size={16} />, roleName: 'STAFF' },
  admins: { title: 'Administrators', subtitle: 'Create and manage system administrator accounts', icon: <UserCog size={16} />, roleName: 'SYSTEM_ADMIN' },
};

interface Row {
  userId: string;
  email: string;
  name: string;
  rollNo: string;
  staffNo: string;
  major: string;
  unit: string;
  roleName: string;
  isActive: boolean;
}

const PAGE_SIZE = 10;

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

export default function UserManagementSection({ target }: { target: UserTarget }) {
  const meta = TARGET_META[target];

  const { data, loading, refresh } = useUniversityData<{ users: UserRecord[]; students: StudentRecord[]; staff: StaffRecord[]; majors: MajorRecord[]; units: OrganizationalUnitRecord[] }>(
    useCallback(async () => {
      const [users, students, staff, majors, units] = await Promise.all([
        apiFetch<UserRecord[]>('/api/users'),
        apiFetch<StudentRecord[]>('/api/students'),
        apiFetch<StaffRecord[]>('/api/staff'),
        apiFetch<MajorRecord[]>('/api/majors'),
        apiFetch<OrganizationalUnitRecord[]>('/api/organizational-units'),
      ]);
      return { users, students, staff, majors, units };
    }, []),
    10000
  );

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [staffNo, setStaffNo] = useState('');
  const [majorId, setMajorId] = useState('');
  const [unitId, setUnitId] = useState('');

  const studentsByUser = useMemo(() => {
    const m = new Map<string, StudentRecord>();
    (data?.students ?? []).forEach((s) => m.set(s.userId, s));
    return m;
  }, [data?.students]);
  const staffByUser = useMemo(() => {
    const m = new Map<string, StaffRecord>();
    (data?.staff ?? []).forEach((s) => m.set(s.userId, s));
    return m;
  }, [data?.staff]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const u of data?.users ?? []) {
      if (u.roleName !== meta.roleName) continue;
      if (target === 'student-affairs' && u.roleName === 'STAFF') {
        const s = staffByUser.get(u.userId);
        if (s && !s.unitName.toLowerCase().includes('student affair')) continue;
      }
      if (target === 'lecturers' && u.roleName === 'STAFF') {
        const s = staffByUser.get(u.userId);
        if (s && s.unitName.toLowerCase().includes('student affair')) continue;
      }
      const student = studentsByUser.get(u.userId);
      const staffRec = staffByUser.get(u.userId);
      out.push({
        userId: u.userId,
        email: u.email,
        name: student?.studentName ?? staffRec?.staffName ?? u.email.split('@')[0],
        rollNo: student?.rollNo ?? '',
        staffNo: staffRec?.staffNo ?? '',
        major: student?.majorCode ?? '',
        unit: staffRec?.unitName ?? '',
        roleName: u.roleName,
        isActive: u.isActive,
      });
    }
    const q = search.toLowerCase();
    return out.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.rollNo.toLowerCase().includes(q) ||
        r.staffNo.toLowerCase().includes(q)
    );
  }, [data?.users, staffByUser, studentsByUser, meta.roleName, target, search]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const startRow = rows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(safePage * PAGE_SIZE, rows.length);

  const pageBtnStyle: React.CSSProperties = {
    minWidth: 32,
    height: 32,
    borderRadius: 8,
    border: '1.5px solid var(--surface-border)',
    background: 'transparent',
    color: 'var(--text-light)',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 6px',
    transition: 'all 0.15s',
  };

  const handleCreate = async () => {
    if (!email || !password || password.length < 8) {
      toast.error('Email and a password of at least 8 characters are required');
      return;
    }
    if (target !== 'admins' && !name) {
      toast.error('Full name is required');
      return;
    }
    if (target === 'students' && (!rollNo || !majorId)) {
      toast.error('Roll number and major are required');
      return;
    }
    if (target !== 'admins' && target !== 'students' && !staffNo) {
      toast.error('Staff number is required');
      return;
    }
    setCreating(true);
    try {
      const user = await apiFetch<UserRecord>('/api/users', {
        method: 'POST',
        body: JSON.stringify({ email, password, roleName: meta.roleName, isActive }),
      });
      if (target === 'students') {
        await apiFetch('/api/students', {
          method: 'POST',
          body: JSON.stringify({ userId: user.userId, majorId, rollNo, studentName: name, phoneNo: null, address: null, birthYear: null }),
        });
      } else if (target !== 'admins') {
        await apiFetch('/api/staff', {
          method: 'POST',
          body: JSON.stringify({ userId: user.userId, staffNo, staffName: name, unitId: unitId || null, phoneNo: null, address: null }),
        });
      }
      toast.success(`Account created for ${email}`);
      setShowCreate(false);
      setEmail('');
      setPassword('');
      setName('');
      setRollNo('');
      setStaffNo('');
      setMajorId('');
      setUnitId('');
      setPassword('');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create account');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (row: Row) => {
    try {
      await apiFetch(`/api/users/${row.userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      toast.success(row.isActive ? `${row.name} deactivated` : `${row.name} activated`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update account');
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
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>{meta.title}</h1>
          <p style={{ fontSize: 14, color: 'var(--text-light)' }}>{meta.subtitle}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '10px 18px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={14} /> Create User
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--divider)', padding: '9px 16px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--surface-border)', marginBottom: 18, maxWidth: 420 }}>
        <Search size={14} style={{ color: 'var(--text-lighter)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, roll no..."
          style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, width: '100%', color: 'var(--text)', fontWeight: 500 }}
        />
      </div>

      <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {loading && rows.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--text-lighter)' }}>Loading...</div>
        )}
        {!loading && rows.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--text-lighter)' }}>
            No {meta.title.toLowerCase()} found
          </div>
        )}
        {pageRows.map((row) => (
          <div key={row.userId} className="flex items-center gap-4 px-5 py-3.5" style={{ borderBottom: '1px solid var(--surface)' }}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold shrink-0 bg-gradient-to-br from-primary to-secondary"
              style={{ fontSize: 12 }}
            >
              {row.name.trim().split(/\s+/).slice(0, 2).map((w) => (w[0] || '')).join('').toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{row.name}</div>
              <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--text-lighter)' }}>
                <span className="flex items-center gap-1"><Mail size={11} /> {row.email}</span>
                {row.rollNo && <span>{row.rollNo}</span>}
                {row.staffNo && <span>{row.staffNo}</span>}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-lighter)' }}>
                {[row.major, row.unit].filter(Boolean).join(' \u2022 ') || row.roleName}
              </div>
            </div>
            <span
              className="badge badge-sm"
              style={{ background: row.isActive ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)', color: row.isActive ? '#16a34a' : '#dc2626', border: 'none' }}
            >
              {row.isActive ? 'Active' : 'Inactive'}
            </span>
            <button
              onClick={() => handleToggleActive(row)}
              className="btn btn-ghost btn-sm gap-1.5"
              style={{ color: 'var(--text-light)', border: '1.5px solid var(--surface-border)' }}
            >
              <Power size={13} /> {row.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        ))}

        {rows.length > PAGE_SIZE && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 18px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-lighter)' }}>
              Showing {startRow}–{endRow} of {rows.length}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <button
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                className="cursor-pointer border-none"
                style={{ ...pageBtnStyle, opacity: safePage <= 1 ? 0.4 : 1, cursor: safePage <= 1 ? 'default' : 'pointer' }}
                aria-label="Previous page"
              >
                <ChevronLeft size={15} />
              </button>
              {pageNumbers(totalPages, safePage).map((n, i) =>
                n === '…' ? (
                  <span key={`ellipsis-${i}`} style={{ minWidth: 24, textAlign: 'center', fontSize: 12.5, color: 'var(--text-lighter)' }}>…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className="cursor-pointer border-none"
                    style={{
                      ...pageBtnStyle,
                      background: n === safePage ? 'linear-gradient(var(--primary), var(--primary-dark))' : 'transparent',
                      color: n === safePage ? '#fff' : 'var(--text-light)',
                      borderColor: n === safePage ? 'var(--primary)' : 'var(--surface-border)',
                    }}
                  >
                    {n}
                  </button>
                )
              )}
              <button
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
                className="cursor-pointer border-none"
                style={{ ...pageBtnStyle, opacity: safePage >= totalPages ? 0.4 : 1, cursor: safePage >= totalPages ? 'default' : 'pointer' }}
                aria-label="Next page"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--modal-bg)' }}>
          <div className="bg-base-100 w-full max-w-md" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {meta.icon} Create {meta.title.replace(/s$/, '')} Account
              </div>
              <button onClick={() => setShowCreate(false)} className="btn btn-ghost btn-sm btn-circle" style={{ color: 'var(--text-light)' }}>✕</button>
            </div>
            <div className="grid grid-cols-1 gap-4 p-5">
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: 5 }}>Email</label>
                <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: 5 }}>Password (min 8 characters)</label>
                <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              {target !== 'admins' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: 5 }}>Full Name</label>
                  <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder={target === 'students' ? 'e.g. Aung Kaung Khant' : 'e.g. Daw Mya'} />
                </div>
              )}
              {target === 'students' && (
                <>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: 5 }}>Roll Number</label>
                    <input style={inputStyle} value={rollNo} onChange={(e) => setRollNo(e.target.value)} placeholder="e.g. UCS-1001" />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: 5 }}>Major</label>
                    <select style={inputStyle} value={majorId} onChange={(e) => setMajorId(e.target.value)}>
                      <option value="">Select major...</option>
                      {(data?.majors ?? []).map((m) => (
                        <option key={m.majorId} value={m.majorId}>{m.majorCode} — {m.majorName}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              {target !== 'admins' && target !== 'students' && (
                <>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: 5 }}>Staff Number</label>
                    <input style={inputStyle} value={staffNo} onChange={(e) => setStaffNo(e.target.value)} placeholder="e.g. STAFF-001" />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: 5 }}>Unit</label>
                    <select style={inputStyle} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                      <option value="">Select unit...</option>
                      {(data?.units ?? []).map((u) => (
                        <option key={u.unitId} value={u.unitId}>{u.unitCode} — {u.unitName}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-light)' }}>
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Active immediately
              </label>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--surface)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowCreate(false)}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--text-light)', border: '1.5px solid var(--surface-border)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="btn btn-sm gap-1.5 border-none text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
              >
                <Plus size={14} /> {creating ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}