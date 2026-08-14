import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ message: 'Missing comment id' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { content?: string };
  const text = (body.content ?? '').trim();
  if (!text) return NextResponse.json({ message: 'Empty comment' }, { status: 400 });

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { data: comment, error: fetchErr } = await supabase
    .from('post_comments')
    .select('author_email, post_id')
    .eq('id', id)
    .single();
  if (fetchErr || !comment) return NextResponse.json({ message: fetchErr?.message || 'Comment not found' }, { status: 404 });

  if (comment.author_email !== identity.email && identity.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { error: updErr } = await supabase.from('post_comments').update({ content: text }).eq('id', id);
  if (updErr) return NextResponse.json({ message: updErr.message }, { status: 500 });

  // updated_at drives the "edited" flag. Best-effort: ignore the error in
  // case the column migration hasn't been applied yet.
  await supabase.from('post_comments').update({ updated_at: Date.now() }).eq('id', id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ message: 'Missing comment id' }, { status: 400 });

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { data: comment, error: fetchErr } = await supabase
    .from('post_comments')
    .select('author_email, post_id')
    .eq('id', id)
    .single();
  if (fetchErr || !comment) return NextResponse.json({ message: fetchErr?.message || 'Comment not found' }, { status: 404 });

  if (comment.author_email !== identity.email && identity.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { error: delErr } = await supabase.from('post_comments').delete().eq('id', id);
  if (delErr) return NextResponse.json({ message: delErr.message }, { status: 500 });

  const { data: post } = await supabase
    .from('posts')
    .select('comments_count')
    .eq('id', comment.post_id)
    .single();
  if (post) {
    await supabase
      .from('posts')
      .update({ comments_count: Math.max((post.comments_count ?? 0) - 1, 0) })
      .eq('id', comment.post_id);
  }

  return NextResponse.json({ ok: true });
}
