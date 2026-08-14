import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

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
