import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id } = await params;

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const now = Date.now();

  const { data: event } = await supabase.from('events').select('max_attendees').eq('id', id).single();
  if (!event) return NextResponse.json({ message: 'Event not found' }, { status: 404 });

  if (event.max_attendees) {
    const { count } = await supabase
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', id);
    if ((count ?? 0) >= event.max_attendees) {
      return NextResponse.json({ message: 'Event is full' }, { status: 400 });
    }
  }

  const { error } = await supabase.from('event_registrations').insert({
    event_id: id,
    user_email: identity.email,
    user_name: identity.name,
    created_at: now,
  });
  if (error) {
    return NextResponse.json(
      { message: error.code === '23505' ? 'You are already registered' : error.message },
      { status: error.code === '23505' ? 409 : 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id } = await params;

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { error } = await supabase
    .from('event_registrations')
    .delete()
    .eq('event_id', id)
    .eq('user_email', identity.email);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
