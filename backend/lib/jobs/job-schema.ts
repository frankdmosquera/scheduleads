// Backend: the Postgres schema the runner keeps its jobs in. The API uses the library's own; the
// tests set JOBS_SCHEMA to one of theirs, so a test never works a job the dev API added, and the
// dev API never works a test's.

export const jobSchema = process.env.JOBS_SCHEMA ?? "graphile_worker";
