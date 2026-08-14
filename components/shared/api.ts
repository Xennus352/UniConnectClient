'use client';

export interface LoginResult {
  role: string;
  email: string;
  name: string;
  path: string;
}

export interface StudentRecord {
  studentId: string;
  userId: string;
  email: string;
  majorId: string;
  majorCode: string;
  semesterId: string;
  semesterNo: number;
  sectionId: string;
  sectionName: string;
  termId: string;
  academicYear: number;
  rollNo: string;
  studentName: string;
  phoneNo: string | null;
  address: string | null;
  birthYear: number | null;
}

export interface StaffRecord {
  staffId: string;
  userId: string;
  staffNo: string;
  staffName: string;
  phoneNo: string | null;
  batchYear: number | null;
  address: string | null;
  unitId: string;
  unitName: string;
  joinedAt: string | null;
  leftDate: string | null;
}

export interface AttendanceRecord {
  attendanceId: string;
  sessionId: string;
  studentId: string;
  rollNo: string;
  studentName: string;
  attendanceStatus: 'PRESENT' | 'ABSENT';
  remark: string | null;
  markedAt: string | null;
  markedByStaffId: string | null;
}

export interface ClassSessionRecord {
  sessionId: string;
  scheduleId: string;
  courseCode: string;
  sectionName: string;
  sessionDate: string;
  sessionStatus: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface ScheduleRecord {
  scheduleId: string;
  generationId: string;
  teachingAssignmentId: string | null;
  courseCode: string;
  staffName: string;
  sectionName: string;
  dayOfWeek: number;
  startSlotId: string;
  startPeriodNo: number;
  endSlotId: string;
  endPeriodNo: number;
  scheduleStatus: string;
  scheduleType: string;
}

export interface UserRecord {
  userId: string;
  email: string;
  roleName: 'SYSTEM_ADMIN' | 'STAFF' | 'STUDENT';
  isActive: boolean;
  registrationStatus: string;
  lastLogin: string | null;
  createdAt: string | null;
}

export interface MajorRecord {
  majorId: string;
  unitId: string;
  unitCode: string;
  majorCode: string;
  majorName: string;
}

export interface OrganizationalUnitRecord {
  unitId: string;
  unitCode: string;
  unitName: string;
  unitType: string;
  description: string | null;
}

export interface SectionRecord {
  sectionId: string;
  sectionName: string;
}

export interface AcademicTermRecord {
  termId: string;
  academicYear: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
}

export interface ResultBatchRecord {
  batchId: string;
  termId: string;
  academicYear: number;
  examTypeId: string;
  examTypeName: string;
  semesterId: string;
  semesterNo: number;
  uploadedByStaffId: string;
  uploadedByStaffNo: string;
  uploadedType: string;
  sourceFileName: string;
  totalFiles: number;
  matchedFiles: number;
  failedFiles: number;
  status: string;
  uploadedAt: string;
  publishedAt: string | null;
}

export interface ResultDocumentRecord {
  resultDocumentId: string;
  batchId: string;
  examTypeName: string;
  studentId: string;
  rollNo: string;
  studentName: string;
  pdfFileName: string;
  storageObjectPath: string;
  releaseStatus: string;
  blockedReason: string | null;
  viewedAt: string | null;
  downloadedAt: string | null;
}

export async function backendLogin(email: string, password: string): Promise<LoginResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || `Login failed (${res.status})`);
    }
    return res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out — please try again');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function backendLogout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
}

const API_TIMEOUT_MS = 12000;

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { signal: callerSignal, ...initRest } = init ?? {};
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const signal = callerSignal
    ? AbortSignal.any([callerSignal, controller.signal])
    : controller.signal;
  try {
    const res = await fetch(`/api/backend${path}`, {
      ...initRest,
      signal,
      headers: { 'Content-Type': 'application/json', ...(initRest.headers || {}) },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || `Request failed (${res.status})`);
    }
    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out — please try again');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface MarkAttendanceEntry {
  studentId: string;
  attendanceStatus: 'PRESENT' | 'ABSENT';
  remark?: string;
}

export function markAttendance(sessionId: string, entries: MarkAttendanceEntry[]): Promise<AttendanceRecord[]> {
  return apiFetch(`/api/attendance/${sessionId}/mark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  });
}

export function isBackendError(e: unknown): boolean {
  return e instanceof Error;
}
