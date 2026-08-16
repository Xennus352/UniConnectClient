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

  if (!year || !semester) {
    return NextResponse.json({ message: 'Academic year and semester are required' }, { status: 400 });
  }
  if (!FOLDER_RE.test(year) || !FOLDER_RE.test(semester)) {
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

  const results: FileResult[] = [];
  const insertedIds: string[] = [];
  const sentEmails: string[] = [];
  let sent = 0;

  for (const file of files) {
    try {
      const buffer = Buffer.from(file.base64, 'base64');
      if (buffer.length === 0) throw new Error('Empty file');
      if (buffer.length > MAX_FILE_SIZE) throw new Error(`Exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);

      const objectPath = `${year}/${semester}/${file.rollNo.toUpperCase()}_exam_result.pdf`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(objectPath, buffer, { contentType: 'application/pdf', cacheControl: '3600', upsert: true });
      if (upErr) throw new Error(upErr.message);

      const fileUrl = supabase.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;

      const now = Date.now();
      const { data: row, error: recErr } = await supabase
        .from('exam_results')
        .insert({
          user_id: file.studentUserId || null,
          recipient_email: file.studentEmail,
          roll_number: file.rollNo.toUpperCase(),
          year,
          semester,
          file_name: file.fileName,
          file_url: fileUrl,
          storage_path: objectPath,
          student_name: file.studentName || null,
          created_at: now,
        })
        .select('id')
        .single();
      if (recErr || !row) throw new Error(recErr?.message ?? 'Insert failed');
      insertedIds.push(row.id);
      sentEmails.push(file.studentEmail);

      sent += 1;
      results.push({ fileName: file.fileName, rollNo: file.rollNo, ok: true });
    } catch (err) {
      results.push({
        fileName: file.fileName,
        rollNo: file.rollNo,
        ok: false,
        error: err instanceof Error ? err.message : 'Distribution failed',
      });
    }
  }

  if (sent === 0) {
    return NextResponse.json({ sent: 0, results, message: 'No files uploaded — batch not created' }, { status: 400 });
  }

  const { data: batch, error: batchErr } = await supabase
    .from('exam_result_batches')
    .insert({
      exam_type: examType || 'Exam',
      semester,
      academic_year: year,
      total_files: sent,
      status: 'PUBLISHED',
      created_by: identity.email ?? null,
    })
    .select('id, exam_type, semester, academic_year, total_files, status, created_by, created_at')
    .single();

  if (batchErr || !batch) {
    return NextResponse.json({ sent: 0, results, message: 'Batch creation failed' }, { status: 500 });
  }

  const { error: linkErr } = await supabase
    .from('exam_results')
    .update({ batch_id: batch.id })
    .in('id', insertedIds);

  if (linkErr) {
    return NextResponse.json({ sent: 0, results, message: 'Batch linking failed' }, { status: 500 });
  }

  const now = Date.now();
  const notifications = [...new Set(sentEmails)].map((email) => ({
    recipient_email: email,
    type: 'exam-result',
    message: `Your ${batch.exam_type} results (${semester}, ${year}) have been published!`,
    created_at: now,
    read: false,
  }));
  if (notifications.length > 0) {
    await supabase.from('notifications').insert(notifications);
  }

  return NextResponse.json({ batchId: batch.id, sent, results });
}