import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

function isMissingColumnError(err: unknown): boolean {
  const e = (err ?? {}) as { code?: string | number; message?: string };
  const msg = typeof e.message === 'string' ? e.message : '';
  return (
    e.code === '42703' ||
    e.code === 'PGRST204' ||
    /could not find the .* column|column .* not found|not found in the schema cache|does not exist|no such column|column .* was not found/i.test(msg)
  );
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; messageId: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id, messageId } = await params;
  const { content } = (await request.json().catch(() => ({ content: undefined }))) as { content?: string };
  const text = (content ?? '').trim();
  if (!text) return NextResponse.json({ message: 'Empty message' }, { status: 400 });

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { data: msg, error: mErr } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('id', messageId)
    .eq('conversation_id', id)
    .single();
  if (mErr || !msg) return NextResponse.json({ message: mErr?.message || 'Message not found' }, { status: 404 });
  if (msg.sender_email !== identity.email) {
    return NextResponse.json({ message: 'Only the sender can edit this message' }, { status: 403 });
  }
  if (msg.is_deleted) return NextResponse.json({ message: 'This message was deleted' }, { status: 409 });

  const { error: uErr } = await supabase
    .from('chat_messages')
    .update({ content: text, edited_at: Date.now() })
    .eq('id', messageId);
  if (uErr) {
    if (isMissingColumnError(uErr)) {
      const { error: fbErr } = await supabase
        .from('chat_messages')
        .update({ content: text })
        .eq('id', messageId);
      if (fbErr) return NextResponse.json({ message: fbErr.message }, { status: 500 });
    } else {
      return NextResponse.json({ message: uErr.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; messageId: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id, messageId } = await params;

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { data: msg, error: mErr } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('id', messageId)
    .eq('conversation_id', id)
    .single();
  if (mErr || !msg) return NextResponse.json({ message: mErr?.message || 'Message not found' }, { status: 404 });
  if (msg.sender_email !== identity.email) {
    return NextResponse.json({ message: 'Only the sender can delete this message' }, { status: 403 });
  }

  const { error: uErr } = await supabase
    .from('chat_messages')
    .update({ is_deleted: true, content: '' })
    .eq('id', messageId);
  if (uErr) {
    if (isMissingColumnError(uErr)) {
      const { error: fbErr } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId);
      if (fbErr) return NextResponse.json({ message: fbErr.message }, { status: 500 });
    } else {
      return NextResponse.json({ message: uErr.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}