// Booking component: the one screen the booking window shows at a time.

import type {
  BookingBusinessType,
  BookingServiceDetailsType,
  BookingServiceType,
} from "../api-client/booking-api-types.js";
import type { BookingProblemType } from "../api-client/problem-from-api-answer.js";

export type BookingScreenType =
  | { screen: "loading" }
  | { screen: "services"; business: BookingBusinessType; services: BookingServiceType[] }
  | {
      screen: "service";
      business: BookingBusinessType;
      service: BookingServiceDetailsType;
      // The list it was picked from, kept so Back needs no new call. Null when a button named it.
      pickedFrom: BookingServiceType[] | null;
    }
  | {
      screen: "problem";
      problem: BookingProblemType;
      business: BookingBusinessType | null; // null when even the business could not be read
      retry: (() => void) | null;
    };
