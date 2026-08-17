import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Server-side service-role requests can also move multi-MB base64 images
// (e.g. moderation/admin operations), so keep a hang guard but with a sane
// budget. Never discard a caller-supplied signal.
const REQUEST_TIMEOUT_MS = 15000;

function timeoutFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;
  return fetch(input, { ...init, signal });
}

export function createServerSupabase() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'public' },
      global: { fetch: timeoutFetch },
    }
  );
}
