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
  batchYear: number | null;
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
  positions: string[];
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

export interface SemesterRecord {
  semesterId: string;
  semesterNo: number;
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

const API_TIMEOUT_MS = 60000;
// Bulk imports run one row at a time against the (remote) university server and
// can take several minutes for large spreadsheets. The general 60s timeout would
// abort the request while the server keeps inserting rows, leaving the UI to
// report a failure even though every row was actually created. Uploads therefore
// use a much larger budget so the response is awaited to completion.
const UPLOAD_TIMEOUT_MS = 20 * 60 * 1000;

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
    if (res.status === 401) {
      await backendLogout();
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
      throw new Error('Session expired — please sign in again');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || `Request failed (${res.status})`);
    }
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : (undefined as T);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out — please try again');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface ImportErrorRow {
  row: number;
  message: string;
}

export interface ImportResult {
  created: number;
  errors: ImportErrorRow[];
}

export async function uploadExcel<T = ImportResult>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(`/api/backend${path}`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    if (res.status === 401) {
      await backendLogout();
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
      throw new Error('Session expired — please sign in again');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || `Upload failed (${res.status})`);
    }
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : (undefined as T);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Upload timed out — please try again');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function bulkDeleteUsers(userIds: string[]): Promise<void> {
  return apiFetch<void>('/api/users/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ userIds }),
  });
}

export function deleteUser(userId: string): Promise<void> {
  return apiFetch<void>(`/api/users/${userId}`, {
    method: 'DELETE',
  });
}

export function updateUser(
  userId: string,
  fields: { email?: string; isActive?: boolean },
): Promise<UserRecord> {
  return apiFetch(`/api/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
}

const STAFF_IMPORT_TYPES: Record<string, string> = {
  lecturers: 'LECTURER',
  'student-affairs': 'STUDENT_AFFAIRS',
  finance: 'FINANCE',
  'administrative-officers': 'ADMINISTRATIVE',
};

export function importUsersExcel(target: string, file: File): Promise<ImportResult> {
  if (target === 'students') {
    return uploadExcel('/api/students/import', file);
  }
  const importType = STAFF_IMPORT_TYPES[target] ?? target;
  return uploadExcel(`/api/staff/import?type=${encodeURIComponent(importType)}`, file);
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
