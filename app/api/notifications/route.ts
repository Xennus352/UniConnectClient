import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

export async function GET() {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const supabase = createServerSupabase() as unknown as SupabaseClient;

  const mine = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_email', identity.email)
    .order('created_at', { ascending: false })
    .limit(50);

  let roleNotifications: { data: any[] | null; error: null | { message: string } } = { data: [], error: null };
  if (identity.role === 'admin') {
    roleNotifications = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_role', 'admin')
      .is('recipient_email', null)
      .order('created_at', { ascending: false })
      .limit(50);
  }

  if (mine.error) return NextResponse.json({ message: mine.error.message }, { status: 500 });
  const merged = [...(mine.data ?? []), ...(roleNotifications.data ?? [])].sort((a, b) => b.created_at - a.created_at);
  return NextResponse.json(merged);
}

export async function PATCH(request: Request) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const supabase = createServerSupabase() as unknown as SupabaseClient;
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('recipient_email', identity.email);
  if (identity.role === 'admin') {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('recipient_role', 'admin')
      .is('recipient_email', null);
  }
  return NextResponse.json({ ok: true });
}