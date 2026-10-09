// Booking component: an empty form with its own key. Made when the window opens, so closing and
// opening again starts a new form.

import type { BookingFormValuesType } from "./booking-form-values-type.js";

export function newBookingForm(): BookingFormValuesType {
  return {
    requestKey: crypto.randomUUID(), // letters, digits and hyphens: the route's key rule
    name: "",
    email: "",
    phone: "",
    location: "",
    details: "",
    answers: {},
  };
}
