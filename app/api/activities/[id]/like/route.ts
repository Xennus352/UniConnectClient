import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  if (!id) return NextResponse.json({ message: 'Missing activity id' }, { status: 400 });

  const supabase = createServerSupabase() as unknown as SupabaseClient;

  const { data: activity, error: pErr } = await supabase
    .from('activities')
    .select('author_email')
    .eq('id', id)
    .single();
  if (pErr || !activity) return NextResponse.json({ message: pErr?.message || 'Activity not found' }, { status: 404 });

  const { data: existing, error: dupErr } = await supabase
    .from('activity_likes')
    .select('id')
    .eq('activity_id', id)
    .eq('user_email', identity.email)
    .maybeSingle();
  if (dupErr) return NextResponse.json({ message: dupErr.message }, { status: 500 });

  if (existing) {
    await supabase.from('activity_likes').delete().eq('id', existing.id);
    return NextResponse.json({ liked: false });
  }

  await supabase.from('activity_likes').insert({ activity_id: id, user_email: identity.email, created_at: Date.now() });

  if (activity.author_email && activity.author_email !== identity.email) {
    await supabase.from('notifications').insert({
      recipient_email: activity.author_email,
      type: 'like',
      message: `${identity.name} liked your activity`,
      actor_email: identity.email,
      actor_name: identity.name,
      created_at: Date.now(),
    });
  }

  return NextResponse.json({ liked: true });
}