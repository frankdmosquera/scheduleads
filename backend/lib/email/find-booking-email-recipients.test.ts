// Who hears about a new booking by email: the one rule, no database.

import { describe, expect, test } from "vitest";

import { findBookingEmailRecipients } from "./find-booking-email-recipients.js";

const widgetBooking = {
  source: "widget",
  customerEmail: "jane@example.com",
  notifyEmail: "office@primopainters.com",
  personWorkEmail: null,
};

describe("who hears about a booking", () => {
  test("without a work email the emails are what they were", () => {
    expect(findBookingEmailRecipients(widgetBooking)).toEqual({
      customer: "jane@example.com",
      business: "office@primopainters.com",
      customerReplyTo: null,
      person: null,
    });
  });

  test("with a work email the confirmation replies to the person and the person is notified", () => {
    expect(
      findBookingEmailRecipients({ ...widgetBooking, personWorkEmail: "pedro@primopainters.com" })
    ).toEqual({
      customer: "jane@example.com",
      business: "office@primopainters.com",
      customerReplyTo: "pedro@primopainters.com",
      person: "pedro@primopainters.com",
    });
  });

  test("the person is notified of a booking the owner made, which the business is not", () => {
    expect(
      findBookingEmailRecipients({
        ...widgetBooking,
        source: "manual",
        personWorkEmail: "pedro@primopainters.com",
      })
    ).toMatchObject({ business: null, person: "pedro@primopainters.com" });
  });

  test("a work email that is the business's notification address gets one email, not two", () => {
    const recipients = findBookingEmailRecipients({
      ...widgetBooking,
      personWorkEmail: "Office@PrimoPainters.com",
    });
    expect(recipients).toMatchObject({
      business: "office@primopainters.com",
      customerReplyTo: "Office@PrimoPainters.com",
      person: null,
    });
  });
});
