import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ message: 'Missing post id' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { content?: string; status?: string; moderationNote?: string };

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { data: post, error: fetchErr } = await supabase
    .from('posts')
    .select('author_email')
    .eq('id', id)
    .single();
  if (fetchErr || !post) return NextResponse.json({ message: fetchErr?.message || 'Post not found' }, { status: 404 });

  const patch: Record<string, unknown> = {};
  let contentEdited = false;

  if (body.content !== undefined) {
    const text = String(body.content).trim();
    if (!text) return NextResponse.json({ message: 'Empty content' }, { status: 400 });
    if (post.author_email !== identity.email) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    patch['content'] = text;
    contentEdited = true;
  }

  if (body.status !== undefined || body.moderationNote !== undefined) {
    if (identity.role !== 'admin') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    if (body.status !== undefined) patch['status'] = body.status;
    if (body.moderationNote !== undefined) patch['moderation_note'] = body.moderationNote;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ message: 'Nothing to update' }, { status: 400 });
  }

  const { error: updErr } = await supabase.from('posts').update(patch).eq('id', id);
  if (updErr) return NextResponse.json({ message: updErr.message }, { status: 500 });

  if (contentEdited) {
    // updated_at drives the "edited" flag. Best-effort: ignore the error in
    // case the column migration hasn't been applied yet.
    await supabase.from('posts').update({ updated_at: Date.now() }).eq('id', id);
  }

  if (post.author_email && body.status !== undefined) {
    await supabase.from('notifications').insert({
      recipient_email: post.author_email,
      type: 'moderation',
      message:
        body.status === 'approved'
          ? 'Your post was approved and published'
          : `Your post was rejected${body.moderationNote ? `: ${body.moderationNote}` : ''}`,
      created_at: Date.now(),
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ message: 'Missing post id' }, { status: 400 });

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { data: post, error: fetchErr } = await supabase
    .from('posts')
    .select('author_email')
    .eq('id', id)
    .single();
  if (fetchErr || !post) return NextResponse.json({ message: fetchErr?.message || 'Post not found' }, { status: 404 });

  if (post.author_email !== identity.email && identity.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { error: delErr } = await supabase.from('posts').delete().eq('id', id);
  if (delErr) return NextResponse.json({ message: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
