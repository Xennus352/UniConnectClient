import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const { action } = (await request.json().catch(() => ({}))) as { action?: string };

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { data: conv, error: cErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single();
  if (cErr || !conv) return NextResponse.json({ message: cErr?.message || 'Conversation not found' }, { status: 404 });

  const isParticipant = conv.participant_ids.includes(identity.email);
  if (!isParticipant) return NextResponse.json({ message: 'Not a participant' }, { status: 403 });

  const meIsRequester = conv.requested_by === identity.email;
  const now = Date.now();

  if (action === 'accept') {
    if (meIsRequester) return NextResponse.json({ message: "You can't accept your own request" }, { status: 400 });
    const { error } = await supabase.from('conversations').update({ status: 'active', requested_by: null }).eq('id', id);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    // notify requester
    if (conv.requested_by) {
      await supabase.from('notifications').insert({
        recipient_email: conv.requested_by,
        type: 'message',
        message: `${identity.name} accepted your message request`,
        created_at: now,
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'reject') {
    if (meIsRequester) return NextResponse.json({ message: "You can't decline your own request" }, { status: 400 });
    const { error } = await supabase.from('conversations').delete().eq('id', id);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'block') {
    const { error } = await supabase.from('conversations').update({ status: 'blocked', blocked_by: identity.email }).eq('id', id);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'unblock') {
    const { data: cur } = await supabase.from('conversations').select('*').eq('id', id).single();
    if (cur?.blocked_by !== identity.email) {
      return NextResponse.json({ message: 'Only the blocker can unblock' }, { status: 403 });
    }
    const { error } = await supabase.from('conversations').update({ status: 'active', blocked_by: null }).eq('id', id);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ message: 'Unknown action' }, { status: 400 });
}
