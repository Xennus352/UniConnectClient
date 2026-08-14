import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

// Create or open a conversation. A NEW conversation starts as `pending`
// (a message request). Existing ones return their current status.
export async function POST(request: Request) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { otherEmail, otherName, otherInitials } = (await request.json().catch(() => ({}))) as {
    otherEmail?: string;
    otherName?: string;
    otherInitials?: string;
  };
  if (!otherEmail || otherEmail.toLowerCase() === identity.email.toLowerCase()) {
    return NextResponse.json({ message: 'Invalid participant' }, { status: 400 });
  }

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const now = Date.now();
  const participant_ids = [identity.email, otherEmail].sort();

  const { data: existing, error: qErr } = await supabase
    .from('conversations')
    .select('*')
    .contains('participant_ids', participant_ids)
    .maybeSingle();
  // `.contains` matches either direction; verify both participants match:
  const match = (existing &&
    existing.participant_ids.length === 2 &&
    existing.participant_ids.includes(identity.email) &&
    existing.participant_ids.includes(otherEmail)) ? existing : null;

  const meta = [
    { email: identity.email, name: identity.name, initials: identity.initials },
    { email: otherEmail, name: otherName || otherEmail.split('@')[0], initials: otherInitials || otherEmail.slice(0, 2).toUpperCase() },
  ];

  if (match) {
    await supabase
      .from('conversations')
      .update({ last_message_at: now, participant_meta: meta })
      .eq('id', match.id);
    return NextResponse.json({ conversationId: match.id, status: match.status });
  }

  const { data: conv, error } = await supabase
    .from('conversations')
    .insert({
      participant_ids,
      status: 'pending',
      requested_by: identity.email,
      participant_meta: meta,
      created_at: now,
      last_message_at: now,
    })
    .select()
    .single();
  if (error || !conv) return NextResponse.json({ message: error?.message || 'Create failed' }, { status: 500 });
  return NextResponse.json({ conversationId: conv.id, status: conv.status }, { status: 201 });
}
