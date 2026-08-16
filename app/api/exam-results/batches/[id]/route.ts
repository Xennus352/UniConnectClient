import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

const BUCKET = 'exam-results';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  if (identity.role !== 'admin' && identity.role !== 'student-affair') {
    return NextResponse.json({ message: 'Not authorized' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== 'publish' && action !== 'archive' && action !== 'unarchive') {
    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  }

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { data: batch, error: fetchErr } = await supabase
    .from('exam_result_batches')
    .select('id, exam_type, semester, academic_year, total_files, status, created_by, created_at')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr || !batch) {
    return NextResponse.json({ message: 'Batch not found' }, { status: 404 });
  }

  if (action === 'publish') {
    if (batch.status !== 'PUBLISHED') {
      const { error: updateErr } = await supabase
        .from('exam_result_batches')
        .update({ status: 'PUBLISHED' })
        .eq('id', id);
      if (updateErr) return NextResponse.json({ message: updateErr.message }, { status: 500 });
    }

    const { data: rows } = await supabase
      .from('exam_results')
      .select('id, recipient_email')
      .eq('batch_id', id);

    const now = Date.now();
    const notifications = (rows ?? []).map((r) => ({
      recipient_email: r.recipient_email,
      type: 'exam-result',
      message: `Your ${batch.exam_type} results (${batch.semester}, ${batch.academic_year}) have been published!`,
      created_at: now,
      read: false,
    }));
    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }

    return NextResponse.json({ batchId: id, status: 'PUBLISHED', notified: notifications.length });
  }

  if (action === 'archive') {
    const { error: archiveErr } = await supabase
      .from('exam_result_batches')
      .update({ status: 'ARCHIVED' })
      .eq('id', id);
    if (archiveErr) return NextResponse.json({ message: archiveErr.message }, { status: 500 });
    return NextResponse.json({ batchId: id, status: 'ARCHIVED' });
  }

  if (action === 'unarchive') {
    const { error: restoreErr } = await supabase
      .from('exam_result_batches')
      .update({ status: 'PUBLISHED' })
      .eq('id', id);
    if (restoreErr) return NextResponse.json({ message: restoreErr.message }, { status: 500 });
    return NextResponse.json({ batchId: id, status: 'PUBLISHED' });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  if (identity.role !== 'admin' && identity.role !== 'student-affair') {
    return NextResponse.json({ message: 'Not authorized' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createServerSupabase() as unknown as SupabaseClient;

  const { data: rows } = await supabase
    .from('exam_results')
    .select('id, storage_path')
    .eq('batch_id', id);

  const paths = (rows ?? []).map((r) => r.storage_path).filter(Boolean);
  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }

  if (rows && rows.length > 0) {
    await supabase.from('exam_results').delete().in('id', rows.map((r) => r.id));
  }

  const { error: delErr } = await supabase.from('exam_result_batches').delete().eq('id', id);
  if (delErr) return NextResponse.json({ message: delErr.message }, { status: 500 });
  return NextResponse.json({ deleted: (rows ?? []).length });
}
