// Backend: every job the API knows how to run, by name. The runner only takes jobs named here.

import type { TaskList } from "graphile-worker";

import { bookingEmailJob } from "./booking-email-job.js";
import { jobNames } from "./job-names.js";

export const jobTasks: TaskList = {
  [jobNames.bookingEmail]: bookingEmailJob,
};
