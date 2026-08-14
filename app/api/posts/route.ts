import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';
import { moderateContent } from '@/utils/moderate';


export async function POST(request: Request) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { author_email: string; content: string; image?: string; tags?: any[]; author_name: string; author_initials: string; author_role: string } | null;
  if (!body?.author_email || !body.content) {
    return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
  }
  if (body.author_email !== identity.email) {
    return NextResponse.json({ message: 'Email does not match session' }, { status: 403 });
  }

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const now = Date.now();

  const moderate = await moderateContent(body.content, body.image ?? null);

  const status = moderate.safe ? 'pending_review' : 'rejected';
  const ai_flags = moderate.safe ? null : 'ai_filtered';
  const moderation_note = moderate.safe ? null : moderate.reason;

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      ...body,
      content: body.content,
      image: body.image ?? null,
      tags: body.tags ?? [],
      status,
      ai_flags,
      moderation_note,
      created_at: now,
    })
    .select()
    .single();

  if (error || !post) return NextResponse.json({ message: error?.message || 'Insert failed' }, { status: 500 });

  // Notify admins (post awaits moderation).
  await supabase.from('notifications').insert({
    recipient_role: 'admin',
    type: 'moderation',
    message: `New post by ${body.author_name} is awaiting moderation`,
    created_at: now,
  });

  return NextResponse.json({ post, status, ai_flags, moderation_note }, { status: 201 });
}

export async function GET() {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  // (unused: GET is server-side only for create; the browser reads the feed directly)
  return NextResponse.json({ message: 'Use the /posts feed client' }, { status: 200 });
}
