/**
 * Sliding-window in-memory rate limiting, factored out of the contact route so
 * the login form and the reply endpoint can each run their OWN window without
 * copy-pasting the bookkeeping. In-memory is honest at this scale: one warm
 * server remembers its own window, and losing the map on a restart merely lets
 * someone retry early. Each map is bounded so a botnet can't turn the limiter
 * itself into the memory leak.
 */

export type RateLimiter = (key: string, now?: number) => number;

/** Returns ms until the key may try again, or 0 when the attempt is allowed. */
export function createRateLimiter(
  windowMs: number,
  maxPerWindow: number,
  maxKeys = 2_000,
): RateLimiter {
  const hits = new Map<string, number[]>();

  return (key, now = Date.now()) => {
    const windowStart = now - windowMs;

    if (hits.size > maxKeys) {
      // Flood pressure: drop stale buckets first, and if the pressure is real
      // traffic, reset outright — bounded memory beats perfect fairness here.
      for (const [k, v] of hits)
        if (!v.some((t) => t > windowStart)) hits.delete(k);
      if (hits.size > maxKeys) hits.clear();
    }

    const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);
    if (recent.length >= maxPerWindow) {
      hits.set(key, recent);
      return recent[0] + windowMs - now;
    }
    recent.push(now);
    hits.set(key, recent);
    return 0;
  };
}

/**
 * The client IP for rate-limit keying — the RIGHTMOST X-Forwarded-For hop, i.e.
 * the address the nearest trusted proxy appended. Behind the usual single
 * reverse proxy (nginx `proxy_add_x_forwarded_for`, Caddy) that hop is the real
 * peer; the LEFTMOST value is whatever the client prepended and is trivially
 * spoofable, so a leftmost-keyed limiter is bypassable even behind a correct
 * proxy. Rightmost is never worse than leftmost across the plausible
 * deployments (with direct exposure the whole header is client fiction either
 * way — an accepted trade-off for a personal site). If this ever sits behind
 * more than one proxy, pin the hop count instead of trusting the last one.
 */
export const clientIpFrom = (headers: Headers) =>
  headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "unknown";
