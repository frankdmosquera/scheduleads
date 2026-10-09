// Backend: a counter of tries per key, in fixed windows, kept in the API's memory (feature 9,
// decision 7). One API copy only: a second copy would keep a tally of its own, so the counts then
// move to Redis, shared by both (Frank, Oct 8). Routes reach it only through take and giveBack, so
// the store can change under them.

import { rateLimitClock } from "./rate-limit-clock.js";

export type RateLimitResultType = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export type RateLimitWindowType = { endsAt: number; count: number };

export type RateLimiterType = ReturnType<typeof createRateLimiter>;

export function createRateLimiter({ most, windowMs }: { most: number; windowMs: number }) {
  // A key's window starts at its first try and lasts windowMs; the next try after it starts anew.
  const windows = new Map<string, RateLimitWindowType>();
  let sweptAt = 0;

  const openWindow = (key: string, now: number) => {
    const window = windows.get(key);
    return window && window.endsAt > now ? window : undefined;
  };

  // Drops every window that is over, at most once a window, so memory holds only recent visitors.
  const sweep = (now: number) => {
    if (now - sweptAt < windowMs) return;
    sweptAt = now;
    for (const [key, window] of windows) if (window.endsAt <= now) windows.delete(key);
  };

  return {
    // Counts one try for every key, or for none when any of them is already at its limit.
    take(keys: string[]): RateLimitResultType {
      const now = rateLimitClock.now();
      sweep(now);
      const open = keys.map((key) => openWindow(key, now));
      const full = open.filter((window) => window !== undefined && window.count >= most);
      if (full.length > 0) {
        const freeAt = Math.max(...full.map((window) => window!.endsAt));
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((freeAt - now) / 1000)) };
      }
      keys.forEach((key, index) => {
        const window = open[index];
        if (window) window.count += 1;
        else windows.set(key, { endsAt: now + windowMs, count: 1 });
      });
      return { allowed: true };
    },

    // Hands back tries that did not happen after all, such as a booking refused for a taken time.
    giveBack(keys: string[]): void {
      const now = rateLimitClock.now();
      for (const key of keys) {
        const window = openWindow(key, now);
        if (window && window.count > 0) window.count -= 1;
      }
    },

    // Forgets every count. Tests start each case from none.
    clear(): void {
      windows.clear();
      sweptAt = 0;
    },

    // How many keys it holds right now, so a test can see the sweep drop the old ones.
    size(): number {
      return windows.size;
    },
  };
}
