// Backend: what time the jobs think it is, when they judge whether an appointment has started
// (decision 4). The real clock in the API; tests pin it, since they book on fixed dates.

export const jobClock = {
  now: (): Date => new Date(),
};
