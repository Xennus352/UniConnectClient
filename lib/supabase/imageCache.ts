// In-memory cache for lazy-loaded post images.
//
// Post images are inline base64 data URLs (up to ~2 MB each), so re-downloading
// them on every feed mount wastes bandwidth and makes navigation back to the
// feed slow. Images never change after a post is approved, so a module-scope
// map keyed by post id is safe across mounts for the lifetime of the tab.
// The cache is byte-capped (FIFO eviction) so a long session can't balloon.

let totalBytes = 0;
const MAX_BYTES = 60 * 1024 * 1024;
const cache = new Map<string, string>();

export function getCachedImage(postId: string): string | undefined {
  return cache.get(postId);
}

export function cacheImage(postId: string, src: string): void {
  if (cache.has(postId)) return;
  const bytes = src.length;
  while (totalBytes + bytes > MAX_BYTES && cache.size > 0) {
    const oldest = cache.keys().next().value as string;
    totalBytes -= (cache.get(oldest) ?? '').length;
    cache.delete(oldest);
  }
  cache.set(postId, src);
  totalBytes += bytes;
}