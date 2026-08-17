import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/utils/supabase/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export type TypedSupabaseClient = SupabaseClient<Database>;

// The feed transfers full-size base64 images inline (a single post can be
// several MB), so a tight timeout aborts legitimate slow transfers and
// surfaces as "The user aborted a request" (the timeout hint). 30s is a
// hang guard, not a latency target.
const REQUEST_TIMEOUT_MS = 30000;

function timeoutFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;
  return fetch(input, { ...init, signal });
}

let browserClient: TypedSupabaseClient | null = null;

export function getSupabaseBrowser(): TypedSupabaseClient {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: timeoutFetch } }
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
