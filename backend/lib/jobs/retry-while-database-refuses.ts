// Backend: runs a start again while Postgres is still coming up (F-179), so a restart that beats
// the database waits for it instead of crashing until Railway stops restarting the API.

// Refused (nothing listening yet) or "the database system is starting up" (57P03). Any other
// error is a real one and is thrown at once.
function isDatabaseNotUpYet(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "ECONNREFUSED" || code === "57P03") return true;
  // Node tries every address of a host, and reports them together when all refuse.
  return error instanceof AggregateError && error.errors.some(isDatabaseNotUpYet);
}

type RetryOptionsType = {
  limitMs: number;
  waitMs: number;
  onWait?: (error: unknown) => void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

export async function retryWhileDatabaseRefuses<T>(
  start: () => Promise<T>,
  {
    limitMs,
    waitMs,
    onWait = () => {},
    sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
    now = Date.now,
  }: RetryOptionsType
): Promise<T> {
  const giveUpAt = now() + limitMs;
  for (;;) {
    try {
      return await start();
    } catch (error) {
      if (!isDatabaseNotUpYet(error) || now() + waitMs > giveUpAt) throw error;
      onWait(error);
      await sleep(waitMs);
    }
  }
}
