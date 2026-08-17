import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

const BUCKET = 'exam-results';
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_FILES = 200;
const ROLL_RE = /^UCSTGO-\d+$/i;
const FOLDER_RE = /^[a-zA-Z0-9][a-zA-Z0-9 \-]*$/;

interface DistributeFile {
  fileName: string;
  rollNo: string;
  base64: string;
  semester?: string;
  studentId?: string;
  studentUserId: string;
  studentEmail: string;
  studentName: string;
}

interface FileResult {
  fileName: string;
  rollNo: string;
  ok: boolean;
  error?: string;
}

async function ensureBucket(supabase: SupabaseClient): Promise<boolean> {
  const { error } = await supabase.storage.getBucket(BUCKET);
  if (!error) return true;
  const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_FILE_SIZE,
  });
  return !createErr;
}

function sanitizeFolder(v: string): string {
  return v.trim().replace(/\/+/g, '-').slice(0, 60);
}

export async function POST(request: Request) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  if (identity.role !== 'admin' && identity.role !== 'student-affair') {
    return NextResponse.json({ message: 'Not authorized' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const year = typeof body?.year === 'string' ? sanitizeFolder(body.year) : '';
  const semester = typeof body?.semester === 'string' ? sanitizeFolder(body.semester) : '';
  const examType = typeof body?.examType === 'string' ? sanitizeFolder(body.examType) : 'Exam';
  const files: DistributeFile[] = Array.isArray(body?.files) ? body.files : [];

  if (!year) {
    return NextResponse.json({ message: 'Academic year is required' }, { status: 400 });
  }
  if (!FOLDER_RE.test(year) || (semester && !FOLDER_RE.test(semester))) {
    return NextResponse.json({ message: 'Invalid year or semester value' }, { status: 400 });
  }
  if (files.length === 0) {
    return NextResponse.json({ message: 'No files provided' }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ message: `At most ${MAX_FILES} files per batch` }, { status: 400 });
  }

  const invalid = files.some(
    (f) =>
      !f ||
      typeof f.fileName !== 'string' ||
      !ROLL_RE.test(f.rollNo ?? '') ||
      typeof f.base64 !== 'string' ||
      f.base64.length === 0 ||
      typeof f.studentEmail !== 'string' ||
      typeof f.studentName !== 'string'
  );
  if (invalid) {
    return NextResponse.json({ message: 'Invalid file metadata' }, { status: 400 });
  }

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  if (!(await ensureBucket(supabase))) {
    return NextResponse.json({ message: 'Storage unavailable' }, { status: 500 });
  }

  const fileSemesters = files
    .map((f) => sanitizeFolder(f.semester ?? ''))
    .filter((s): s is string => Boolean(s));
  const distinctSemesters = [...new Set(fileSemesters)];
  const batchSemester =
    distinctSemesters.length === 1
      ? distinctSemesters[0]
      : distinctSemesters.length > 1
        ? 'Multi-Semester'
        : semester || 'Unassigned';

  const { data: batch, error: batchErr } = await supabase
    .from('exam_result_batches')
    .insert({
      exam_type: examType || 'Exam',
      semester: batchSemester,
      academic_year: year,
      total_files: files.length,
      status: 'PUBLISHED',
      created_by: identity.email ?? null,
    })
    .select('id, exam_type, semester, academic_year, total_files, status, created_by, created_at')
    .single();
  if (batchErr || !batch) {
    return NextResponse.json({ message: 'Batch creation failed' }, { status: 500 });
  }

  const now = Date.now();
  const uploadPromises = files.map(async (file): Promise<{ fileName: string; rollNo: string; semester: string }> => {
    const fileSemester = sanitizeFolder(file.semester ?? '') || semester || 'Unassigned';
    if (!FOLDER_RE.test(fileSemester)) throw new Error('Invalid semester value');

    const buffer = Buffer.from(file.base64, 'base64');
    if (buffer.length === 0) throw new Error('Empty file');
    if (buffer.length > MAX_FILE_SIZE) throw new Error(`Exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);

    const objectPath = `${year}/${fileSemester}/${file.rollNo.toUpperCase()}_exam_result.pdf`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, buffer, { contentType: 'application/pdf', cacheControl: '3600', upsert: true });
    if (upErr) throw new Error(upErr.message);

    const fileUrl = supabase.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;

    const { error: recErr } = await supabase
      .from('exam_results')
      .insert({
        user_id: file.studentUserId || null,
        student_id: file.studentId || null,
        recipient_email: file.studentEmail,
        roll_number: file.rollNo.toUpperCase(),
        year,
        semester: fileSemester,
        file_name: file.fileName,
        file_url: fileUrl,
        storage_path: objectPath,
        student_name: file.studentName || null,
        batch_id: batch.id,
        created_at: now,
      });
    if (recErr) throw new Error(recErr.message);

    return { fileName: file.fileName, rollNo: file.rollNo, semester: fileSemester };
  });

  const settled = await Promise.allSettled(uploadPromises);
  const results: FileResult[] = [];
  const successSemesters = new Set<string>();
  const emailSemesters = new Map<string, Set<string>>();
  let succeeded = 0;

  settled.forEach((outcome, i) => {
    const file = files[i];
    if (outcome.status === 'fulfilled') {
      succeeded += 1;
      successSemesters.add(outcome.value.semester);
      const set = emailSemesters.get(file.studentEmail) ?? new Set<string>();
      set.add(outcome.value.semester);
      emailSemesters.set(file.studentEmail, set);
      results.push({ fileName: file.fileName, rollNo: file.rollNo, ok: true });
    } else {
      const reason = outcome.reason;
      results.push({
        fileName: file.fileName,
        rollNo: file.rollNo,
        ok: false,
        error: reason instanceof Error ? reason.message : 'Distribution failed',
      });
    }
  });

  const failed = files.length - succeeded;
  if (succeeded === 0) {
    await supabase.from('exam_result_batches').delete().eq('id', batch.id);
    return NextResponse.json(
      { sent: 0, succeeded: 0, failed: files.length, total: files.length, results, message: 'No files uploaded — batch not created' },
      { status: 400 }
    );
  }

  const { error: countErr } = await supabase
    .from('exam_result_batches')
    .update({ total_files: succeeded })
    .eq('id', batch.id);
  if (countErr) {
    return NextResponse.json({ message: 'Batch update failed' }, { status: 500 });
  }

  const notifications = [...new Set(emailSemesters.keys())].map((email) => {
    const studentSemesters = emailSemesters.get(email);
    const label =
      studentSemesters && studentSemesters.size === 1
        ? [...studentSemesters][0]
        : 'Multiple Semesters';
    return {
      recipient_email: email,
      type: 'exam-result',
      message: `Your ${batch.exam_type} results (${label}, ${year}) have been published!`,
      created_at: now,
      read: false,
    };
  });
  if (notifications.length > 0) {
    await supabase.from('notifications').insert(notifications);
  }

  return NextResponse.json({
    batchId: batch.id,
    sent: succeeded,
    succeeded,
    failed,
    total: files.length,
    semesters: successSemesters.size,
    results,
  });
}