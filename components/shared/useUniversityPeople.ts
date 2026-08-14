'use client';

import { useCallback } from 'react';
import { apiFetch, type UserRecord, type StudentRecord, type StaffRecord } from './api';
import { useUniversityData } from './useUniversityData';

export interface UniversityPerson {
  email: string;
  name: string;
  role: string;
  initials: string;
  sub: string;
  year?: string;
  semester?: string;
  section?: string;
}

export interface UniversityRawData {
  users: UserRecord[];
  students: StudentRecord[];
  staff: StaffRecord[];
}

const CACHE_TTL_MS = 60_000;

let rawCache: { data: UniversityRawData; at: number } | null = null;
let rawInFlight: Promise<UniversityRawData> | null = null;

async function loadRaw(): Promise<UniversityRawData> {
  const [usersRes, studentsRes, staffRes] = await Promise.allSettled([
    apiFetch<UserRecord[]>('/api/users'),
    apiFetch<StudentRecord[]>('/api/students'),
    apiFetch<StaffRecord[]>('/api/staff'),
  ]);
  const users = usersRes.status === 'fulfilled' ? usersRes.value : [];
  const students = studentsRes.status === 'fulfilled' ? studentsRes.value : [];
  const staff = staffRes.status === 'fulfilled' ? staffRes.value : [];
  if (users.length === 0 && students.length === 0 && staff.length === 0) {
    throw new Error('No university data');
  }
  return { users, students, staff };
}

async function fetchRawData(): Promise<UniversityRawData> {
  if (rawCache && Date.now() - rawCache.at < CACHE_TTL_MS) return rawCache.data;
  if (rawInFlight) return rawInFlight;
  rawInFlight = (async () => {
    try {
      const data = await loadRaw();
      rawCache = { data, at: Date.now() };
      return data;
    } finally {
      rawInFlight = null;
    }
  })();
  return rawInFlight;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function buildPeople({ users, students, staff }: UniversityRawData): UniversityPerson[] {
  const studentByName = new Map<string, StudentRecord>();
  for (const s of students) studentByName.set(s.email.toLowerCase(), s);
  const staffByUser = new Map<string, StaffRecord>();
  for (const s of staff) staffByUser.set(s.userId, s);

  const people: UniversityPerson[] = [];
  for (const u of users) {
    if (!u.isActive) continue;
    const student = studentByName.get(u.email.toLowerCase());
    const staffRec = staffByUser.get(u.userId);
    const name = student?.studentName ?? staffRec?.staffName ?? u.email.split('@')[0];
    const role =
      u.roleName === 'STUDENT' ? 'Student' :
      u.roleName === 'SYSTEM_ADMIN' ? 'Admin' : 'Staff';
    const sub = student ? `${student.majorCode} \u2022 ${student.sectionName}` : staffRec ? staffRec.unitName : u.email;
    people.push({
      email: u.email,
      name,
      role,
      initials: initialsOf(name),
      sub,
      year: student ? String(student.academicYear ?? '') : undefined,
      semester: student && student.semesterNo ? `Sem ${student.semesterNo}` : undefined,
      section: student ? student.sectionName : undefined,
    });
  }
  return people.sort((a, b) => a.name.localeCompare(b.name));
}

export function useUniversityPeople() {
  const fetcher = useCallback(async (): Promise<UniversityPerson[]> => buildPeople(await fetchRawData()), []);
  const { data, loading, error, refresh } = useUniversityData<UniversityPerson[]>(fetcher);
  return { people: data ?? [], loading, error, refresh };
}

export function useUniversityRaw() {
  const fetcher = useCallback((): Promise<UniversityRawData> => fetchRawData(), []);
  const { data, loading, error, refresh } = useUniversityData<UniversityRawData>(fetcher);
  return { users: data?.users ?? [], students: data?.students ?? [], staff: data?.staff ?? [], loading, error, refresh };
}
