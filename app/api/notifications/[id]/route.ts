import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const supabase = createServerSupabase() as unknown as SupabaseClient;
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .or(`and(recipient_email.ilike.${identity.email}),and(recipient_email.is.null,recipient_role.eq.${identity.role})`)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, notification: data });
}