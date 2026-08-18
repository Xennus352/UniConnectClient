'use client';

import { useEffect, useState } from 'react';

export type PostVideoPhase = 'downloading' | 'retrying' | 'done' | 'empty' | 'failed';

export interface PostVideoState {
  src: string | null;
  phase: PostVideoPhase;
  progress: number;
  attemptsLeft: number;
}

const ATTEMPT_TIMEOUT_MS = 120000;
const MAX_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 800;

const objectUrlCache = new Map<string, string>();

function cacheVideoObjectUrl(url: string, objectUrl: string): void {
  objectUrlCache.set(url, objectUrl);
}

function getCachedVideoObjectUrl(url: string): string | undefined {
  return objectUrlCache.get(url);
}

async function downloadVideo(
  url: string,
  onProgress: (pct: number) => void,
  signal: AbortSignal
): Promise<string> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length') ?? 0);
  if (!res.body) throw new Error('No response body');
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
  return URL.createObjectURL(new Blob(chunks as unknown as BlobPart[], { type: 'video/mp4' }));
}

export function usePostVideoDownload(videoUrl: string | null): PostVideoState {
  const cached = videoUrl ? getCachedVideoObjectUrl(videoUrl) : undefined;
  const [src, setSrc] = useState<string | null>(cached ?? null);
  const [phase, setPhase] = useState<PostVideoPhase>(cached ? 'done' : videoUrl ? 'downloading' : 'empty');
  const [progress, setProgress] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);

  useEffect(() => {
    if (!videoUrl) return;
    if (getCachedVideoObjectUrl(videoUrl)) return;
    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      let attempt = 1;
      for (;;) {
        if (cancelled) return;
        setPhase('downloading');
        setProgress(0);
        try {
          const objectUrl = await downloadVideo(
            videoUrl,
            setProgress,
            AbortSignal.any([controller.signal, AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)])
          );
          if (cancelled) {
            URL.revokeObjectURL(objectUrl);
            return;
          }
          cacheVideoObjectUrl(videoUrl, objectUrl);
          setSrc(objectUrl);
          setPhase('done');
          return;
        } catch {
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
  }, [videoUrl]);

  return { src, phase, progress, attemptsLeft };
}