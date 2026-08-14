import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

const GROUP_META_EMAIL = '__GROUP__';

interface GroupParticipant {
  email: string;
  name: string;
  initials: string;
}

// Create or open a conversation. A NEW 1:1 conversation starts as `pending`
// (a message request); existing ones return their current status. Group
// conversations are created `active` immediately with no message request.
export async function POST(request: Request) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    type?: 'direct' | 'group';
    otherEmail?: string;
    otherName?: string;
    otherInitials?: string;
    groupName?: string;
    participants?: GroupParticipant[];
  };

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const now = Date.now();

  if (body.type === 'group') {
    const name = (body.groupName ?? '').trim();
    const participants = Array.isArray(body.participants) ? body.participants : [];
    if (!name) return NextResponse.json({ message: 'Group name is required' }, { status: 400 });

    const emails = [
      ...new Set(
        participants
          .map((p) => (p.email ?? '').toLowerCase())
          .filter((e) => e && e !== identity.email.toLowerCase())
      ),
    ];
    if (emails.length < 1) return NextResponse.json({ message: 'Select at least one member' }, { status: 400 });

    const participant_ids = [identity.email, ...emails].sort();
    const memberMeta: GroupParticipant[] = [];
    for (const p of participants) {
      const email = (p.email ?? '').toLowerCase();
      if (!email || !emails.includes(email)) continue;
      if (memberMeta.some((m) => m.email === email)) continue;
      memberMeta.push({ email, name: p.name || email.split('@')[0], initials: p.initials || email.slice(0, 2).toUpperCase() });
    }
    const participant_meta = [
      { email: GROUP_META_EMAIL, name, initials: name.slice(0, 2).toUpperCase() },
      { email: identity.email, name: identity.name, initials: identity.initials },
      ...memberMeta,
    ];

    const { data: conv, error } = await supabase
      .from('conversations')
      .insert({
        participant_ids,
        status: 'active',
        requested_by: identity.email,
        participant_meta,
        created_at: now,
        last_message_at: now,
      })
      .select()
      .single();
    if (error || !conv) return NextResponse.json({ message: error?.message || 'Create failed' }, { status: 500 });
    return NextResponse.json({ conversationId: conv.id, status: 'active' }, { status: 201 });
  }

  const { otherEmail, otherName, otherInitials } = body;
  if (!otherEmail || otherEmail.toLowerCase() === identity.email.toLowerCase()) {
    return NextResponse.json({ message: 'Invalid participant' }, { status: 400 });
  }

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
