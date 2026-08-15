import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

export const dynamic = 'force-dynamic';

const RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

export async function POST() {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const threshold = Date.now() - RETENTION_MS;
  const { error } = await supabase
    .from('notifications')
    .delete()
    .lt('created_at', threshold)
    .or(`recipient_email.ilike.${identity.email},and(recipient_email.is.null,recipient_role.eq.${identity.role})`);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
