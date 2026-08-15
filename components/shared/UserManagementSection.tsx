'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GraduationCap, Presentation, ShieldCheck, UserCog, Coins, Landmark, Plus, Search, Power, Mail, Pencil, Trash2, Upload, CheckSquare, CircleCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  apiFetch, updateUser, deleteUser, bulkDeleteUsers, importUsersExcel,
  type UserRecord, type StudentRecord, type StaffRecord, type MajorRecord, type OrganizationalUnitRecord,
  type SemesterRecord, type SectionRecord, type AcademicTermRecord, type ImportResult,
} from './api';
import { useUniversityData } from './useUniversityData';

export type UserTarget = 'students' | 'lecturers' | 'student-affairs' | 'finance' | 'administrative-officers' | 'admins';

const TARGET_META: Record<UserTarget, { title: string; subtitle: string; icon: React.ReactNode; roleName: 'STUDENT' | 'STAFF' | 'SYSTEM_ADMIN' }> = {
  students: { title: 'Students', subtitle: 'Create, edit and manage student accounts', icon: <GraduationCap size={16} />, roleName: 'STUDENT' },
  lecturers: { title: 'Lecturers', subtitle: 'Create, edit and manage lecturer accounts', icon: <Presentation size={16} />, roleName: 'STAFF' },
  'student-affairs': { title: 'Student Affairs', subtitle: 'Create, edit and manage student affairs staff accounts', icon: <ShieldCheck size={16} />, roleName: 'STAFF' },
  finance: { title: 'Finance', subtitle: 'Create, edit and manage finance officer accounts', icon: <Coins size={16} />, roleName: 'STAFF' },
  'administrative-officers': { title: 'Administrative Officers', subtitle: 'Create, edit and manage administrative officer accounts', icon: <Landmark size={16} />, roleName: 'STAFF' },
  admins: { title: 'Administrators', subtitle: 'Create and manage system administrator accounts', icon: <UserCog size={16} />, roleName: 'SYSTEM_ADMIN' },
};

const ADD_LABEL: Record<UserTarget, string> = {
  students: 'Student',
  lecturers: 'Lecturer',
  'student-affairs': 'Student Affairs Officer',
  finance: 'Finance Officer',
  'administrative-officers': 'Administrative Officer',
  admins: 'Admin',
};

const NAME_LABEL: Record<UserTarget, string> = {
  students: 'Student Name',
  lecturers: 'Lecturer Name',
  'student-affairs': 'Staff Name',
  finance: 'Staff Name',
  'administrative-officers': 'Staff Name',
  admins: 'Name',
};

const DEFAULT_POSITION: Partial<Record<UserTarget, string>> = {
  lecturers: 'LECTURER',
  'student-affairs': 'STUDENT_AFFAIRS_OFFICER',
  finance: 'FINANCE_OFFICER',
  'administrative-officers': 'ADMINISTRATIVE_OFFICER',
};

const ADDITIONAL_POSITIONS: Partial<Record<UserTarget, string[]>> = {
  lecturers: ['HOD'],
  'student-affairs': ['HOD', 'JUNIOR_CLERK', 'SENIOR_CLERK'],
  finance: ['HOD', 'JUNIOR_CLERK', 'SENIOR_CLERK'],
  'administrative-officers': ['HOD', 'JUNIOR_CLERK', 'SENIOR_CLERK', 'RECTOR', 'PRO_RECTOR'],
};

const POSITION_FILTER: Partial<Record<UserTarget, string>> = {
  lecturers: 'LECTURER',
  'student-affairs': 'STUDENT_AFFAIRS_OFFICER',
  finance: 'FINANCE_OFFICER',
  'administrative-officers': 'ADMINISTRATIVE_OFFICER',
};

const EMPTY_LABEL: Record<UserTarget, string> = {
  students: 'students',
  lecturers: 'lecturers',
  'student-affairs': 'student affairs officers',
  finance: 'finance officers',
  'administrative-officers': 'administrative officers',
  admins: 'admins',
};

const POSITION_LABELS: Record<string, string> = {
  HOD: 'HOD — Head of Department',
  JUNIOR_CLERK: 'Junior Clerk',
  SENIOR_CLERK: 'Senior Clerk',
  RECTOR: 'Rector',
  PRO_RECTOR: 'Pro Rector',
};

const DEFAULT_ADMIN_UNIT_CODE: Partial<Record<UserTarget, string>> = {
  'student-affairs': 'STUDENT_AFFAIRS',
  finance: 'FINANCE',
  'administrative-officers': 'ADMIN',
};

const PAGE_SIZE = 10;

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  background: 'rgba(2, 6, 23, 0.55)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
};

interface Row {
  userId: string;
  email: string;
  name: string;
  rollNo: string;
  staffNo: string;
  major: string;
  unit: string;
  phoneNo: string | null;
  positions: string[];
  semester: number | null;
  section: string | null;
  lastLogin: string | null;
  roleName: string;
  isActive: boolean;
}

interface EditFields {
  email: string;
  isActive: boolean;
  name: string;
  rollNo: string;
  staffNo: string;
  majorId: string;
  unitId: string;
  semesterId: string;
  sectionId: string;
  termId: string;
  phoneNo: string;
  batchYear: string;
  address: string;
  joinedAt: string;
  positions: string[];
}

export default function UserManagementSection({ target }: { target: UserTarget }) {
  const meta = TARGET_META[target];

  const { data, loading, refresh, mutate, error } = useUniversityData<{ users: UserRecord[]; students: StudentRecord[]; staff: StaffRecord[]; majors: MajorRecord[]; units: OrganizationalUnitRecord[]; semesters: SemesterRecord[]; sections: SectionRecord[]; terms: AcademicTermRecord[] }>(
    useCallback(async () => {
      const [users, students, staff, majors, units, semesters, sections, terms] = await Promise.all([
        apiFetch<UserRecord[]>('/api/users'),
        apiFetch<StudentRecord[]>('/api/students'),
        apiFetch<StaffRecord[]>('/api/staff'),
        apiFetch<MajorRecord[]>('/api/majors'),
        apiFetch<OrganizationalUnitRecord[]>('/api/organizational-units'),
        apiFetch<SemesterRecord[]>('/api/semesters'),
        apiFetch<SectionRecord[]>('/api/sections'),
        apiFetch<AcademicTermRecord[]>('/api/terms'),
      ]);
      return { users, students, staff, majors, units, semesters, sections, terms };
    }, []),
    10000
  );

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<{ heading: string; line: string; sub?: string; caption: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'one'; row: Row } | { kind: 'bulk'; ids: string[] } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [majorId, setMajorId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [phoneNo, setPhoneNo] = useState('');
  const [batchYear, setBatchYear] = useState('');
  const [address, setAddress] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [termId, setTermId] = useState('');
  const [joinedAt, setJoinedAt] = useState('');
  const [hod, setHod] = useState(false);
  const [additionalPosition, setAdditionalPosition] = useState('');

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

  const staffPosition = POSITION_FILTER[target];

  const availableUnits = useMemo(() => {
    const units = data?.units ?? [];
    if (target === 'lecturers') return units.filter((u) => u.unitType?.toUpperCase() === 'ACADEMIC');
    if (target === 'student-affairs' || target === 'finance' || target === 'administrative-officers') {
      return units.filter((u) => u.unitType?.toUpperCase() === 'ADMINISTRATIVE');
    }
    return units;
  }, [data?.units, target]);

  const defaultUnitId = useMemo(() => {
    const code = DEFAULT_ADMIN_UNIT_CODE[target];
    if (!code) return '';
    return (data?.units ?? []).find((u) => u.unitCode?.toUpperCase() === code)?.unitId ?? '';
  }, [data?.units, target]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const u of data?.users ?? []) {
      if (u.roleName !== meta.roleName) continue;
      const student = studentsByUser.get(u.userId);
      const staffRec = staffByUser.get(u.userId);
      if (target !== 'admins' && target !== 'students') {
        if (!staffRec) continue;
        if (!(staffRec.positions ?? []).some((p) => p.toUpperCase() === staffPosition)) continue;
      }
      out.push({
        userId: u.userId,
        email: u.email,
        name: student?.studentName ?? staffRec?.staffName ?? u.email.split('@')[0],
        rollNo: student?.rollNo ?? '',
        staffNo: staffRec?.staffNo ?? '',
        major: student?.majorCode ?? '',
        unit: staffRec?.unitName ?? '',
        phoneNo: student?.phoneNo ?? staffRec?.phoneNo ?? null,
        positions: staffRec?.positions ?? [],
        semester: student?.semesterNo ?? null,
        section: student?.sectionName ?? null,
        lastLogin: u.lastLogin,
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
  }, [data?.users, staffByUser, studentsByUser, meta.roleName, staffPosition, target, search]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, totalPages - 1);
  const pagedRows = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const allSelected = pagedRows.length > 0 && pagedRows.every((r) => selected.has(r.userId));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (pagedRows.every((r) => next.has(r.userId))) {
        pagedRows.forEach((r) => next.delete(r.userId));
      } else {
        pagedRows.forEach((r) => next.add(r.userId));
      }
      return next;
    });
  };
  const toggleOne = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const resetCreateForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setRollNo('');
    setMajorId('');
    setUnitId('');
    setPhoneNo('');
    setBatchYear('');
    setAddress('');
    setSemesterId('');
    setSectionId('');
    setTermId('');
    setJoinedAt('');
    setHod(false);
    setAdditionalPosition('');
    setIsActive(true);
  };

  const handleCreate = async () => {
    if (!email || !password || password.length < 8) {
      toast.error('Email and a password of at least 8 characters are required');
      return;
    }
    if (target !== 'admins' && !name) {
      toast.error(`${NAME_LABEL[target]} is required`);
      return;
    }
    if (target === 'students' && (!rollNo || !majorId)) {
      toast.error('Roll number and major are required');
      return;
    }
    if (target !== 'admins' && target !== 'students' && !(unitId || defaultUnitId)) {
      toast.error('Department/unit is required');
      return;
    }
    setCreating(true);
    try {
      const base = { email, password, isActive };
      const chosenUnitId = unitId || defaultUnitId;
      if (target === 'students') {
        const created = await apiFetch<StudentRecord>('/api/students/register', {
          method: 'POST',
          body: JSON.stringify({
            ...base,
            studentName: name,
            rollNo,
            majorId,
            semesterId: semesterId || null,
            sectionId: sectionId || null,
            termId: termId || null,
            phoneNo: phoneNo || null,
            batchYear: batchYear ? Number(batchYear) : null,
            address: address || null,
          }),
        });
        mutate((prev) =>
          prev
            ? {
                ...prev,
                users: [
                  ...prev.users,
                  { userId: created.userId, email: created.email, roleName: 'STUDENT', isActive, registrationStatus: 'APPROVED', lastLogin: null, createdAt: null },
                ],
                students: [...prev.students, created],
              }
            : prev
        );
      } else if (target === 'admins') {
        const created = await apiFetch<UserRecord>('/api/users', {
          method: 'POST',
          body: JSON.stringify({ ...base, roleName: 'SYSTEM_ADMIN' }),
        });
        mutate((prev) => (prev ? { ...prev, users: [...prev.users, created] } : prev));
      } else {
        const positions = [DEFAULT_POSITION[target]!];
        if (target === 'lecturers') {
          if (hod) positions.push('HOD');
        } else if (additionalPosition) {
          positions.push(additionalPosition);
        }
        const created = await apiFetch<StaffRecord>('/api/staff/register', {
          method: 'POST',
          body: JSON.stringify({
            ...base,
            staffName: name,
            unitId: chosenUnitId,
            phoneNo: phoneNo || null,
            batchYear: batchYear ? Number(batchYear) : null,
            address: address || null,
            joinedAt: joinedAt || null,
            positionNames: positions,
          }),
        });
        mutate((prev) =>
          prev
            ? {
                ...prev,
                users: [
                  ...prev.users,
                  { userId: created.userId, email, roleName: 'STAFF', isActive, registrationStatus: 'APPROVED', lastLogin: null, createdAt: null },
                ],
                staff: [...prev.staff, created],
              }
            : prev
        );
      }
      setSuccessMessage({
        heading: `${ADD_LABEL[target]} Created Successfully`,
        line: name || email,
        sub: name ? email : undefined,
        caption: 'The account is active and ready to sign in.',
      });
      setShowCreate(false);
      resetCreateForm();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create account');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (row: Row) => {
    try {
      const updated = await apiFetch<UserRecord>(`/api/users/${row.userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      toast.success(row.isActive ? `${row.name} deactivated` : `${row.name} activated`);
      mutate((prev) => (prev ? { ...prev, users: prev.users.map((u) => (u.userId === updated.userId ? updated : u)) } : prev));
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update account');
    }
  };

  const handleDeleteOne = (row: Row) => setConfirmDelete({ kind: 'one', row });

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    setConfirmDelete({ kind: 'bulk', ids: Array.from(selected) });
  };

  const performDelete = async () => {
    const pending = confirmDelete;
    if (!pending) return;
    setConfirmDelete(null);
    try {
      if (pending.kind === 'one') {
        await deleteUser(pending.row.userId);
        toast.success(`${pending.row.name} deleted`);
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(pending.row.userId);
          return next;
        });
        mutate((prev) => (prev ? { ...prev, users: prev.users.filter((u) => u.userId !== pending.row.userId) } : prev));
      } else {
        await bulkDeleteUsers(pending.ids);
        toast.success(`Deleted ${pending.ids.length} account(s)`);
        setSelected(new Set());
        const idSet = new Set(pending.ids);
        mutate((prev) => (prev ? { ...prev, users: prev.users.filter((u) => !idSet.has(u.userId)) } : prev));
      }
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete account');
    }
  };

  const stageFile = (file: File | undefined | null) => {
    if (!file) return;
    setStagedFile(file);
  };

  const handleUploadImport = async () => {
    if (!stagedFile) return;
    setImporting(true);
    try {
      const result = await importUsersExcel(target, stagedFile);
      setShowImport(false);
      setStagedFile(null);
      if (result.created === 0 && result.errors.length === 0) {
        setImportReport(null);
        toast.error('No rows were found in the file');
      } else if (result.errors.length === 0) {
        setImportReport(null);
        setSuccessMessage({
          heading: 'Import Successful',
          line: `${result.created} ${EMPTY_LABEL[target]} created`,
          caption: 'All rows were imported successfully.',
        });
      } else {
        setImportReport(result);
      }
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const openEdit = (row: Row) => setEditingRow(row);
  const closeEdit = () => {
    if (savingEdit) return;
    setEditingRow(null);
  };

  const handleSaveEdit = async (fields: EditFields) => {
    const row = editingRow;
    if (!row) return;
    setSavingEdit(true);
    try {
      const student = studentsByUser.get(row.userId);
      const staffRec = staffByUser.get(row.userId);
      let newStudent: StudentRecord | undefined;
      let newStaff: StaffRecord | undefined;
      let newUser: UserRecord | undefined;
      if (target === 'students') {
        newStudent = await apiFetch<StudentRecord>(`/api/students/${student?.studentId}`, {
          method: 'PUT',
          body: JSON.stringify({
            userId: row.userId,
            majorId: fields.majorId,
            semesterId: fields.semesterId || null,
            sectionId: fields.sectionId || null,
            termId: fields.termId || null,
            rollNo: fields.rollNo,
            studentName: fields.name,
            phoneNo: fields.phoneNo || null,
            address: fields.address || null,
            batchYear: fields.batchYear ? Number(fields.batchYear) : null,
          }),
        });
      } else if (target !== 'admins') {
        newStaff = await apiFetch<StaffRecord>(`/api/staff/${staffRec?.staffId}`, {
          method: 'PUT',
          body: JSON.stringify({
            userId: row.userId,
            staffNo: fields.staffNo,
            staffName: fields.name,
            phoneNo: fields.phoneNo || null,
            batchYear: fields.batchYear ? Number(fields.batchYear) : null,
            address: fields.address || null,
            unitId: fields.unitId,
            joinedAt: fields.joinedAt || null,
            leftDate: staffRec?.leftDate ?? null,
            positionNames: fields.positions,
          }),
        });
      }
      if (fields.email !== row.email || fields.isActive !== row.isActive) {
        newUser = await updateUser(row.userId, { email: fields.email, isActive: fields.isActive });
      }
      mutate((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          users: newUser ? prev.users.map((u) => (u.userId === newUser!.userId ? newUser! : u)) : prev.users,
          students: newStudent ? prev.students.map((s) => (s.studentId === newStudent!.studentId ? newStudent! : s)) : prev.students,
          staff: newStaff ? prev.staff.map((s) => (s.staffId === newStaff!.staffId ? newStaff! : s)) : prev.staff,
        };
      });
      toast.success(`${row.name} updated`);
      setEditingRow(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update account');
    } finally {
      setSavingEdit(false);
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

  const iconBtn: React.CSSProperties = {
    color: 'var(--text-light)',
    border: '1.5px solid var(--surface-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '7px 9px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    background: 'transparent',
  };

  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: 5 };

  useEffect(() => {
    const open = Boolean(showCreate || editingRow || confirmDelete || showImport || successMessage);
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showCreate, editingRow, confirmDelete, showImport, successMessage]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>{meta.title}</h1>
          <p style={{ fontSize: 14, color: 'var(--text-light)' }}>{meta.subtitle}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setSelectMode((v) => !v);
              setSelected(new Set());
            }}
            className="btn btn-sm gap-1.5"
            style={{
              color: selectMode ? 'var(--primary)' : 'var(--text-light)',
              border: '1.5px solid var(--surface-border)',
              background: selectMode ? 'rgba(40,114,161,0.1)' : 'transparent',
            }}
            title="Select multiple rows to delete at once"
          >
            <CheckSquare size={14} /> {selectMode ? 'Done Selecting' : 'Select Multiple'}
          </button>
          {target !== 'admins' && (
            <button
              onClick={() => setShowImport(true)}
              disabled={importing}
              className="btn btn-sm gap-1.5 disabled:opacity-40"
              style={{ color: 'var(--accent)', border: '1.5px solid var(--surface-border)', background: 'transparent' }}
            >
              <Upload size={14} /> Import Excel
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '10px 18px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} /> Add New {ADD_LABEL[target]}
          </button>
        </div>
      </div>

      {importReport && (
        <div style={{ marginBottom: 18, borderRadius: 'var(--radius-md)', border: '1.5px solid var(--surface-border)', background: 'var(--divider)', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              Import complete — {importReport.created} created, {importReport.errors.length} failed
            </span>
            <button onClick={() => setImportReport(null)} className="btn btn-ghost btn-sm btn-circle" style={{ color: 'var(--text-light)' }}>✕</button>
          </div>
          {importReport.errors.length > 0 && (
            <ul style={{ marginTop: 8, maxHeight: 160, overflowY: 'auto', fontSize: 12.5, color: 'var(--warning)' }}>
              {importReport.errors.slice(0, 20).map((e, i) => (
                <li key={i} style={{ marginBottom: 3 }}>Row {e.row}: {e.message}</li>
              ))}
              {importReport.errors.length > 20 && <li>...and {importReport.errors.length - 20} more</li>}
            </ul>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--divider)', padding: '9px 16px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--surface-border)', marginBottom: 18, maxWidth: 420 }}>
        <Search size={14} style={{ color: 'var(--text-lighter)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Search by name, email, roll no..."
          style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, width: '100%', color: 'var(--text)', fontWeight: 500 }}
        />
      </div>

      {selectMode && selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 mb-3" style={{ borderRadius: 'var(--radius-md)', background: 'rgba(40,114,161,0.1)', border: '1px solid rgba(40,114,161,0.25)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{selected.size} selected</span>
          <button
            onClick={handleBulkDelete}
            className="btn btn-sm gap-1.5"
            style={{ color: '#dc2626', border: '1.5px solid #dc2626', background: 'transparent' }}
          >
            <Trash2 size={13} /> Delete Selected
          </button>
          <button
            onClick={() => {
              setSelectMode(false);
              setSelected(new Set());
            }}
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--text-light)' }}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="bg-base-100 backdrop-blur-xl" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
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
        {rows.length > 0 && selectMode && (
          <div className="flex items-center gap-3 px-5 py-2" style={{ borderBottom: '1px solid var(--surface)' }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            <span className="text-xs" style={{ color: 'var(--text-lighter)' }}>{rows.length} record(s) on this page</span>
          </div>
        )}
        {pagedRows.map((row) => (
          <div key={row.userId} className="flex items-center gap-4 px-5 py-3.5" style={{ borderBottom: '1px solid var(--surface)' }}>
            {selectMode && <input type="checkbox" checked={selected.has(row.userId)} onChange={() => toggleOne(row.userId)} />}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold shrink-0 bg-gradient-to-br from-primary to-secondary"
              style={{ fontSize: 12 }}
            >
              {row.name.trim().split(/\s+/).slice(0, 2).map((w) => (w[0] || '')).join('').toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{row.name}</div>
              <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-lighter)' }}>
                <span className="flex items-center gap-1"><Mail size={11} /> {row.email}</span>
                {target === 'students' && row.rollNo && <span>{row.rollNo}</span>}
              </div>
              {(target === 'students' || target === 'admins') && (
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-lighter)' }}>
                  {target === 'students'
                    ? [row.major, row.semester ? `Semester ${row.semester}` : null, row.section].filter(Boolean).join(' \u2022 ') || row.roleName
                    : 'System Admin'}
                </div>
              )}
              {target !== 'students' && target !== 'admins' && row.positions.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {row.positions.map((p) => (
                    <span key={p} className="badge badge-sm" style={{ background: 'rgba(40,114,161,0.12)', color: 'var(--accent)', border: 'none' }}>
                      {POSITION_LABELS[p] ?? p}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <span
              className="badge badge-sm"
              style={{ background: row.isActive ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)', color: row.isActive ? '#16a34a' : '#dc2626', border: 'none' }}
            >
              {row.isActive ? 'Active' : 'Inactive'}
            </span>
            <button
              onClick={() => openEdit(row)}
              className="btn btn-ghost btn-sm gap-1.5"
              style={iconBtn}
              title="Edit account"
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              onClick={() => handleToggleActive(row)}
              className="btn btn-ghost btn-sm gap-1.5"
              style={{ color: 'var(--text-light)', border: '1.5px solid var(--surface-border)' }}
            >
              <Power size={13} /> {row.isActive ? 'Deactivate' : 'Activate'}
            </button>
            <button
              onClick={() => handleDeleteOne(row)}
              className="btn btn-ghost btn-sm gap-1.5"
              style={{ color: '#dc2626', border: '1.5px solid #dc2626' }}
              title="Delete account"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        ))}
        {rows.length > 0 && (
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderTop: '1px solid var(--surface)', fontSize: 12.5, color: 'var(--text-light)' }}
          >
            <span>
              {rows.length} {rows.length === 1 ? 'row' : 'rows'} • Page {current + 1} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={current === 0}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1.5px solid var(--surface-border)',
                  background: 'transparent',
                  color: current === 0 ? 'var(--text-lighter)' : 'var(--primary)',
                  cursor: current === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={current === totalPages - 1}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1.5px solid var(--surface-border)',
                  background: 'transparent',
                  color: current === totalPages - 1 ? 'var(--text-lighter)' : 'var(--primary)',
                  cursor: current === totalPages - 1 ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <div style={overlayStyle}>
          <div className="bg-base-100 w-full max-w-md" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', maxHeight: '92vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {meta.icon} Add New {ADD_LABEL[target]}
              </div>
              <button onClick={() => setShowCreate(false)} className="btn btn-ghost btn-sm btn-circle" style={{ color: 'var(--text-light)' }}>✕</button>
            </div>
            <div className="grid grid-cols-1 gap-4 p-5 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 120px)' }}>
              {target !== 'admins' && (
                <div style={{ background: 'rgba(40,114,161,0.08)', border: '1px dashed rgba(40,114,161,0.35)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: 12, color: 'var(--text-light)' }}>
                  Want to add many {EMPTY_LABEL[target]} at once? Use the{' '}
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Import Excel</span> button below to upload a
                  spreadsheet.
                </div>
              )}
              <div>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
              </div>
              <div>
                <label style={labelStyle}>Password (min 8 characters)</label>
                <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              {target !== 'admins' && (
                <div>
                  <label style={labelStyle}>{NAME_LABEL[target]}</label>
                  <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder={target === 'students' ? 'e.g. Aung Kaung Khant' : 'e.g. Daw Mya'} />
                </div>
              )}
              {target === 'students' && (
                <>
                  <div>
                    <label style={labelStyle}>Roll Number</label>
                    <input style={inputStyle} value={rollNo} onChange={(e) => setRollNo(e.target.value)} placeholder="e.g. UCS-1001" />
                  </div>
                  <div>
                    <label style={labelStyle}>Major</label>
                    <select style={inputStyle} value={majorId} onChange={(e) => setMajorId(e.target.value)}>
                      <option value="">Select major...</option>
                      {(data?.majors ?? []).map((m) => (
                        <option key={m.majorId} value={m.majorId}>{m.majorCode} — {m.majorName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Semester</label>
                    <select style={inputStyle} value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
                      <option value="">Select semester...</option>
                      {(data?.semesters ?? []).map((s) => (
                        <option key={s.semesterId} value={s.semesterId}>Semester {s.semesterNo}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Section</label>
                    <select style={inputStyle} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                      <option value="">Select section...</option>
                      {(data?.sections ?? []).map((s) => (
                        <option key={s.sectionId} value={s.sectionId}>{s.sectionName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Academic Term</label>
                    <select style={inputStyle} value={termId} onChange={(e) => setTermId(e.target.value)}>
                      <option value="">Select term...</option>
                      {(data?.terms ?? []).map((t) => (
                        <option key={t.termId} value={t.termId}>{t.academicYear} — {t.status}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Phone Number</label>
                    <input style={inputStyle} value={phoneNo} onChange={(e) => setPhoneNo(e.target.value)} placeholder="e.g. 09-7777777" />
                  </div>
                  <div>
                    <label style={labelStyle}>Batch Year</label>
                    <input style={inputStyle} type="number" value={batchYear} onChange={(e) => setBatchYear(e.target.value)} placeholder="e.g. 2004" />
                  </div>
                  <div>
                    <label style={labelStyle}>Address</label>
                    <input style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. Yangon" />
                  </div>
                </>
              )}
              {target !== 'admins' && target !== 'students' && (
                <>
                  <div>
                    <label style={labelStyle}>Department / Unit</label>
                    <select style={inputStyle} value={unitId || defaultUnitId} onChange={(e) => setUnitId(e.target.value)}>
                      <option value="">Select unit...</option>
                      {availableUnits.map((u) => (
                        <option key={u.unitId} value={u.unitId}>{u.unitCode} — {u.unitName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Batch Year</label>
                    <input style={inputStyle} type="number" value={batchYear} onChange={(e) => setBatchYear(e.target.value)} placeholder="e.g. 2019" />
                  </div>
                  <div>
                    <label style={labelStyle}>Joined At</label>
                    <input style={inputStyle} type="date" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone Number</label>
                    <input style={inputStyle} value={phoneNo} onChange={(e) => setPhoneNo(e.target.value)} placeholder="e.g. 09-7777777" />
                  </div>
                  <div>
                    <label style={labelStyle}>Address</label>
                    <input style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. Yangon" />
                  </div>
                </>
              )}
              {target === 'lecturers' && (
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-light)' }}>
                  <input type="checkbox" checked={hod} onChange={(e) => setHod(e.target.checked)} />
                  HOD — also assign Head of Department position
                </label>
              )}
              {target !== 'admins' && target !== 'students' && target !== 'lecturers' && (
                <div>
                  <label style={labelStyle}>Additional Position (optional)</label>
                  <select style={inputStyle} value={additionalPosition} onChange={(e) => setAdditionalPosition(e.target.value)}>
                    <option value="">None</option>
                    {(ADDITIONAL_POSITIONS[target] ?? []).map((p) => (
                      <option key={p} value={p}>{POSITION_LABELS[p] ?? p}</option>
                    ))}
                  </select>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-light)' }}>
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Active immediately
              </label>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--surface)', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <div className="flex items-center gap-2">
                {target !== 'admins' && (
                  <button
                    onClick={() => {
                      setShowCreate(false);
                      setShowImport(true);
                    }}
                    className="btn btn-ghost btn-sm gap-1.5"
                    style={{ color: 'var(--accent)', border: '1.5px solid var(--surface-border)' }}
                  >
                    <Upload size={14} /> Import Excel
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
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
        </div>
      )}

      {showImport && (
        <div style={overlayStyle}>
          <div className="bg-base-100 w-full max-w-md" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Upload size={15} /> Import {EMPTY_LABEL[target]} from Excel
              </div>
              <button onClick={() => { setShowImport(false); setStagedFile(null); }} className="btn btn-ghost btn-sm btn-circle" style={{ color: 'var(--text-light)' }}>✕</button>
            </div>
            <div className="p-5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  stageFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); stageFile(e.dataTransfer.files?.[0]); }}
                style={{
                  border: `1.5px dashed ${dragOver ? 'var(--primary)' : 'var(--surface-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  background: dragOver ? 'rgba(40,114,161,0.08)' : 'var(--divider)',
                  padding: '28px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                {stagedFile ? (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all' }}>{stagedFile.name}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-lighter)' }}>
                      {(stagedFile.size / 1024).toFixed(1)} KB — click to replace
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload size={22} style={{ color: 'var(--text-lighter)' }} />
                    <div className="text-sm mt-2" style={{ color: 'var(--text-light)' }}>Drag &amp; drop your Excel file here</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-lighter)' }}>or click to browse (.xlsx, .xls)</div>
                  </>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 mt-5">
                <button
                  onClick={() => { setShowImport(false); setStagedFile(null); }}
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--text-light)', border: '1.5px solid var(--surface-border)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadImport}
                  disabled={!stagedFile || importing}
                  className="btn btn-sm gap-1.5 border-none text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
                >
                  <Upload size={14} /> {importing ? 'Importing...' : 'Upload & Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={overlayStyle}>
          <div className="bg-base-100 w-full max-w-sm" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trash2 size={15} /> Delete {confirmDelete.kind === 'one' ? 'Account' : 'Selected Accounts'}
              </div>
              <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost btn-sm btn-circle" style={{ color: 'var(--text-light)' }}>✕</button>
            </div>
            <div className="p-5">
              <p className="text-sm" style={{ color: 'var(--text)' }}>
                {confirmDelete.kind === 'one'
                  ? `Delete ${confirmDelete.row.name}'s account permanently? This cannot be undone.`
                  : `Delete ${confirmDelete.ids.length} selected account(s) permanently? This cannot be undone.`}
              </p>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost btn-sm" style={{ color: 'var(--text-light)', border: '1.5px solid var(--surface-border)' }}>
                  Cancel
                </button>
                <button onClick={performDelete} className="btn btn-sm gap-1.5 border-none text-white" style={{ background: '#dc2626' }}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div style={overlayStyle}>
          <div className="bg-base-100 w-full max-w-sm" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '28px 24px 22px' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(52,211,153,0.15)',
                  color: '#16a34a',
                  marginBottom: 14,
                }}
              >
                <CircleCheck size={30} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>{successMessage.heading}</div>
              <div style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 6, wordBreak: 'break-all' }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{successMessage.line}</span>
                {successMessage.sub && <span> · {successMessage.sub}</span>}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-lighter)', marginTop: 4 }}>{successMessage.caption}</div>
              <button
                onClick={() => setSuccessMessage(null)}
                className="btn btn-sm gap-1.5 border-none text-white"
                style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))', marginTop: 20, minWidth: 120 }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {editingRow && !showCreate && (
        <EditModal
          target={target}
          row={editingRow}
          studentsByUser={studentsByUser}
          staffByUser={staffByUser}
          majors={data?.majors ?? []}
          semesters={data?.semesters ?? []}
          sections={data?.sections ?? []}
          terms={data?.terms ?? []}
          availableUnits={availableUnits}
          saving={savingEdit}
          onSave={handleSaveEdit}
          onCancel={closeEdit}
        />
      )}
    </div>
  );
}

interface EditModalProps {
  target: UserTarget;
  row: Row;
  studentsByUser: Map<string, StudentRecord>;
  staffByUser: Map<string, StaffRecord>;
  majors: MajorRecord[];
  semesters: SemesterRecord[];
  sections: SectionRecord[];
  terms: AcademicTermRecord[];
  availableUnits: OrganizationalUnitRecord[];
  saving: boolean;
  onSave: (fields: EditFields) => void;
  onCancel: () => void;
}

function EditModal({ target, row, studentsByUser, staffByUser, majors, semesters, sections, terms, availableUnits, saving, onSave, onCancel }: EditModalProps) {
  const student = studentsByUser.get(row.userId);
  const staffRec = staffByUser.get(row.userId);
  const isStaffTarget = target !== 'students' && target !== 'admins';
  const defaultPosition = DEFAULT_POSITION[target];
  const allowedExtra = ADDITIONAL_POSITIONS[target] ?? [];

  const [email, setEmail] = useState(row.email);
  const [active, setActive] = useState(row.isActive);
  const [name, setName] = useState(row.name);
  const [rollNo, setRollNo] = useState(row.rollNo);
  const [staffNo, setStaffNo] = useState(row.staffNo);
  const [majorId, setMajorId] = useState(student?.majorId ?? '');
  const [unitId, setUnitId] = useState(staffRec?.unitId ?? '');
  const [semesterId, setSemesterId] = useState(student?.semesterId ?? '');
  const [sectionId, setSectionId] = useState(student?.sectionId ?? '');
  const [termId, setTermId] = useState(student?.termId ?? '');
  const [phoneNo, setPhoneNo] = useState(row.phoneNo ?? '');
  const [batchYear, setBatchYear] = useState(() => {
    const v = student?.batchYear ?? staffRec?.batchYear;
    return v == null ? '' : String(v);
  });
  const [address, setAddress] = useState(student?.address ?? staffRec?.address ?? '');
  const [joinedAt, setJoinedAt] = useState(staffRec?.joinedAt ? staffRec.joinedAt.slice(0, 10) : '');
  const [positions, setPositions] = useState<string[]>(row.positions.length > 0 ? row.positions : defaultPosition ? [defaultPosition] : []);

  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: 5 };
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

  const togglePosition = (p: string) => {
    setPositions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const handleSave = () => {
    if (target === 'students' || isStaffTarget) {
      if (!name) {
        toast.error(`${NAME_LABEL[target]} is required`);
        return;
      }
    }
    if (target === 'students' && !rollNo) {
      toast.error('Roll number is required');
      return;
    }
    if (target === 'students' && !majorId) {
      toast.error('Major is required');
      return;
    }
    if (isStaffTarget && !unitId) {
      toast.error('Department/unit is required');
      return;
    }
    const finalPositions =
      isStaffTarget && defaultPosition && !positions.includes(defaultPosition)
        ? [...positions, defaultPosition]
        : positions;
    onSave({
      email,
      isActive: active,
      name,
      rollNo,
      staffNo,
      majorId,
      unitId,
      semesterId,
      sectionId,
      termId,
      phoneNo,
      batchYear,
      address,
      joinedAt,
      positions: finalPositions,
    });
  };

  return (
    <div style={overlayStyle}>
      <div className="bg-base-100 w-full max-w-md" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', maxHeight: '92vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Pencil size={15} /> Edit {ADD_LABEL[target]}
          </div>
          <button onClick={onCancel} className="btn btn-ghost btn-sm btn-circle" style={{ color: 'var(--text-light)' }}>✕</button>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 120px)' }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {target === 'students' && (
            <>
              <div>
                <label style={labelStyle}>{NAME_LABEL[target]}</label>
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Roll Number</label>
                <input style={inputStyle} value={rollNo} onChange={(e) => setRollNo(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Major</label>
                <select style={inputStyle} value={majorId} onChange={(e) => setMajorId(e.target.value)}>
                  <option value="">Select major...</option>
                  {majors.map((m) => (
                    <option key={m.majorId} value={m.majorId}>{m.majorCode} — {m.majorName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Semester</label>
                <select style={inputStyle} value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
                  <option value="">Select semester...</option>
                  {semesters.map((s) => (
                    <option key={s.semesterId} value={s.semesterId}>Semester {s.semesterNo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Section</label>
                <select style={inputStyle} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                  <option value="">Select section...</option>
                  {sections.map((s) => (
                    <option key={s.sectionId} value={s.sectionId}>{s.sectionName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Academic Term</label>
                <select style={inputStyle} value={termId} onChange={(e) => setTermId(e.target.value)}>
                  <option value="">Select term...</option>
                  {terms.map((t) => (
                    <option key={t.termId} value={t.termId}>{t.academicYear} — {t.status}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          {isStaffTarget && (
            <>
              <div>
                <label style={labelStyle}>{NAME_LABEL[target]}</label>
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Staff No</label>
                <input style={inputStyle} value={staffNo} onChange={(e) => setStaffNo(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Department / Unit</label>
                <select style={inputStyle} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                  <option value="">Select unit...</option>
                  {availableUnits.map((u) => (
                    <option key={u.unitId} value={u.unitId}>{u.unitCode} — {u.unitName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Joined At</label>
                <input style={inputStyle} type="date" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} />
              </div>
              <div style={{ background: 'var(--divider)', borderRadius: 'var(--radius-md)', padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: 6 }}>Positions</div>
                {defaultPosition && (
                  <span className="badge badge-sm" style={{ background: 'rgba(40,114,161,0.12)', color: 'var(--accent)', border: 'none', marginRight: 4 }}>
                    {defaultPosition} (default)
                  </span>
                )}
                {allowedExtra.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-sm cursor-pointer mt-1.5" style={{ color: 'var(--text-light)' }}>
                    <input type="checkbox" checked={positions.includes(p)} onChange={() => togglePosition(p)} />
                    {POSITION_LABELS[p] ?? p}
                  </label>
                ))}
              </div>
            </>
          )}
          {target !== 'admins' && (
            <>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input style={inputStyle} value={phoneNo} onChange={(e) => setPhoneNo(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Batch Year</label>
                <input style={inputStyle} type="number" value={batchYear} onChange={(e) => setBatchYear(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Address</label>
                <input style={inputStyle} value={address ?? ''} onChange={(e) => setAddress(e.target.value)} />
              </div>
            </>
          )}
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-light)' }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Account active
          </label>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--surface)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} className="btn btn-ghost btn-sm" style={{ color: 'var(--text-light)', border: '1.5px solid var(--surface-border)' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-sm gap-1.5 border-none text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(var(--primary), var(--primary-dark))' }}
          >
            <CheckSquare size={14} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
