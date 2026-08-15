import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

export async function POST(request: Request) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const entries: { id: string; examType?: string }[] = Array.isArray(body?.results) ? body.results : [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const e of entries) {
    const id = typeof e?.id === 'string' ? e.id : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  if (ids.length === 0) return NextResponse.json({ created: 0 });

  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { data: existing } = await supabase
    .from('notifications')
    .select('post_id')
    .eq('recipient_email', identity.email)
    .eq('type', 'exam-result')
    .in('post_id', ids);

  const have = new Set((existing ?? []).map((n) => n.post_id));
  const toCreate = entries.filter((e) => ids.includes(e.id) && !have.has(e.id));

  let created = 0;
  if (toCreate.length > 0) {
    const now = Date.now();
    const { error } = await supabase.from('notifications').insert(
      toCreate.map((e) => ({
        recipient_email: identity.email,
        type: 'exam-result',
        message: e.examType
          ? `Your ${e.examType} results are now available in your inbox`
          : 'Your exam results are now available in your inbox',
        post_id: e.id,
        created_at: now,
        read: false,
      }))
    );
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    created = toCreate.length;
  }

  return NextResponse.json({ created });
}
