import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

const CATEGORIES = ['Sports', 'Academic', 'Cultural', 'Other'];

export async function POST(request: Request) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  if (identity.role !== 'admin' && identity.role !== 'student-affair') {
    return NextResponse.json({ message: 'Only admins and student affairs can create events' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    description?: unknown;
    location?: unknown;
    eventDate?: unknown;
    category?: unknown;
    maxAttendees?: unknown;
  } | null;

  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const eventDate = typeof body?.eventDate === 'number' && Number.isFinite(body.eventDate) ? body.eventDate : null;
  if (!title) return NextResponse.json({ message: 'Event title is required' }, { status: 400 });
  if (!eventDate) return NextResponse.json({ message: 'Event date is required' }, { status: 400 });

  const description = typeof body?.description === 'string' ? body.description.trim() : null;
  const location = typeof body?.location === 'string' ? body.location.trim() : null;
  const category = typeof body?.category === 'string' && CATEGORIES.includes(body.category) ? body.category : 'Other';
  const maxAttendees =
    typeof body?.maxAttendees === 'number' && Number.isFinite(body.maxAttendees) && body.maxAttendees > 0
      ? Math.floor(body.maxAttendees)
      : null;

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const now = Date.now();

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      title,
      description,
      location,
      event_date: eventDate,
      category,
      max_attendees: maxAttendees,
      created_by: identity.email,
      created_by_name: identity.name,
      created_at: now,
    })
    .select()
    .single();

  if (error || !event) return NextResponse.json({ message: error?.message || 'Insert failed' }, { status: 500 });

  await supabase.from('notifications').insert({
    recipient_role: 'student',
    type: 'event',
    message: `New event: ${title}`,
    created_at: now,
  });

  return NextResponse.json({ event }, { status: 201 });
}
