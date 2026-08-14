'use client';

import { useEffect, useRef, useState } from 'react';

export interface UniversityData<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const DEFAULT_POLL_MS = 15000;

export function useUniversityData<T>(
  fetcher: () => Promise<T>,
  pollMs: number = DEFAULT_POLL_MS
): UniversityData<T> {
  const [state, setState] = useState<UniversityData<T>>({
    data: null,
    loading: true,
    error: null,
    refresh: () => {},
  });
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const run = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const data = await fetcherRef.current();
        if (!cancelled) setState({ data, loading: false, error: null, refresh: () => setTick((t) => t + 1) });
      } catch {
        if (!cancelled) {
          setState((s) => ({ data: s.data, loading: false, error: 'University server unreachable', refresh: () => setTick((t) => t + 1) }));
        }
      } finally {
        inFlight = false;
      }
    };

    run();
    const id = setInterval(run, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs, tick]);

  return state;
}
