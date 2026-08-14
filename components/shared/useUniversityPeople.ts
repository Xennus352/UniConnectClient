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
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function useUniversityPeople() {
  const fetcher = useCallback(async (): Promise<UniversityPerson[]> => {
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
      people.push({ email: u.email, name, role, initials: initialsOf(name), sub });
    }
    return people.sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const { data, loading, error, refresh } = useUniversityData<UniversityPerson[]>(fetcher);
  return { people: data ?? [], loading, error, refresh };
}