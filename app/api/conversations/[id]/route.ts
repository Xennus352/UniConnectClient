import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    name?: string;
    email?: string;
    participants?: { email: string; name: string; initials?: string }[];
  };
  const { action } = body;

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

  const rawMeta = conv.participant_meta as Array<{ email?: string; name?: string; initials?: string }> | null;
  const meta = Array.isArray(rawMeta) ? rawMeta : [];
  const isGroup = (conv.participant_ids?.length ?? 0) > 2 || meta.some((m) => m.email === '__GROUP__');
  // New groups store the creator in `requested_by`; older ones list the
  // creator as the first entry after the __GROUP__ marker.
  const creatorEmail = conv.requested_by
    ? conv.requested_by
    : (() => {
        const gi = meta.findIndex((m) => m.email === '__GROUP__');
        return gi >= 0 ? meta[gi + 1]?.email : '';
      })();
  const isCreator = identity.email === creatorEmail;

  if (action === 'rename') {
    if (!isGroup) return NextResponse.json({ message: 'Not a group conversation' }, { status: 400 });
    if (!isCreator) return NextResponse.json({ message: 'Only the group creator can rename this group' }, { status: 403 });
    const name = (body.name ?? '').trim();
    if (!name) return NextResponse.json({ message: 'Group name is required' }, { status: 400 });
    const newMeta = meta.map((m) =>
      m.email === '__GROUP__' ? { ...m, name, initials: name.slice(0, 2).toUpperCase() } : m
    );
    const { error } = await supabase.from('conversations').update({ participant_meta: newMeta }).eq('id', id);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'addMembers') {
    if (!isGroup) return NextResponse.json({ message: 'Not a group conversation' }, { status: 400 });
    if (!isCreator) return NextResponse.json({ message: 'Only the group creator can add members' }, { status: 403 });
    const adds = (body.participants ?? [])
      .map((p) => ({ ...p, email: (p.email ?? '').toLowerCase().trim() }))
      .filter((p) => p.email && p.email !== identity.email && !conv.participant_ids.includes(p.email));
    if (adds.length === 0) return NextResponse.json({ message: 'No new members to add' }, { status: 400 });
    const participant_ids = [...conv.participant_ids, ...adds.map((a) => a.email)];
    const newMeta = [
      ...meta,
      ...adds.map((a) => ({
        email: a.email,
        name: a.name || a.email.split('@')[0],
        initials: a.initials || a.email.slice(0, 2).toUpperCase(),
      })),
    ];
    const { error } = await supabase.from('conversations').update({ participant_ids, participant_meta: newMeta }).eq('id', id);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'removeMember') {
    if (!isGroup) return NextResponse.json({ message: 'Not a group conversation' }, { status: 400 });
    if (!isCreator) return NextResponse.json({ message: 'Only the group creator can remove members' }, { status: 403 });
    const email = (body.email ?? '').toLowerCase().trim();
    if (!email) return NextResponse.json({ message: 'Member email is required' }, { status: 400 });
    if (email === identity.email) return NextResponse.json({ message: 'You cannot remove yourself — delete the group instead' }, { status: 400 });
    if (email === creatorEmail) return NextResponse.json({ message: 'Cannot remove the group creator' }, { status: 400 });
    if (!conv.participant_ids.includes(email)) return NextResponse.json({ message: 'Not a group member' }, { status: 400 });
    const participant_ids = conv.participant_ids.filter((e: string) => e !== email);
    const newMeta = meta.filter((m) => m.email !== email);
    const { error } = await supabase.from('conversations').update({ participant_ids, participant_meta: newMeta }).eq('id', id);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

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
        conversation_id: id,
        actor_email: identity.email,
        actor_name: identity.name,
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

  if (action === 'hide' || action === 'unhide') {
    const hiddenMap = { ...((conv.hidden_map ?? {}) as Record<string, number>) };
    if (action === 'hide') hiddenMap[identity.email] = Date.now();
    else delete hiddenMap[identity.email];
    const { error } = await supabase.from('conversations').update({ hidden_map: hiddenMap }).eq('id', id);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'leave') {
    if (!isGroup) return NextResponse.json({ message: 'Not a group conversation' }, { status: 400 });
    if (isCreator) {
      return NextResponse.json({ message: 'The group creator cannot leave — delete the group instead' }, { status: 400 });
    }
    const participant_ids = (conv.participant_ids as string[]).filter((e) => e !== identity.email);
    const newMeta = meta.filter((m) => m.email !== identity.email);
    if (participant_ids.length === 0) {
      const { error } = await supabase.from('conversations').delete().eq('id', id);
      if (error) return NextResponse.json({ message: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    const { error } = await supabase.from('conversations').update({ participant_ids, participant_meta: newMeta }).eq('id', id);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ message: 'Unknown action' }, { status: 400 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const rawMeta = conv.participant_meta as Array<{ email?: string; name?: string; initials?: string }> | null;
  const meta = Array.isArray(rawMeta) ? rawMeta : [];
  const isGroup = (conv.participant_ids?.length ?? 0) > 2 || meta.some((m) => m.email === '__GROUP__');
  if (!isGroup) return NextResponse.json({ message: 'Only group conversations can be deleted' }, { status: 400 });
  const creatorEmail = conv.requested_by
    ? conv.requested_by
    : (() => {
        const gi = meta.findIndex((m) => m.email === '__GROUP__');
        return gi >= 0 ? meta[gi + 1]?.email : '';
      })();
  if (creatorEmail !== identity.email) {
    return NextResponse.json({ message: 'Only the group creator can delete this group' }, { status: 403 });
  }

  const { error } = await supabase.from('conversations').delete().eq('id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
