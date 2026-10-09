// Booking component: the one screen the booking window shows at a time.

import type {
  BookingAvailabilityType,
  BookingBusinessType,
  BookingMadeType,
  BookingServiceDetailsType,
  BookingServiceType,
} from "../api-client/booking-api-types.js";
import type { BookingProblemType } from "../api-client/problem-from-api-answer.js";

// Where the customer was on screen one, so Back from screen two, or a time taken while she typed,
// returns her to the same month, person and day.
export type TimePickPlaceType = { month: string; personId: string | null; date: string };

// The time picked on screen one, carried to screen two.
export type ChosenTimeType = {
  startsAt: string; // ISO instant
  date: string; // YYYY-MM-DD and "9:00 a.m." on the business's clock, as the API sent them
  time: string;
  personId: string | null; // null = any available
  personName: string | null;
  place: TimePickPlaceType;
};

type OneServiceType = {
  business: BookingBusinessType;
  service: BookingServiceDetailsType;
  availability: BookingAvailabilityType;
  // The list it was picked from, kept so Back needs no new call. Null when a button named it.
  pickedFrom: BookingServiceType[] | null;
};

export type BookingScreenType =
  | { screen: "loading" }
  | { screen: "services"; business: BookingBusinessType; services: BookingServiceType[] }
  // Screen one: pick a time. `place` is null the first time, set when coming back from screen two;
  // `notice` holds the route's words when the time was taken while she typed.
  | ({ screen: "service"; place: TimePickPlaceType | null; notice: string | null } & OneServiceType)
  // Screen two: the customer's details and Book.
  | ({ screen: "details"; chosen: ChosenTimeType } & OneServiceType)
  // After Book: the booking as the route answered it, and the address the confirmation goes to.
  | ({ screen: "done"; booking: BookingMadeType; email: string | null } & OneServiceType)
  | {
      screen: "problem";
      problem: BookingProblemType;
      business: BookingBusinessType | null; // null when even the business could not be read
      retry: (() => void) | null;
    };
