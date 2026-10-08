// Backend: the answer when a person is sent for a service whose business assigns one (feature 9,
// decision 3). Refused, never ignored, so no front end can overrule the business's choice.

import { refuse } from "./refuse.js";

export const personNotTaken = refuse("bad_request", "This service does not take a pick of person.");
