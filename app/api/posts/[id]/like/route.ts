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

  const supabase = createServerSupabase() as unknown as SupabaseClient;

  const { data: post, error: pErr } = await supabase
    .from('posts')
    .select('author_email, likes_count')
    .eq('id', id)
    .single();
  if (pErr || !post) return NextResponse.json({ message: pErr?.message || 'Post not found' }, { status: 404 });

  const { data: existing, error: dupErr } = await supabase
    .from('post_likes')
    .select('id')
    .eq('post_id', id)
    .eq('user_email', identity.email)
    .maybeSingle();
  if (dupErr) return NextResponse.json({ message: dupErr.message }, { status: 500 });

  if (existing) {
    await supabase.from('post_likes').delete().eq('id', existing.id);
    await supabase
      .from('posts')
      .update({ likes_count: Math.max((post.likes_count ?? 0) - 1, 0) })
      .eq('id', id);
    return NextResponse.json({ liked: false });
  }

  await supabase.from('post_likes').insert({ post_id: id, user_email: identity.email, created_at: Date.now() });
  await supabase
    .from('posts')
    .update({ likes_count: (post.likes_count ?? 0) + 1 })
    .eq('id', id);

  if (post.author_email && post.author_email !== identity.email) {
    await supabase.from('notifications').insert({
      recipient_email: post.author_email,
      type: 'like',
      message: `${identity.name} liked your post`,
      post_id: id,
      actor_email: identity.email,
      actor_name: identity.name,
      created_at: Date.now(),
    });
  }

  return NextResponse.json({ liked: true });
}
