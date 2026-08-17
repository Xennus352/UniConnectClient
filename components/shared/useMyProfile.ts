'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api';
import type { StudentRecord, StaffRecord } from './api';

export interface MyProfile {
  kind: 'student' | 'staff';
  name: string;
  major: string;
  semesterNo: number | null;
  rollNo: string;
  staffNo: string;
  unit: string;
  phone: string;
}

export function useMyProfile() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const student = await apiFetch<StudentRecord>('/api/students/me').catch(() => null);
      if (student) {
        setProfile({
          kind: 'student',
          name: student.studentName,
          major: student.majorCode,
          semesterNo: student.semesterNo,
          rollNo: student.rollNo,
          staffNo: '',
          unit: '',
          phone: student.phoneNo || '',
        });
        return;
      }
      const staff = await apiFetch<StaffRecord>('/api/staff/me').catch(() => null);
      if (staff) {
        setProfile({
          kind: 'staff',
          name: staff.staffName,
          major: '',
          semesterNo: null,
          rollNo: '',
          staffNo: staff.staffNo,
          unit: staff.unitName,
          phone: staff.phoneNo || '',
        });
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load profile on mount
    void load();
  }, [load]);

  return { profile, loading };
}