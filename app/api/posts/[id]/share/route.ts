import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  if (!id) return NextResponse.json({ message: 'Missing post id' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { recipients?: { email?: string; name?: string }[] };
  const recipients = (body.recipients ?? [])
    .map((r) => ({ email: (r.email ?? '').trim().toLowerCase(), name: (r.name ?? '').trim() || (r.email ?? '').split('@')[0] }))
    .filter((r) => r.email && r.email !== identity.email);
  if (recipients.length === 0) {
    return NextResponse.json({ message: 'No recipients provided' }, { status: 400 });
  }

  const supabase = createServerSupabase() as unknown as SupabaseClient;

  const { data: post, error: pErr } = await supabase
    .from('posts')
    .select('shares_count')
    .eq('id', id)
    .single();
  if (pErr || !post) return NextResponse.json({ message: pErr?.message || 'Post not found' }, { status: 404 });

  const now = Date.now();
  const { data: share, error } = await supabase
    .from('post_shares')
    .insert({
      post_id: id,
      sharer_email: identity.email,
      sharer_name: identity.name,
      recipients,
      created_at: now,
    })
    .select()
    .single();
  if (error || !share) return NextResponse.json({ message: error?.message || 'Share failed' }, { status: 500 });

  await supabase
    .from('posts')
    .update({ shares_count: (post.shares_count ?? 0) + 1 })
    .eq('id', id);

  const rows = recipients.map((r) => ({
    recipient_email: r.email,
    type: 'share',
    message: `${identity.name} shared a post with you`,
    created_at: now,
  }));
  if (rows.length > 0) await supabase.from('notifications').insert(rows);

  return NextResponse.json(share, { status: 201 });
}
