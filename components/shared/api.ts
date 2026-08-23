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
  courseName?: string;
  staffName: string;
  staffNames?: string[];
  sectionName: string;
  sections?: string[];
  semesterNo?: number;
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
      throw new Error('Request timed out — the university server took too long to respond. Please try again.');
    }
    if (err instanceof TypeError) {
      throw new Error('Cannot reach the university server. Check your connection and try again.');
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
// Timetable generation dispatch runs synchronous scope validation against the
// remote university database before handing the solve to a background worker.
// On degraded database days that validation alone can outlive the general 60s
// budget even though generation itself succeeds server-side right after — so
// the start call gets its own generous budget (same rationale as uploads).
const GENERATION_TIMEOUT_MS = 5 * 60 * 1000;
// Bulk imports run one row at a time against the (remote) university server and
// can take several minutes for large spreadsheets. The general 60s timeout would
// abort the request while the server keeps inserting rows, leaving the UI to
// report a failure even though every row was actually created. Uploads therefore
// use a much larger budget so the response is awaited to completion.
const UPLOAD_TIMEOUT_MS = 20 * 60 * 1000;

export async function apiFetch<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { signal: callerSignal, timeoutMs, ...initRest } = init ?? {};
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? API_TIMEOUT_MS);
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
      const message =
        typeof err?.message === 'string' && err.message.trim().length > 0
          ? err.message
          : `Server error (${res.status})`;
      throw new Error(message);
    }
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : (undefined as T);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out — the university server took too long to respond. Please try again.');
    }
    if (err instanceof TypeError) {
      throw new Error('Cannot reach the university server. Check your connection and try again.');
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
  /** Slots the student actually attended (subset of the schedule span). */
  periodSlotIds?: string[];
}

export function markAttendance(sessionId: string, entries: MarkAttendanceEntry[]): Promise<AttendanceRecord[]> {
  return apiFetch(`/api/attendance/${sessionId}/mark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  });
}

// ============================================================================
// Roll Call (lecturer) — latest PUBLISHED timetable only
// ============================================================================

export interface RollCallSchedule {
  scheduleId: string;
  dayOfWeek: number;
  dayName: string;
  startTime: string;
  endTime: string;
  periodCount: number;
  courseCode: string;
  courseName: string;
  semesterNo: number | null;
  sectionNames: string[];
  sharedDelivery: boolean;
  todaySessionId: string | null;
  todaySessionCompleted: boolean;
}

export interface RollCallSlot {
  slotId: string;
  periodNo: number;
  startTime: string;
  endTime: string;
}

export interface RollCallStudent {
  studentId: string;
  rollNo: string;
  studentName: string;
  attendanceId: string | null;
  attendanceStatus: string | null;
  remark: string | null;
  attendedSlotIds: string[];
  attendedPeriods: number;
}

export interface RollCallStudentsResponse {
  scheduleId: string;
  sectionNames: string[];
  scheduledPeriods: number;
  slots: RollCallSlot[];
  students: RollCallStudent[];
}

export function getRollCallMySchedule(): Promise<RollCallSchedule[]> {
  return apiFetch('/api/rollcall/my-schedule');
}

export function ensureRollCallSession(scheduleId: string): Promise<ClassSessionRecord> {
  return apiFetch('/api/rollcall/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduleId }),
  });
}

export function getRollCallStudents(
  scheduleId: string,
  sessionId?: string
): Promise<RollCallStudentsResponse> {
  const q = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
  return apiFetch(`/api/rollcall/students?scheduleId=${encodeURIComponent(scheduleId)}${q}`);
}

export function isBackendError(e: unknown): boolean {
  return e instanceof Error;
}

// ============================================================================
// Timetable generation & shared draft workspace
// ============================================================================

export type GenerationStatus = 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED' | 'PUBLISHED';
export type LobbyStatus = 'OPEN' | 'GENERATING' | 'COMPLETED' | 'CANCELLED';
export type ScheduleStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';
export type ScheduleType = 'COURSE' | 'LMS' | 'ASSIGNMENT' | 'BREAK';
export type MeetingType = 'LECTURE' | 'LAB';
export type AssignmentStatus = 'ACTIVE' | 'INACTIVE' | 'COMPLETED';

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  LECTURE: 'Lecture',
  LAB: 'Lab',
};

export interface ScheduleResponse {
  scheduleId: string;
  generationId: string;
  teachingAssignmentId: string | null;
  teachingGroupId: string | null;
  courseCode: string;
  courseName: string;
  staffName: string;
  sectionName: string;
  semesterNo: number;
  dayOfWeek: number;
  startSlotId: string;
  startPeriodNo: number;
  endSlotId: string;
  endPeriodNo: number;
  scheduleStatus: ScheduleStatus;
  scheduleType: ScheduleType;
  sections: string[];
  staffNames: string[];
  createdAt: string;
}

export interface GenerationSessionResponse {
  generationId: string;
  termId: string;
  academicYear: string;
  generatedByStaffId: string;
  generatedByStaffNo: string;
  status: GenerationStatus;
  startedAt: string | null;
  publishedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  failureReport: string | null;
}

export interface GenerationManageResponse {
  isHod: boolean;
  canManage: boolean;
  generation: GenerationSessionResponse | null;
}

export interface GenerationScopeSemester {
  semesterId: string;
  semesterNo: number;
  sections: SectionInfoResponse[];
}

export interface SectionInfoResponse {
  sectionId: string;
  sectionName: string;
}

export interface TimetableLobbyMemberResponse {
  memberId: string;
  staffId: string;
  staffNo: string;
  staffName: string;
  unitName: string;
  invitedAt: string;
  joinedAt: string | null;
  joined: boolean;
}

export interface TimetableLobbyResponse {
  lobbyId: string;
  termId: string;
  academicYear: string;
  leaderStaffId: string;
  leaderStaffNo: string;
  leaderName: string;
  status: LobbyStatus;
  generationId: string | null;
  createdAt: string;
  members: TimetableLobbyMemberResponse[];
}

export interface TimetableLockResponse {
  generationId: string;
  locked: boolean;
  staffId: string | null;
  staffName: string | null;
  expiresAt: string | null;
}

export function lockIsFree(lock: TimetableLockResponse | null | undefined): boolean {
  return !lock || !lock.locked;
}

export interface SwapScheduleResponse {
  swapped: boolean;
  conflicts: string[];
  schedules: ScheduleResponse[];
}

export interface MeetingRequirementResponse {
  requirementId: string;
  courseId: string;
  courseCode: string;
  meetingType: MeetingType;
  sessionsPerWeek: number;
  periodsPerSession: number;
}

export interface TeachingGroupMemberResponse {
  assignmentId: string;
  staffId: string;
  staffNo: string;
  staffName: string;
  sectionId: string;
  sectionName: string;
}

export interface TeachingGroupResponse {
  groupId: string;
  termId: string;
  academicYear: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  semesterNo: number;
  groupName: string;
  createdAt: string;
  members: TeachingGroupMemberResponse[];
}

export interface TeachingAssignmentResponse {
  assignmentId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  staffId: string;
  staffNo: string;
  staffName: string;
  staffEmail: string;
  unitId: string;
  unitName: string;
  sectionId: string;
  sectionName: string;
  termId: string;
  academicYear: string;
  assignmentStatus: AssignmentStatus;
  assignedAt: string;
  assignedByStaffId: string;
}

export interface ExamTypeResponse {
  examTypeId: string;
  examTypeName: string;
}

export interface CourseRecord {
  courseId: string;
  unitId: string;
  unitCode: string;
  courseCode: string;
  courseName: string;
  creditUnit: number | null;
  majorId: string | null;
  majorCode: string;
  semesterId: string;
  semesterNo: number;
  isRequired: boolean;
  displayOrder: number;
}

export interface SemesterSelection {
  semesterId: string;
  sectionIds: string[];
}

export interface GenerateTimetableRequest {
  examTypeId: string;
  semesters: SemesterSelection[];
}

export interface MeetingRequirementRequest {
  courseId: string;
  meetingType: MeetingType;
  sessionsPerWeek: number;
  periodsPerSession: number;
}

export interface SwapScheduleRequest {
  scheduleId: string;
  targetDay: number;
  targetPeriod: number;
  force: boolean;
}

export interface DragStatusRequest {
  action: 'start' | 'move' | 'end';
  scheduleId: string | null;
  day: number | null;
  period: number | null;
}

export interface CreateGenerationRequest {
  termId: string;
  generatedByStaffId?: string | null;
}

export interface CreateLobbyRequest {
  termId: string;
}

export interface InviteLobbyMemberRequest {
  staffId: string;
}

function queryString(params: Record<string, string | number | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

// ---------- Staff ----------

export function getCurrentStaff(): Promise<StaffRecord> {
  return apiFetch('/api/staff/me');
}

// ---------- Schedules ----------

export function getSchedules(params?: {
  termId?: string;
  sectionId?: string;
  staffId?: string;
  dayOfWeek?: number;
}): Promise<ScheduleResponse[]> {
  return apiFetch(`/api/schedules${queryString(params ?? {})}`);
}

export function getPublishedSchedules(termId: string): Promise<ScheduleResponse[]> {
  return apiFetch(`/api/schedules/published${queryString({ termId })}`);
}

export interface TimeSlotResponse {
  slotId: string;
  periodNo: number;
  startTime: string;
  endTime: string;
  displayOrder: number;
}

export function getTimeSlots(): Promise<TimeSlotResponse[]> {
  return apiFetch('/api/time-slots');
}

/**
 * The persisted university timetable grid (source of truth in the time_slots
 * table): P1=09:00-10:00 … P3=11:00-12:00, Lunch=12:00-13:00,
 * P4=13:00-14:00 … P6=15:00-16:00. The school day runs 09:00-16:00.
 */
export const PERSISTED_PERIOD_LABELS: readonly string[] = [
  '09:00 \u2013 10:00',
  '10:00 \u2013 11:00',
  '11:00 \u2013 12:00',
  '13:00 \u2013 14:00',
  '14:00 \u2013 15:00',
  '15:00 \u2013 16:00',
];
export const PERSISTED_LUNCH_LABEL = '12:00 \u2013 13:00';

export interface TimeGridLabels {
  periodLabels: string[];
  lunchLabel: string;
}

const minutesOf = (hm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

const hmOf = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const timeLabelOf = (a: number | null, b: number | null): string | null =>
  a !== null && b !== null ? `${hmOf(a)} \u2013 ${hmOf(b)}` : null;

/**
 * The persisted grid is authoritative: P1 must start at 09:00 and the school
 * day must end at 16:00 (P6 end). The server can return either the exact
 * values or a uniform timezone-shifted copy; either way the labels are
 * re-anchored onto the persisted grid so the timetable always shows the real
 * university hours. A grid that does not re-anchor to 09:00-16:00 falls back
 * to the persisted labels.
 */
export function normalizeTimeSlots(slots: TimeSlotResponse[]): TimeGridLabels {
  const fallback: TimeGridLabels = { periodLabels: [...PERSISTED_PERIOD_LABELS], lunchLabel: PERSISTED_LUNCH_LABEL };
  if (!Array.isArray(slots) || slots.length === 0) return fallback;
  const sorted = [...slots].sort((a, b) => a.displayOrder - b.displayOrder || a.periodNo - b.periodNo);
  const p1 = sorted.find((s) => s.periodNo === 1);
  const p1Start = p1 ? minutesOf(p1.startTime) : null;
  if (p1Start === null) return fallback;
  const offset = p1Start - 9 * 60;
  const p6 = sorted.find((s) => s.periodNo === 6);
  const p6End = p6 ? minutesOf(p6.endTime) : null;
  if (p6End !== null && p6End - offset !== 16 * 60) return fallback;
  const labels: string[] = [];
  for (let p = 1; p <= 6; p++) {
    const slot = sorted.find((s) => s.periodNo === p);
    const start = slot ? minutesOf(slot.startTime) : null;
    const end = slot ? minutesOf(slot.endTime) : null;
    const label = start !== null && end !== null ? timeLabelOf(start - offset, end - offset) : null;
    if (!label) return fallback;
    labels[p - 1] = label;
  }
  const p3 = sorted.find((s) => s.periodNo === 3);
  const p4 = sorted.find((s) => s.periodNo === 4);
  const p3End = p3 ? minutesOf(p3.endTime) : null;
  const p4Start = p4 ? minutesOf(p4.startTime) : null;
  const lunch =
    p3End !== null && p4Start !== null
      ? timeLabelOf(p3End - offset, p4Start - offset)
      : PERSISTED_LUNCH_LABEL;
  return { periodLabels: labels, lunchLabel: lunch ?? PERSISTED_LUNCH_LABEL };
}

/**
 * Fetches the persisted time-slot configuration and normalizes it onto the
 * authoritative 09:00-16:00 grid. Never rejects: falls back to the persisted
 * labels when the server is unreachable.
 */
export function getTimetableTimeGrid(): Promise<TimeGridLabels> {
  return getTimeSlots()
    .then(normalizeTimeSlots)
    .catch(() => ({ periodLabels: [...PERSISTED_PERIOD_LABELS], lunchLabel: PERSISTED_LUNCH_LABEL }));
}

// ---------- Courses ----------

export function getCourses(params?: {
  majorId?: string;
  semesterId?: string;
  unitId?: string;
}): Promise<CourseRecord[]> {
  return apiFetch(`/api/courses${queryString(params ?? {})}`);
}

// ---------- Meeting requirements ----------

export function getMeetingRequirements(params?: {
  unitId?: string;
  semesterId?: string;
}): Promise<MeetingRequirementResponse[]> {
  return apiFetch(`/api/meeting-requirements${queryString(params ?? {})}`);
}

export function createMeetingRequirement(
  request: MeetingRequirementRequest,
): Promise<MeetingRequirementResponse> {
  return apiFetch('/api/meeting-requirements', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function updateMeetingRequirement(
  requirementId: string,
  request: MeetingRequirementRequest,
): Promise<MeetingRequirementResponse> {
  return apiFetch(`/api/meeting-requirements/${requirementId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export function deleteMeetingRequirement(requirementId: string): Promise<void> {
  return apiFetch(`/api/meeting-requirements/${requirementId}`, { method: 'DELETE' });
}

// ---------- Teaching groups ----------

export function getTeachingGroups(termId?: string): Promise<TeachingGroupResponse[]> {
  return apiFetch(`/api/teaching-groups${queryString({ termId })}`);
}

export function createTeachingGroup(request: {
  termId: string;
  courseId: string;
  assignmentIds: string[];
}): Promise<TeachingGroupResponse> {
  return apiFetch('/api/teaching-groups', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function deleteTeachingGroup(groupId: string): Promise<void> {
  return apiFetch(`/api/teaching-groups/${groupId}`, { method: 'DELETE' });
}

// ---------- Teaching assignments ----------

export function getTeachingAssignments(): Promise<TeachingAssignmentResponse[]> {
  return apiFetch('/api/teaching-assignments');
}

// ---------- Exam types ----------

export function getExamTypes(): Promise<ExamTypeResponse[]> {
  return apiFetch('/api/exam-types');
}

// ---------- Generations ----------

export function getGenerations(termId?: string): Promise<GenerationSessionResponse[]> {
  return apiFetch(`/api/generations${queryString({ termId })}`);
}

export function getGenerationManage(termId?: string): Promise<GenerationManageResponse> {
  return apiFetch(`/api/generations/manage${queryString({ termId })}`);
}

export function getGenerationScope(termId: string, examTypeId?: string): Promise<GenerationScopeSemester[]> {
  return apiFetch(`/api/generations/scope${queryString({ termId, examTypeId })}`);
}

export function getGeneration(generationId: string): Promise<GenerationSessionResponse> {
  return apiFetch(`/api/generations/${generationId}`);
}

export function createGeneration(request: CreateGenerationRequest): Promise<GenerationSessionResponse> {
  return apiFetch('/api/generations', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function generateTimetable(
  generationId: string,
  request?: GenerateTimetableRequest,
): Promise<GenerationSessionResponse> {
  return apiFetch(`/api/generations/${generationId}/generate`, {
    method: 'POST',
    body: request ? JSON.stringify(request) : undefined,
  });
}

export function publishGeneration(generationId: string): Promise<GenerationSessionResponse> {
  return apiFetch(`/api/generations/${generationId}/publish`, { method: 'POST' });
}

export function cancelGeneration(generationId: string): Promise<GenerationSessionResponse> {
  return apiFetch(`/api/generations/${generationId}/cancel`, { method: 'POST' });
}

export function getGenerationSchedules(generationId: string): Promise<ScheduleResponse[]> {
  return apiFetch(`/api/generations/${generationId}/schedules`);
}

export function deleteGeneration(generationId: string): Promise<void> {
  return apiFetch(`/api/generations/${generationId}`, { method: 'DELETE' });
}

export function publishDragStatus(generationId: string, request: DragStatusRequest): Promise<void> {
  return apiFetch(`/api/generations/${generationId}/drag`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function swapSchedules(generationId: string, request: SwapScheduleRequest): Promise<SwapScheduleResponse> {
  return apiFetch(`/api/generations/${generationId}/swap`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// ---------- Single-operator editing lock ----------

export function getTimetableLock(generationId: string): Promise<TimetableLockResponse> {
  return apiFetch(`/api/generations/${generationId}/lock`);
}

export function acquireTimetableLock(generationId: string): Promise<TimetableLockResponse> {
  return apiFetch(`/api/generations/${generationId}/lock`, { method: 'POST' });
}

export function heartbeatTimetableLock(generationId: string): Promise<TimetableLockResponse> {
  return apiFetch(`/api/generations/${generationId}/lock/heartbeat`, { method: 'POST' });
}

export function releaseTimetableLock(generationId: string): Promise<TimetableLockResponse> {
  return apiFetch(`/api/generations/${generationId}/lock/release`, { method: 'POST' });
}

// ---------- Generation lobbies ----------

export function getGenerationLobbies(): Promise<TimetableLobbyResponse[]> {
  return apiFetch('/api/timetable-lobbies');
}

export function getGenerationLobby(lobbyId: string): Promise<TimetableLobbyResponse> {
  return apiFetch(`/api/timetable-lobbies/${lobbyId}`);
}

export function createGenerationLobby(request: CreateLobbyRequest): Promise<TimetableLobbyResponse> {
  return apiFetch('/api/timetable-lobbies', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function joinGenerationLobby(lobbyId: string): Promise<TimetableLobbyResponse> {
  return apiFetch(`/api/timetable-lobbies/${lobbyId}/join`, { method: 'POST' });
}

export function inviteLobbyMember(lobbyId: string, staffId: string): Promise<TimetableLobbyResponse> {
  return apiFetch(`/api/timetable-lobbies/${lobbyId}/invite`, {
    method: 'POST',
    body: JSON.stringify({ staffId }),
  });
}

export function cancelGenerationLobby(lobbyId: string): Promise<TimetableLobbyResponse> {
  return apiFetch(`/api/timetable-lobbies/${lobbyId}/cancel`, { method: 'POST' });
}

export function generateFromLobby(lobbyId: string): Promise<TimetableLobbyResponse> {
  return apiFetch(`/api/timetable-lobbies/${lobbyId}/generate`, { method: 'POST', timeoutMs: GENERATION_TIMEOUT_MS });
}
