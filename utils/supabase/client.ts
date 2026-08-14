import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/utils/supabase/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export type TypedSupabaseClient = SupabaseClient<Database>;

let browserClient: TypedSupabaseClient | null = null;

export function getSupabaseBrowser(): TypedSupabaseClient {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as TypedSupabaseClient;
  return browserClient;
}

export function useSupabase(): TypedSupabaseClient {
  const [client, setClient] = useState<TypedSupabaseClient | null>(null);
  useEffect(() => {
    setClient(getSupabaseBrowser());
  }, []);
  if (!client) return getSupabaseBrowser();
  return client;
}
