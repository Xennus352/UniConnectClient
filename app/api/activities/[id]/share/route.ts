import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  if (!id) return NextResponse.json({ message: 'Missing activity id' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { recipients?: { email?: string; name?: string; initials?: string }[] };
  const recipients = (body.recipients ?? [])
    .map((r) => ({
      email: (r.email ?? '').trim().toLowerCase(),
      name: (r.name ?? '').trim() || (r.email ?? '').split('@')[0],
      initials: (r.initials ?? '').trim() || (r.email ?? '').slice(0, 2).toUpperCase(),
    }))
    .filter((r) => r.email && r.email !== identity.email);
  if (recipients.length === 0) {
    return NextResponse.json({ message: 'No recipients provided' }, { status: 400 });
  }

  const supabase = createServerSupabase() as unknown as SupabaseClient;

  const { data: activity, error: pErr } = await supabase
    .from('activities')
    .select('*')
    .eq('id', id)
    .single();
  if (pErr || !activity) return NextResponse.json({ message: pErr?.message || 'Activity not found' }, { status: 404 });

  const now = Date.now();
  const { data: share, error } = await supabase
    .from('activity_shares')
    .insert({
      activity_id: id,
      sharer_email: identity.email,
      sharer_name: identity.name,
      recipients,
      created_at: now,
    })
    .select()
    .single();
  if (error || !share) return NextResponse.json({ message: error?.message || 'Share failed' }, { status: 500 });

  await supabase
    .from('activities')
    .update({ shares_count: (activity.shares_count ?? 0) + recipients.length })
    .eq('id', id);

  const sharedAttachment = {
    kind: 'post' as const,
    post: {
      id: activity.id,
      content: activity.caption ?? `Shared an activity by ${activity.author_name}`,
      author_name: activity.author_name,
      image: activity.kind === 'photo' ? activity.media_url : null,
      created_at: activity.created_at,
      tags: [],
      activity: true,
    },
  };

  const convIds: string[] = [];
  const preview = `Shared an activity: ${(activity.caption ?? '').slice(0, 100)}`;

  for (const r of recipients) {
    const participant_ids = [identity.email, r.email].sort();

    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .contains('participant_ids', participant_ids)
      .maybeSingle();
    const match =
      existing &&
      existing.participant_ids.length === 2 &&
      existing.participant_ids.includes(identity.email) &&
      existing.participant_ids.includes(r.email)
        ? existing
        : null;

    let convId = match?.id ?? null;

    if (match) {
      if (match.status === 'blocked') continue;
      await supabase
        .from('conversations')
        .update({
          status: 'active',
          requested_by: identity.email,
          participant_meta: [
            { email: identity.email, name: identity.name, initials: identity.initials },
            { email: r.email, name: r.name, initials: r.initials },
          ],
          last_message_at: now,
        })
        .eq('id', match.id);
      convId = match.id;
    } else {
      const { data: created } = await supabase
        .from('conversations')
        .insert({
          participant_ids,
          status: 'active',
          requested_by: identity.email,
          participant_meta: [
            { email: identity.email, name: identity.name, initials: identity.initials },
            { email: r.email, name: r.name, initials: r.initials },
          ],
          created_at: now,
          last_message_at: now,
          preview,
        })
        .select('id')
        .single();
      if (!created) continue;
      convId = created.id;
    }

    if (!convId) continue;
    convIds.push(convId);

    await supabase.from('chat_messages').insert({
      conversation_id: convId,
      sender_email: identity.email,
      sender_name: identity.name,
      content: activity.caption ?? '',
      attachments: [sharedAttachment],
      created_at: now,
    });

    const unreadMap: Record<string, number> = {};
    unreadMap[r.email] = 1;
    await supabase
      .from('conversations')
      .update({ last_message_at: now, preview, unread_map: unreadMap })
      .eq('id', convId);
  }

  const rows = recipients.map((r) => ({
    recipient_email: r.email,
    type: 'share',
    message: `${identity.name} shared an activity with you`,
    actor_email: identity.email,
    actor_name: identity.name,
    activity_id: id,
    created_at: now,
  }));
  if (rows.length > 0) await supabase.from('notifications').insert(rows);

  return NextResponse.json({ ...share, conversations: convIds }, { status: 201 });
}