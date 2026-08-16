import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

export async function POST(request: Request) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { last_seen } = (await request.json().catch(() => ({}))) as { last_seen?: number };
  const ts = typeof last_seen === 'number' ? last_seen : Date.now();
  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { error } = await supabase
    .from('user_presence')
    .upsert({ email: identity.email, last_seen: ts, updated_at: Date.now() });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const email = new URL(request.url).searchParams.get('email');
  if (!email) return NextResponse.json({ last_seen: null });
  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { data } = await supabase.from('user_presence').select('last_seen').eq('email', email).maybeSingle();
  return NextResponse.json({ last_seen: data?.last_seen ?? null });
}