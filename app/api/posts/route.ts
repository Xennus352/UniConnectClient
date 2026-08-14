import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';
import { moderateContent } from '@/utils/moderate';


export async function POST(request: Request) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    content?: string;
    image?: string | null;
    tags?: unknown;
    item_status?: unknown;
    item_location?: unknown;
  } | null;
  const content = (body?.content ?? '').trim();
  if (!body || (!content && !body.image)) {
    return NextResponse.json({ message: 'Write something or add a photo first' }, { status: 400 });
  }

  const item_status = body.item_status === 'lost' || body.item_status === 'found' ? body.item_status : null;
  const item_location =
    typeof body.item_location === 'string' && body.item_location.trim()
      ? body.item_location.trim().slice(0, 60)
      : null;

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const now = Date.now();

  // AI content filter runs BEFORE the post is stored (filter before upload).
  // Flagged content is never uploaded to the feed.
  const moderate = await moderateContent(content, body.image ?? null);
  if (!moderate.safe) {
    return NextResponse.json(
      { message: `Your post was flagged by the AI content filter${moderate.reason ? `: ${moderate.reason}` : ''}` },
      { status: 422 }
    );
  }

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      author_email: identity.email,
      author_name: identity.name,
      author_initials: identity.initials,
      author_role: identity.role,
      content,
      image: body.image ?? null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      item_status,
      item_location,
      status: 'pending_review',
      ai_flags: null,
      moderation_note: null,
      created_at: now,
    })
    .select()
    .single();

  if (error || !post) return NextResponse.json({ message: error?.message || 'Insert failed' }, { status: 500 });

  // Notify admins (post awaits moderation).
  await supabase.from('notifications').insert({
    recipient_role: 'admin',
    type: 'moderation',
    message: `New post by ${identity.name} is awaiting moderation`,
    post_id: post.id,
    created_at: now,
  });

  return NextResponse.json({ post, status: 'pending_review' }, { status: 201 });
}

export async function GET() {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  // (unused: GET is server-side only for create; the browser reads the feed directly)
  return NextResponse.json({ message: 'Use the /posts feed client' }, { status: 200 });
}
