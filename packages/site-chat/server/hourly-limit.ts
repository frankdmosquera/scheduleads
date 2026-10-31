const HOUR_MS = 60 * 60 * 1000;
/** Past this many addresses, expired counts are swept so the map cannot grow for the life of the instance. */
const SWEEP_AT = 1000;

/**
 * A soft count per visitor address and hour, kept per server instance: it stops casual overuse and scripts,
 * not a determined attacker spread over many instances. Returns whether this address is now over `perHour`;
 * every call counts. `now` is for tests.
 */
export function createHourlyLimit(perHour: number, now: () => number = Date.now) {
  const recent = new Map<string, { count: number; resetAt: number }>();
  return function overLimit(address: string): boolean {
    const at = now();
    if (recent.size > SWEEP_AT)
      for (const [key, entry] of recent) if (entry.resetAt < at) recent.delete(key);
    const entry = recent.get(address);
    if (!entry || entry.resetAt < at) {
      recent.set(address, { count: 1, resetAt: at + HOUR_MS });
      return false;
    }
    entry.count += 1;
    return entry.count > perHour;
  };
}

/** The visitor's address as the host passes it on (the first `x-forwarded-for`); "local" on the laptop. */
export function requestAddress(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
