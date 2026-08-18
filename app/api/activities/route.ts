import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

const KINDS = ['video', 'photo', 'text'];

export async function POST(request: Request) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  if (identity.role !== 'admin' && identity.role !== 'student-affair') {
    return NextResponse.json({ message: 'Only admins and student affairs can post activities' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    caption?: unknown;
    mediaUrl?: unknown;
  } | null;

  const kind = typeof body?.kind === 'string' && KINDS.includes(body.kind) ? body.kind : 'text';
  const caption = typeof body?.caption === 'string' ? body.caption.trim().slice(0, 500) : '';
  const mediaUrl =
    typeof body?.mediaUrl === 'string' && body.mediaUrl.trim().startsWith('https://')
      ? body.mediaUrl.trim().slice(0, 2048)
      : null;

  if (kind !== 'text' && !mediaUrl) {
    return NextResponse.json({ message: 'Please attach a video or photo' }, { status: 400 });
  }
  if (kind === 'text' && !caption) {
    return NextResponse.json({ message: 'Write something first' }, { status: 400 });
  }

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const now = Date.now();

  const { data: activity, error } = await supabase
    .from('activities')
    .insert({
      author_email: identity.email,
      author_name: identity.name,
      author_initials: identity.initials,
      author_role: identity.role,
      kind,
      caption: caption || null,
      media_url: mediaUrl,
      created_at: now,
    })
    .select()
    .single();

  if (error || !activity) return NextResponse.json({ message: error?.message || 'Insert failed' }, { status: 500 });

  await supabase.from('notifications').insert({
    recipient_role: 'student',
    type: 'event',
    message: `New activity: ${caption.slice(0, 80) || 'a new post is live'}`,
    created_at: now,
  });

  return NextResponse.json({ activity }, { status: 201 });
}