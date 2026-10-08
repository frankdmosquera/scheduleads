// Backend: how the API stops when a deploy replaces it. No new connection is taken, and each open
// one is closed as soon as it is idle, so a client keeping its connection open cannot send more;
// the requests already being answered (a booking half saved) and the jobs in hand finish first,
// then the API exits. Bounded, so it ends on its own before the platform kills it. What is still
// waiting stays in the database for the next API's runner.

type ClosableServerType = {
  close(callback: (error?: Error) => void): unknown;
  closeIdleConnections(): void;
};
type StoppableRunnerType = { stop(reason?: string): Promise<void> };

const IDLE_SWEEP_MS = 100;

export async function stopGracefully(
  server: ClosableServerType,
  runner: StoppableRunnerType | null,
  signal: string,
  limitMs: number
): Promise<"finished" | "timed_out"> {
  let timer: NodeJS.Timeout | undefined;
  const limit = new Promise<"timed_out">((resolve) => {
    timer = setTimeout(() => resolve("timed_out"), limitMs);
  });
  // A connection busy when the stop began stays open after its answer; closed here once idle.
  const sweep = setInterval(() => server.closeIdleConnections(), IDLE_SWEEP_MS);
  sweep.unref();
  const finished = Promise.all([
    new Promise<void>((resolve) => server.close(() => resolve())), // once the open requests end
    runner?.stop(signal),
  ]).then(() => "finished" as const);
  try {
    return await Promise.race([finished, limit]);
  } finally {
    clearTimeout(timer);
    clearInterval(sweep);
  }
}
