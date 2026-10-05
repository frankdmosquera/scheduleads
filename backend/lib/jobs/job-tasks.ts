// Backend: every job the API knows how to run, by name. The runner only takes jobs named here.

import type { TaskList } from "graphile-worker";

import { bookingEmailJob } from "./booking-email-job.js";
import { bookingEventMoveJob } from "./booking-event-move-job.js";
import { bookingEventRemovalJob } from "./booking-event-removal-job.js";
import { bookingEventWriteJob } from "./booking-event-write-job.js";
import { jobNames } from "./job-names.js";

export const jobTasks: TaskList = {
  [jobNames.bookingEmail]: bookingEmailJob,
  [jobNames.bookingEventWrite]: bookingEventWriteJob,
  [jobNames.bookingEventMove]: bookingEventMoveJob,
  [jobNames.bookingEventRemove]: bookingEventRemovalJob,
};
