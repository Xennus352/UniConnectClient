import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  if (identity.role !== 'admin' && identity.role !== 'student-affair') {
    return NextResponse.json({ message: 'Only admins and student affairs can change event visibility' }, { status: 403 });
  }
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as { visibility?: unknown };
  if (body.visibility !== 'public' && body.visibility !== 'private') {
    return NextResponse.json({ message: 'Visibility must be "public" or "private"' }, { status: 400 });
  }

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { data: event, error: fetchErr } = await supabase
    .from('events')
    .select('id, visibility')
    .eq('id', id)
    .single();
  if (fetchErr || !event) return NextResponse.json({ message: fetchErr?.message || 'Event not found' }, { status: 404 });
  if (event.visibility === body.visibility) return NextResponse.json({ ok: true, unchanged: true });

  const { error } = await supabase.from('events').update({ visibility: body.visibility }).eq('id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, visibility: body.visibility });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id } = await params;

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { data: event } = await supabase.from('events').select('created_by').eq('id', id).single();
  const canDelete =
    identity.role === 'admin' ||
    identity.role === 'student-affair' ||
    event?.created_by === identity.email;
  if (!canDelete) return NextResponse.json({ message: 'Not allowed' }, { status: 403 });

  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
