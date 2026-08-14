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
  const { content } = (await request.json().catch(() => ({ content: '' }))) as { content?: string };
  const text = (content ?? '').trim();
  if (!text) return NextResponse.json({ message: 'Empty message' }, { status: 400 });

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
      created_at: now,
    })
    .select()
    .single();
  if (error || !message) return NextResponse.json({ message: error?.message || 'Send failed' }, { status: 500 });

  await supabase.from('conversations').update({ last_message_at: now }).eq('id', id);

  const other = conv.participant_ids.find((e: string) => e !== identity.email);
  if (other) {
    await supabase.from('notifications').insert({
      recipient_email: other,
      type: 'message',
      message: `New message from ${identity.name}`,
      created_at: now,
    });
  }

  return NextResponse.json(message, { status: 201 });
}
