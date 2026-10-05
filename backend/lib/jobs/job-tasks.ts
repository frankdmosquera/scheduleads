// Backend: every job the API knows how to run, by name. The runner only takes jobs named here.
// Empty until the booking emails (8a.2) and the Google event (8a.3) move onto the runner.

import type { TaskList } from "graphile-worker";

export const jobTasks: TaskList = {};
