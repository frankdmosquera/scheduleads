// Backend: how the API stops when a deploy replaces it. New requests are refused at once; the
// requests already being answered (a booking half saved) and the jobs in hand finish first, then
// the API exits. Bounded, so it ends on its own before the platform kills it. What is still
// waiting stays in the database for the next API's runner.

type ClosableServerType = { close(callback: (error?: Error) => void): unknown };
type StoppableRunnerType = { stop(reason?: string): Promise<void> };

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
  const finished = Promise.all([
    new Promise<void>((resolve) => server.close(() => resolve())), // once the open requests end
    runner?.stop(signal),
  ]).then(() => "finished" as const);
  try {
    return await Promise.race([finished, limit]);
  } finally {
    clearTimeout(timer);
  }
}
