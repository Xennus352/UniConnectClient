'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UniversityData<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  mutate: (updater: (prev: T | null) => T | null) => void;
}

const DEFAULT_POLL_MS = 15000;

export function useUniversityData<T>(
  fetcher: () => Promise<T>,
  pollMs: number = DEFAULT_POLL_MS
): UniversityData<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  const resolveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const refresh = useCallback(() => {
    return new Promise<void>((resolve) => {
      resolveRef.current = resolve;
      setTick((t) => t + 1);
    });
  }, []);

  const mutate = useCallback((updater: (prev: T | null) => T | null) => {
    setData((prev) => updater(prev));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const finish = () => {
      resolveRef.current?.();
      resolveRef.current = null;
    };

    const run = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const next = await fetcherRef.current();
        if (!cancelled) {
          setData(next);
          setLoading(false);
          setError(null);
          finish();
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
          setError('University server unreachable');
          finish();
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

  return { data, loading, error, refresh, mutate };
}
