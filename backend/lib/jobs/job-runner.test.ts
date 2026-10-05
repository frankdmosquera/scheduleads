// The runner itself, against the local database, with tasks only these tests register: every
// task name carries this run's tag, so no other job is ever taken, and its jobs are removed after.

import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the job runner tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { enqueueJob } = await import("./enqueue-job.js");
const { exitWhenRunnerStops } = await import("./exit-when-runner-stops.js");
const { installJobTables } = await import("./install-job-tables.js");
const { jobSchema } = await import("./job-schema.js");
const { jobTask } = await import("./job-task.js");
const { startJobRunner } = await import("./start-job-runner.js");
const { workDueJobs } = await import("./work-due-jobs.js");

const tag = randomUUID().slice(0, 8);
const schema = sql.identifier(jobSchema);
const taskName = (name: string) => `test-${tag}-${name}`;

type JobRowType = {
  id: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  wait_seconds: number; // until its next try
};

const jobsOf = async (name: string) =>
  (await db.execute(
    sql`select id, attempts, max_attempts, last_error,
          extract(epoch from run_at - now())::float as wait_seconds
        from ${schema}.jobs where task_identifier = ${taskName(name)} order by id`
  )) as unknown as JobRowType[];

// A failed job waits for its next try; the tests do not wait seconds for it.
const makeDue = (name: string) =>
  db.execute(
    sql`update ${schema}._private_jobs set run_at = now()
        where task_id in (select id from ${schema}._private_tasks where identifier = ${taskName(name)})`
  );

await installJobTables();

afterAll(async () => {
  vi.restoreAllMocks();
  const mine = sql`select id from ${schema}._private_tasks where identifier like ${`test-${tag}-%`}`;
  await db.execute(sql`delete from ${schema}._private_jobs where task_id in (${mine})`);
  await db.execute(sql`delete from ${schema}._private_tasks where id in (${mine})`);
  await db.execute(
    sql`delete from ${schema}._private_job_queues where queue_name like ${`test-${tag}-%`}`
  );
  await db.$client.end();
});

describe("the job runner", () => {
  test("a job added in a transaction that rolls back never runs", async () => {
    const work = vi.fn(async () => {});
    await expect(
      db.transaction(async (tx) => {
        await enqueueJob(tx, taskName("rolled-back"), { bookingId: "b-1" });
        throw new Error("the booking failed");
      })
    ).rejects.toThrow("the booking failed");

    await workDueJobs({ [taskName("rolled-back")]: jobTask(work) });

    expect(work).not.toHaveBeenCalled();
    expect(await jobsOf("rolled-back")).toEqual([]);
  });

  test("a job that commits runs once", async () => {
    const work = vi.fn(async () => {});
    await db.transaction(async (tx) => {
      await enqueueJob(tx, taskName("committed"), { bookingId: "b-2" });
    });
    const [waiting] = await jobsOf("committed");
    expect(waiting?.max_attempts).toBe(10); // decision 4's limit when none is given

    await workDueJobs({ [taskName("committed")]: jobTask(work) });
    await workDueJobs({ [taskName("committed")]: jobTask(work) });

    expect(work).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledWith({ bookingId: "b-2" });
    expect(await jobsOf("committed")).toEqual([]); // done jobs leave the table
  });

  test("a task that fails twice then succeeds runs three times with growing waits", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let calls = 0;
    const tasks = {
      [taskName("flaky")]: jobTask(async () => {
        calls += 1;
        if (calls < 3) throw new Error("Resend did not answer");
      }),
    };
    await enqueueJob(db, taskName("flaky"), { bookingId: "b-3" });

    await workDueJobs(tasks);
    const [afterFirst] = await jobsOf("flaky");
    await makeDue("flaky");
    await workDueJobs(tasks);
    const [afterSecond] = await jobsOf("flaky");
    await makeDue("flaky");
    await workDueJobs(tasks);

    expect(calls).toBe(3);
    expect(afterFirst).toMatchObject({ attempts: 1, last_error: "Resend did not answer" });
    expect(afterSecond?.attempts).toBe(2);
    expect(afterFirst!.wait_seconds).toBeGreaterThan(1); // e^1, about 2.7 seconds
    expect(afterSecond!.wait_seconds).toBeGreaterThan(afterFirst!.wait_seconds); // e^2, about 7.4
    expect(await jobsOf("flaky")).toEqual([]);
    warn.mockRestore();
  });

  test("a task that always fails stops at its limit with one log line and stays failed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let calls = 0;
    const tasks = {
      [taskName("broken")]: jobTask(async () => {
        calls += 1;
        // A database error's message carries the query and its values; only its code may survive.
        throw new Error("Failed query: insert into contact values ('jane@example.com')");
      }),
    };
    await enqueueJob(db, taskName("broken"), { bookingId: "b-4" }, { maxAttempts: 3 });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await workDueJobs(tasks);
      await makeDue("broken");
    }

    expect(calls).toBe(3); // the fourth round finds nothing to try
    const gaveUp = warn.mock.calls
      .map(([line]) => String(line))
      .filter((line) => line.includes("gave up"));
    expect(gaveUp).toHaveLength(1);
    expect(gaveUp[0]).toContain(`gave up on ${taskName("broken")} job`);
    expect(gaveUp[0]).toContain("for booking b-4 after 3 attempts: database error (no code)");
    const printed = warn.mock.calls.map(([line]) => String(line)).join("\n");
    expect(printed).not.toContain("jane@example.com");
    expect(await jobsOf("broken")).toEqual([
      expect.objectContaining({
        attempts: 3,
        max_attempts: 3,
        last_error: "database error (no code)",
      }),
    ]);
    warn.mockRestore();
  });

  test("a job added while no runner is running is worked by the next one started", async () => {
    await enqueueJob(db, taskName("waiting"), { bookingId: "b-5" }); // the API is down
    let worked!: () => void;
    const done = new Promise<void>((resolve) => (worked = resolve));

    const runner = (await startJobRunner({
      [taskName("waiting")]: jobTask(async () => worked()),
    }))!;
    await done;
    await runner.stop();

    expect(await jobsOf("waiting")).toEqual([]);
  });

  test("jobs in one queue run one at a time in order", async () => {
    const queueName = taskName("queue");
    const ran: { name: string; start: number; end: number }[] = [];
    let finished!: () => void;
    const allDone = new Promise<void>((resolve) => (finished = resolve));
    const tasks = {
      [taskName("in-line")]: jobTask(async (payload) => {
        const start = performance.now();
        await new Promise((resolve) => setTimeout(resolve, 40));
        ran.push({ name: (payload as { name: string }).name, start, end: performance.now() });
        if (ran.length === 3) finished();
      }),
    };
    for (const name of ["first", "second", "third"]) {
      await enqueueJob(db, taskName("in-line"), { name }, { queueName });
    }

    const runner = (await startJobRunner(tasks))!; // five at once, but one queue goes one by one
    await allDone;
    await runner.stop();

    expect(ran.map((job) => job.name)).toEqual(["first", "second", "third"]);
    expect(ran[1]!.start).toBeGreaterThanOrEqual(ran[0]!.end);
    expect(ran[2]!.start).toBeGreaterThanOrEqual(ran[1]!.end);
  });

  test("no runner starts while no job is defined", async () => {
    expect(await startJobRunner({})).toBeNull(); // its workers would poll for nothing, silently
  });

  test("a runner that stops by itself takes the API down so it restarts, a stop the API asked for does not", async () => {
    const idle = { [taskName("idle")]: jobTask(async () => {}) };
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    // Stopped from inside, as the library does when a worker loses Postgres: the API did not ask.
    const dying = (await startJobRunner(idle))!;
    exitWhenRunnerStops(dying, () => false);
    await dying.stop("a worker exited unexpectedly");
    await dying.promise;
    await new Promise((resolve) => setImmediate(resolve)); // the watcher runs after the promise

    expect(exit).toHaveBeenCalledWith(1);
    expect(error.mock.calls.map(([line]) => String(line))).toContainEqual(
      expect.stringContaining("the runner stopped by itself")
    );

    exit.mockClear();
    const stopped = (await startJobRunner(idle))!;
    exitWhenRunnerStops(stopped, () => true); // a deploy's SIGTERM
    await stopped.stop("SIGTERM");
    await stopped.promise;
    await new Promise((resolve) => setImmediate(resolve));

    expect(exit).not.toHaveBeenCalled();
    exit.mockRestore();
    error.mockRestore();
  });
});
