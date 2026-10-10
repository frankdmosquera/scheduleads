// Backend: writes the booking emails, made, moved and cancelled, filled with a sample booking, to
// .email-preview/ to open in a browser. Nothing is sent. Run: npm run email:preview --workspace=backend

import { mkdirSync, writeFileSync } from "node:fs";

import { renderBookingCancelled } from "../emails/booking-cancelled.js";
import { renderBookingCancelledNotification } from "../emails/booking-cancelled-notification.js";
import { renderBookingConfirmation } from "../emails/booking-confirmation.js";
import type { BookingEmailFactsType } from "../emails/booking-email-facts-type.js";
import { renderBookingMoved } from "../emails/booking-moved.js";
import { renderBookingMovedNotification } from "../emails/booking-moved-notification.js";
import { renderBookingNotification } from "../emails/booking-notification.js";

const sampleFacts: BookingEmailFactsType = {
  business: {
    name: "Summit Painting (dev)",
    logo: null,
    phone: "(403) 555-0100",
    website: "https://example.com",
    brandColor: "#1d4ed8",
    timezone: "America/Edmonton",
  },
  service: "Exterior painting estimate",
  startsAt: new Date("2026-10-08T15:00:00Z"), // 9:00 a.m. in Edmonton
  personName: "Marco",
  location: "12 Main Street, Calgary",
  customer: {
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "(403) 555-0148",
    details:
      "Two storeys, stucco, last painted about ten years ago.\n\nThe back fence too, please. Mornings are best.",
    answers: [
      { question: "Interior or exterior?", answer: "Exterior" },
      { question: "How many rooms?", answer: "None, the whole outside" },
    ],
  },
};

// A link of the right shape; the preview opens nothing.
const sampleBookingPageUrl =
  "http://localhost:3400/b/AAAAAAAAQACAAAAAAAAAAA.sampleSignatureForPrev";

// A move from the day before to the sample time.
const sampleMovedFrom = new Date("2026-10-07T21:30:00Z"); // 3:30 p.m. in Edmonton

const folder = new URL("../.email-preview/", import.meta.url);
mkdirSync(folder, { recursive: true });
for (const [name, render] of [
  [
    "booking-confirmation",
    (facts: BookingEmailFactsType) => renderBookingConfirmation(facts, sampleBookingPageUrl),
  ],
  ["booking-notification", renderBookingNotification],
  [
    "booking-moved",
    (facts: BookingEmailFactsType) =>
      renderBookingMoved(facts, sampleMovedFrom, sampleBookingPageUrl),
  ],
  [
    "booking-moved-notification",
    (facts: BookingEmailFactsType) => renderBookingMovedNotification(facts, sampleMovedFrom),
  ],
  ["booking-cancelled", renderBookingCancelled],
  ["booking-cancelled-notification", renderBookingCancelledNotification],
] as const) {
  const email = await render(sampleFacts);
  const file = new URL(`${name}.html`, folder);
  writeFileSync(file, email.html);
  console.log(`[email preview] ${email.subject}\n  ${file.pathname}`);
}
