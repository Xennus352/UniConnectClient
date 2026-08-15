import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const supabase = createServerSupabase() as unknown as SupabaseClient;

  const { data: conv, error: cErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single();
  if (cErr || !conv) return NextResponse.json({ message: cErr?.message || 'Conversation not found' }, { status: 404 });
  if (!conv.participant_ids.includes(identity.email)) {
    return NextResponse.json({ message: 'Not a participant' }, { status: 403 });
  }

  await supabase
    .from('chat_messages')
    .update({ is_read: true })
    .eq('conversation_id', id)
    .neq('sender_email', identity.email);

  const unreadMap = { ...((conv.unread_map ?? {}) as Record<string, number>) };
  unreadMap[identity.email] = 0;
  await supabase.from('conversations').update({ unread_map: unreadMap }).eq('id', id);
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { data: conv, error: cErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single();
  if (cErr || !conv) return NextResponse.json({ message: cErr?.message || 'Conversation not found' }, { status: 404 });
  if (!conv.participant_ids.includes(identity.email)) {
    return NextResponse.json({ message: 'Not a participant' }, { status: 403 });
  }
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const { content, attachments } = (await request.json().catch(() => ({ content: '', attachments: undefined }))) as {
    content?: string;
    attachments?: { name: string; size: number; mime: string; path: string }[];
  };
  const text = (content ?? '').trim();

  const atts = Array.isArray(attachments) ? attachments : [];
  if (atts.length > 0) {
    const invalid = atts.some(
      (a) =>
        !a ||
        typeof a.name !== 'string' ||
        typeof a.path !== 'string' ||
        !a.path.startsWith(`${id}/`) ||
        typeof a.size !== 'number' ||
        a.size <= 0 ||
        a.size > 20 * 1024 * 1024
    );
    if (invalid) return NextResponse.json({ message: 'Invalid attachment metadata' }, { status: 400 });
  }
  if (!text && atts.length === 0) return NextResponse.json({ message: 'Empty message' }, { status: 400 });

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { data: conv, error: cErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single();
  if (cErr || !conv) return NextResponse.json({ message: cErr?.message || 'Conversation not found' }, { status: 404 });

  if (!conv.participant_ids.includes(identity.email)) {
    return NextResponse.json({ message: 'Not a participant' }, { status: 403 });
  }
  if (conv.status === 'blocked') return NextResponse.json({ message: 'This conversation is blocked' }, { status: 409 });
  if (conv.status === 'pending') {
    return NextResponse.json({ message: 'Message request not accepted yet' }, { status: 409 });
  }

  const now = Date.now();
  const { data: message, error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: id,
      sender_email: identity.email,
      sender_name: identity.name,
      content: text,
      attachments: atts.length > 0 ? atts : undefined,
      created_at: now,
    })
    .select()
    .single();
  if (error || !message) return NextResponse.json({ message: error?.message || 'Send failed' }, { status: 500 });

  const others = (conv.participant_ids as string[]).filter((e) => e !== identity.email);
  const unreadMap = { ...((conv.unread_map ?? {}) as Record<string, number>) };
  for (const e of others) unreadMap[e] = (unreadMap[e] ?? 0) + 1;
  await supabase
    .from('conversations')
    .update({
      last_message_at: now,
      preview: (text || (atts.length > 0 ? '[Attachment]' : '')).slice(0, 140),
      unread_map: unreadMap,
    })
    .eq('id', id);

  if (others.length > 0) {
    await supabase.from('notifications').insert(
      others.map((email) => ({
        recipient_email: email,
        type: 'message',
        message: `New message from ${identity.name}`,
        conversation_id: id,
        actor_email: identity.email,
        actor_name: identity.name,
        created_at: now,
      }))
    );
  }

  return NextResponse.json(message, { status: 201 });
}
