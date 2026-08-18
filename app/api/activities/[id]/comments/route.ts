import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { data, error } = await supabase
    .from('activity_comments')
    .select('*')
    .eq('activity_id', id)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const { content } = (await request.json().catch(() => ({ content: '' }))) as { content?: string };
  const text = (content ?? '').trim();
  if (!text) return NextResponse.json({ message: 'Empty comment' }, { status: 400 });

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { data: activity, error: pErr } = await supabase
    .from('activities')
    .select('author_email')
    .eq('id', id)
    .single();
  if (pErr || !activity) return NextResponse.json({ message: pErr?.message || 'Activity not found' }, { status: 404 });

  const now = Date.now();
  const { data: comment, error } = await supabase
    .from('activity_comments')
    .insert({
      activity_id: id,
      author_email: identity.email,
      author_name: identity.name,
      author_initials: identity.initials,
      content: text,
      created_at: now,
    })
    .select()
    .single();
  if (error || !comment) return NextResponse.json({ message: error?.message || 'Insert failed' }, { status: 500 });

  if (activity.author_email && activity.author_email !== identity.email) {
    await supabase.from('notifications').insert({
      recipient_email: activity.author_email,
      type: 'comment',
      message: `${identity.name} commented on your activity`,
      actor_email: identity.email,
      actor_name: identity.name,
      created_at: now,
    });
  }

  return NextResponse.json(comment, { status: 201 });
}