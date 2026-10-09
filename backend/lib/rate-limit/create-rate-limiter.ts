// Backend: a counter of tries per key, in fixed windows, kept in the API's memory (feature 9,
// decision 7). One API copy only: a second copy would keep a tally of its own, so the counts then
// move to Redis, shared by both. Routes reach it only through take and giveBack, so the store can
// change under them.

import { rateLimitClock } from "./rate-limit-clock.js";

// formKeys: the forms counted in this window, so copies of one form count once.
export type RateLimitWindowType = { endsAt: number; count: number; formKeys: Set<string> };

// Where each key's try was counted, so giveBack takes it off that window and no later one.
export type RateLimitTakenType = { key: string; windowEndsAt: number; formKey?: string }[];

export type RateLimitResultType =
  { allowed: true; taken: RateLimitTakenType } | { allowed: false; retryAfterSeconds: number };

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
    // Counts one try for every key, or for none when any of them is already at its limit. A copy of
    // a form already counted for every key passes without a count of its own (formKey, optional).
    take(keys: string[], formKey?: string): RateLimitResultType {
      const now = rateLimitClock.now();
      sweep(now);
      const open = keys.map((key) => openWindow(key, now));
      const formCounted = open.every((window) => formKey && window?.formKeys.has(formKey));
      if (formKey && keys.length > 0 && formCounted) return { allowed: true, taken: [] };
      const full = open.filter((window) => window !== undefined && window.count >= most);
      if (full.length > 0) {
        const freeAt = Math.max(...full.map((window) => window!.endsAt));
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((freeAt - now) / 1000)) };
      }
      const taken = keys.map((key, index) => {
        let window = open[index];
        if (window) window.count += 1;
        else windows.set(key, (window = { endsAt: now + windowMs, count: 1, formKeys: new Set() }));
        if (formKey) window.formKeys.add(formKey);
        return { key, windowEndsAt: window.endsAt, formKey };
      });
      return { allowed: true, taken };
    },

    // Hands back tries that did not happen after all, such as a booking refused for a taken time.
    // A window that has ended since is left alone: the try was never counted in the next one.
    giveBack(taken: RateLimitTakenType): void {
      for (const { key, windowEndsAt, formKey } of taken) {
        const window = windows.get(key);
        if (!window || window.endsAt !== windowEndsAt || window.count === 0) continue;
        window.count -= 1;
        if (formKey) window.formKeys.delete(formKey);
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
