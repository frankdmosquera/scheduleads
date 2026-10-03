// Backend: the one answer every public route gives for every "not here", so nobody can probe which
// businesses, services or people exist.

import { refuse } from "./refuse.js";

export const notBookableHere = refuse("not_found", "Nothing is bookable here.");
