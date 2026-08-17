'use client';

import { useEffect, useState } from 'react';
import { getCachedImage, cacheImage } from './imageCache';

export type PostImagePhase = 'downloading' | 'retrying' | 'done' | 'empty' | 'failed';

export interface PostImageState {
  src: string | null;
  phase: PostImagePhase;
  progress: number;
  attemptsLeft: number;
}

// Post images are inline base64 data URLs in posts.image. The supabase-js
// client gives no progress events, so this fetches the row over the raw REST
// endpoint and streams the body, deriving percent from Content-Length. The
// transfer can take a while on a slow connection, so instead of giving up and
// showing "Image unavailable", it retries with backoff until the image is
// viewable (or genuinely fails after MAX_ATTEMPTS).
const ATTEMPT_TIMEOUT_MS = 60000;
const MAX_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 800;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  '';

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

async function downloadPostImage(
  postId: string,
  onProgress: (pct: number) => void,
  signal: AbortSignal
): Promise<string | null> {
  const url = `${SUPABASE_URL}/rest/v1/posts?select=image&id=eq.${postId}&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      Accept: 'application/json',
    },
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length') ?? 0);
  if (!res.body) {
    const data = await res.json();
    return Array.isArray(data) ? ((data[0] as { image?: string | null } | undefined)?.image ?? null) : null;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      if (total > 0) onProgress(Math.min(100, Math.round((received / total) * 100)));
    }
  }
  const text = new TextDecoder().decode(concatChunks(chunks));
  const data = JSON.parse(text) as unknown;
  return Array.isArray(data) ? ((data[0] as { image?: string | null } | undefined)?.image ?? null) : null;
}

export function usePostImageDownload(postId: string): PostImageState {
  const cached = getCachedImage(postId);
  const [src, setSrc] = useState<string | null>(cached ?? null);
  const [phase, setPhase] = useState<PostImagePhase>(cached ? 'done' : 'downloading');
  const [progress, setProgress] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);

  useEffect(() => {
    if (getCachedImage(postId)) return;
    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      let attempt = 1;
      for (;;) {
        if (cancelled) return;
        setPhase('downloading');
        setProgress(0);
        try {
          const image = await downloadPostImage(
            postId,
            setProgress,
            AbortSignal.any([controller.signal, AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)])
          );
          if (cancelled) return;
          if (!image) {
            setPhase('empty');
            return;
          }
          cacheImage(postId, image);
          setSrc(image);
          setPhase('done');
          return;
        } catch (err) {
          if (cancelled) return;
          if (attempt >= MAX_ATTEMPTS) {
            setPhase('failed');
            return;
          }
          setPhase('retrying');
          setAttemptsLeft(MAX_ATTEMPTS - attempt);
          await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * attempt));
          attempt += 1;
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [postId]);

  return { src, phase, progress, attemptsLeft };
}