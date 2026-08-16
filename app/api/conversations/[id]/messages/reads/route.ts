import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/utils/supabase/server';
import { getSessionIdentity } from '@/utils/supabase/auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity();
  if (!identity) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const supabase = createServerSupabase() as unknown as SupabaseClient;

  const { data: conv, error: cErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single();
  if (cErr || !conv) return NextResponse.json({ message: cErr?.message || 'Conversation not found' }, { status: 404 });
  if (!conv.participant_ids.includes(identity.email)) {
    return NextResponse.json({ message: 'Not a participant' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('message_reads')
    .select('*')
    .eq('conversation_id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}