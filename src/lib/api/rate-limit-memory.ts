/**
 * Simple in-memory sliding-window rate limiter for route handlers.
 * Resets when the process restarts; for multi-instance production use Redis or an edge limiter.
 */

type Bucket = { windowStartMs: number; count: number };

const buckets = new Map<string, Bucket>();

function prune(key: string, windowMs: number, now: number) {
  const b = buckets.get(key);
  if (!b) {
    return;
  }
  if (now - b.windowStartMs >= windowMs) {
    buckets.delete(key);
  }
}

export function checkRateLimit(
  key: string,
  maxPerWindow: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  prune(key, windowMs, now);

  let b = buckets.get(key);
  if (!b || now - b.windowStartMs >= windowMs) {
    b = { windowStartMs: now, count: 0 };
    buckets.set(key, b);
  }

  if (b.count >= maxPerWindow) {
    const retryAfterMs = windowMs - (now - b.windowStartMs);
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000))
    };
  }

  b.count += 1;
  return { ok: true };
}
