'use client';

import { useCallback, useMemo, useState } from 'react';
import { Search, Mail, Phone, MapPin, CalendarDays, BadgeCheck, UserRound } from 'lucide-react';
import { apiFetch, type UserRecord, type StaffRecord, type OrganizationalUnitRecord } from './api';
import { useUniversityData } from './useUniversityData';

export type StaffTarget = 'lecturers' | 'student-affairs' | 'finance' | 'administrative-officers';

const TARGET_META: Record<StaffTarget, { title: string; subtitle: string; position: string }> = {
  lecturers: { title: 'Lecturers', subtitle: 'Academic staff members', position: 'LECTURER' },
  'student-affairs': { title: 'Student Affairs', subtitle: 'Student Affairs Office staff members', position: 'STUDENT_AFFAIRS_OFFICER' },
  finance: { title: 'Finance', subtitle: 'Finance Office staff members', position: 'FINANCE_OFFICER' },
  'administrative-officers': { title: 'Administrative', subtitle: 'Administration office staff members', position: 'ADMINISTRATIVE_OFFICER' },
};

const POSITION_LABELS: Record<string, string> = {
  LECTURER: 'Lecturer',
  STUDENT_AFFAIRS_OFFICER: 'Student Affairs Officer',
  FINANCE_OFFICER: 'Finance Officer',
  ADMINISTRATIVE_OFFICER: 'Administrative Officer',
  HOD: 'HOD — Head of Department',
  JUNIOR_CLERK: 'Junior Clerk',
  SENIOR_CLERK: 'Senior Clerk',
  RECTOR: 'Rector',
  PRO_RECTOR: 'Pro Rector',
};

const EMPTY_LABEL: Record<StaffTarget, string> = {
  lecturers: 'lecturers',
  'student-affairs': 'student affairs staff',
  finance: 'finance staff',
  'administrative-officers': 'administrative staff',
};

interface StaffInfo {
  userId: string;
  staffNo: string;
  name: string;
  email: string;
  phoneNo: string | null;
  batchYear: number | null;
  address: string | null;
  unitName: string;
  unitCode: string;
  unitType: string;
  positions: string[];
}

export default function AdministrativeSection({ target }: { target: StaffTarget }) {
  const meta = TARGET_META[target];

  const { data, loading, error } = useUniversityData<{ users: UserRecord[]; staff: StaffRecord[]; units: OrganizationalUnitRecord[] }>(
    useCallback(async () => {
      const [users, staff, units] = await Promise.all([
        apiFetch<UserRecord[]>('/api/users'),
        apiFetch<StaffRecord[]>('/api/staff'),
        apiFetch<OrganizationalUnitRecord[]>('/api/organizational-units'),
      ]);
      return { users, staff, units };
    }, []),
    10000
  );

  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const usersByUser = useMemo(() => {
    const m = new Map<string, UserRecord>();
    (data?.users ?? []).forEach((u) => m.set(u.userId, u));
    return m;
  }, [data?.users]);
  const unitsByUnit = useMemo(() => {
    const m = new Map<string, OrganizationalUnitRecord>();
    (data?.units ?? []).forEach((u) => m.set(u.unitId, u));
    return m;
  }, [data?.units]);

  const rows: StaffInfo[] = useMemo(() => {
    const out: StaffInfo[] = [];
    for (const s of data?.staff ?? []) {
      if (!(s.positions ?? []).some((p) => p.toUpperCase() === meta.position)) continue;
      const user = usersByUser.get(s.userId);
      const unit = unitsByUnit.get(s.unitId);
      out.push({
        userId: s.userId,
        staffNo: s.staffNo,
        name: s.staffName,
        email: user?.email ?? '',
        phoneNo: s.phoneNo,
        batchYear: s.batchYear,
        address: s.address,
        unitName: s.unitName,
        unitCode: unit?.unitCode ?? '',
        unitType: unit?.unitType ?? '',
        positions: s.positions,
      });
    }
    const q = search.toLowerCase();
    return out.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.staffNo.toLowerCase().includes(q)
    );
  }, [data?.staff, usersByUser, unitsByUnit, meta.position, search]);

  const selected = rows.find((r) => r.userId === selectedUserId) ?? null;

  const fieldStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--text-light)',
    marginBottom: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  };
  const valueStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--accent)',
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>{meta.title}</h1>
          <p style={{ fontSize: 14, color: 'var(--text-light)' }}>{meta.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--divider)', padding: '9px 16px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--surface-border)', marginBottom: 12 }}>
            <Search size={14} style={{ color: 'var(--text-lighter)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${meta.title.toLowerCase()}...`}
              style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, width: '100%', color: 'var(--text)', fontWeight: 500 }}
            />
          </div>

          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
            {loading && rows.length === 0 && (
              <div className="text-center py-12 text-sm" style={{ color: 'var(--text-lighter)' }}>Loading...</div>
            )}
            {!loading && rows.length === 0 && error && (
              <div className="text-center py-12 text-sm" style={{ color: 'var(--warning)' }}>
                Failed to load {EMPTY_LABEL[target]}
              </div>
            )}
            {!loading && rows.length === 0 && !error && (
              <div className="text-center py-12 text-sm" style={{ color: 'var(--text-lighter)' }}>
                No {EMPTY_LABEL[target]} found
              </div>
            )}
            {rows.map((row) => {
              const isSelected = selected?.userId === row.userId;
              return (
                <button
                  key={row.userId}
                  onClick={() => setSelectedUserId(row.userId)}
                  className="flex items-center gap-3 px-4 py-3 w-full text-left transition-colors cursor-pointer"
                  style={{
                    borderBottom: '1px solid var(--surface)',
                    border: 'none',
                    background: isSelected ? 'rgba(40,114,161,0.1)' : 'none',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold shrink-0 bg-gradient-to-br from-primary to-secondary"
                    style={{ fontSize: 12 }}
                  >
                    {row.name.trim().split(/\s+/).slice(0, 2).map((w) => (w[0] || '')).join('').toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: isSelected ? 'var(--primary)' : 'var(--accent)' }}>{row.name}</div>
                    <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-lighter)' }}>
                      {row.unitName}
                    </div>
                  </div>
                  {row.positions.length > 0 && (
                    <span className="badge badge-sm shrink-0" style={{ background: 'rgba(40,114,161,0.12)', color: 'var(--accent)', border: 'none' }}>
                      {POSITION_LABELS[row.positions[0]] ?? row.positions[0]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', minHeight: 420 }}>
            {!selected && (
              <div className="flex flex-col items-center justify-center text-center py-20 px-6">
                <UserRound size={40} style={{ color: 'var(--text-lighter)', opacity: 0.5 }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-light)', marginTop: 12 }}>
                  {loading ? 'Loading...' : `Select a ${meta.title.toLowerCase()} from the list`}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-lighter)', marginTop: 4 }}>
                  Click a staff member on the left to view their information
                </div>
              </div>
            )}
            {selected && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 22px', borderBottom: '1px solid var(--surface)' }}>
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br from-primary to-secondary shrink-0"
                    style={{ fontSize: 18 }}
                  >
                    {selected.name.trim().split(/\s+/).slice(0, 2).map((w) => (w[0] || '')).join('').toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>{selected.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 2 }}>{selected.staffNo}</div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selected.positions.map((p) => (
                        <span key={p} className="badge badge-sm" style={{ background: 'rgba(40,114,161,0.12)', color: 'var(--accent)', border: 'none' }}>
                          {POSITION_LABELS[p] ?? p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-6">
                  <div>
                    <div style={fieldStyle}><Mail size={13} /> Email</div>
                    <div style={valueStyle}>{selected.email || '—'}</div>
                  </div>
                  <div>
                    <div style={fieldStyle}><Phone size={13} /> Phone</div>
                    <div style={valueStyle}>{selected.phoneNo || '—'}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div style={fieldStyle}><BadgeCheck size={13} /> Department / Unit</div>
                    <div style={valueStyle}>{selected.unitName}</div>
                    {selected.unitCode && <div style={{ fontSize: 12, color: 'var(--text-lighter)', marginTop: 2 }}>{selected.unitCode} • {selected.unitType}</div>}
                  </div>
                  <div>
                    <div style={fieldStyle}><CalendarDays size={13} /> Batch Year</div>
                    <div style={valueStyle}>{selected.batchYear ?? '—'}</div>
                  </div>
                  <div>
                    <div style={fieldStyle}><MapPin size={13} /> Address</div>
                    <div style={valueStyle}>{selected.address || '—'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}