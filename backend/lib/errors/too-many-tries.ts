// Backend: the answer a public route gives a visitor or contact over its limit (feature 9,
// decision 8). Sent as 429 with Retry-After, the seconds until the window ends.

import { refuse } from "./refuse.js";

export const tooManyTries = refuse(
  "too_many_tries",
  "Too many tries. Please wait a minute and try again."
);
