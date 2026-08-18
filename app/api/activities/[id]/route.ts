import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as { caption?: unknown };
  if (typeof body.caption !== 'string') {
    return NextResponse.json({ message: 'Caption is required' }, { status: 400 });
  }
  const caption = body.caption.trim().slice(0, 500);

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { data: activity, error: fetchErr } = await supabase
    .from('activities')
    .select('author_email')
    .eq('id', id)
    .single();
  if (fetchErr || !activity) return NextResponse.json({ message: fetchErr?.message || 'Activity not found' }, { status: 404 });
  if (activity.author_email !== identity.email) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase.from('activities').update({ caption }).eq('id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id } = await params;

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { data: activity, error: fetchErr } = await supabase
    .from('activities')
    .select('author_email')
    .eq('id', id)
    .single();
  if (fetchErr || !activity) return NextResponse.json({ message: fetchErr?.message || 'Activity not found' }, { status: 404 });

  if (activity.author_email !== identity.email && identity.role !== 'admin' && identity.role !== 'student-affair') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase.from('activities').delete().eq('id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}