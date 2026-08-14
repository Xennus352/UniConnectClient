import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export function createServerSupabase() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persist: false },
      db: { schema: 'public' },
    }
  );
}
