// Backend: the runner can stop itself (a worker that loses Postgres while closing a job shuts the
// whole pool down), and its promise then resolves without an error. An API taking bookings with
// no runner would leave every new job waiting until the next deploy, so it exits instead and
// Railway starts it again, runner and all. A stop the API asked for is not a failure.

import type { Runner } from "graphile-worker";

export function exitWhenRunnerStops(runner: Runner, isStopping: () => boolean): void {
  void runner.promise.finally(() => {
    if (isStopping()) return;
    console.error("[jobs] the runner stopped by itself; exiting so the API restarts with one");
    process.exit(1);
  });
}
