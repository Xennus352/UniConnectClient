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
    .from('post_comments')
    .select('*')
    .eq('post_id', id)
    .is('deleted_at', null)
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
  const { data: post, error: pErr } = await supabase
    .from('posts')
    .select('author_email, comments_count')
    .eq('id', id)
    .single();
  if (pErr || !post) return NextResponse.json({ message: pErr?.message || 'Post not found' }, { status: 404 });

  const now = Date.now();
  const { data: comment, error } = await supabase
    .from('post_comments')
    .insert({
      post_id: id,
      author_email: identity.email,
      author_name: identity.name,
      author_initials: identity.initials,
      content: text,
      created_at: now,
    })
    .select()
    .single();
  if (error || !comment) return NextResponse.json({ message: error?.message || 'Insert failed' }, { status: 500 });

  await supabase
    .from('posts')
    .update({ comments_count: (post as any).comments_count + 1 })
    .eq('id', id);

  if (post.author_email && post.author_email !== identity.email) {
    await supabase.from('notifications').insert({
      recipient_email: post.author_email,
      type: 'comment',
      message: `${identity.name} commented on your post`,
      post_id: id,
      actor_email: identity.email,
      actor_name: identity.name,
      created_at: now,
    });
  }

  return NextResponse.json(comment, { status: 201 });
}
