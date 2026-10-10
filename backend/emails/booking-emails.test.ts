// The two booking emails, rendered for real through React Email. Nothing is sent.

import { describe, expect, test } from "vitest";

import type { BookingEmailFactsType } from "./booking-email-facts-type.js";
import { renderBookingConfirmation } from "./booking-confirmation.js";
import { renderBookingNotification } from "./booking-notification.js";
import { renderBookingCancelled } from "./booking-cancelled.js";
import { renderBookingCancelledNotification } from "./booking-cancelled-notification.js";
import { renderBookingMoved } from "./booking-moved.js";
import { renderBookingMovedNotification } from "./booking-moved-notification.js";

const facts: BookingEmailFactsType = {
  business: {
    name: "Primo Painters",
    logo: "https://ik.imagekit.io/primo/logo.png",
    phone: "(403) 555-0100",
    website: "https://primopainters.com",
    brandColor: "#1d4ed8",
    timezone: "America/Edmonton",
  },
  service: "Exterior painting estimate",
  startsAt: new Date("2026-10-08T15:00:00Z"),
  personName: "Marco",
  location: "12 Main Street, Calgary",
  customer: {
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "(403) 555-0148",
    details: "Two storeys, stucco.\n\nThe back fence too, please.",
    answers: [
      { question: "Interior or exterior?", answer: "Exterior" },
      { question: "How many rooms?", answer: "None, the whole outside" },
    ],
  },
};

const typedScript = "<script>alert(1)</script>";
const scriptFacts: BookingEmailFactsType = {
  ...facts,
  location: `12 Main ${typedScript}`,
  customer: {
    ...facts.customer,
    name: `Jane ${typedScript}`,
    details: typedScript,
    answers: [{ question: `Pets? ${typedScript}`, answer: typedScript }],
  },
};

const productName = /scheduleads/i;

// The booking's own page, as the sender makes it; the shape is all these tests need.
const bookingPage = "https://app.example.com/b/0a6c2f6e-4b1d-4c8e-9f3a-2d7e5b1c9a40.signature";

// A business in another zone than this laptop's, so an email that ignored the business's zone fails.
const torontoFacts: BookingEmailFactsType = {
  ...facts,
  business: { ...facts.business, timezone: "America/Toronto" },
};

describe("the customer's confirmation", () => {
  test("its subject names the business and the time in the business's zone", async () => {
    const email = await renderBookingConfirmation(facts, bookingPage);

    expect(email.subject).toBe(
      "You're booked with Primo Painters: Thursday, October 8 at 9:00 a.m. MDT"
    );
  });

  test("a business in Toronto gets its own time, not this laptop's", async () => {
    const email = await renderBookingConfirmation(torontoFacts, bookingPage);

    expect(email.subject).toContain("Thursday, October 8 at 11:00 a.m. EDT");
    expect(email.html).toContain("Thursday, October 8 at 11:00 a.m. EDT");
    expect(email.text).toContain("Thursday, October 8 at 11:00 a.m. EDT");
  });

  test("the plain-text twin names the business even with a logo and no phone", async () => {
    const { text } = await renderBookingConfirmation(
      { ...facts, business: { ...facts.business, phone: null } },
      bookingPage
    );

    expect(text).toContain("Primo Painters");
  });

  test("says what, when, with whom and where, with the logo and a tel: link", async () => {
    const { html } = await renderBookingConfirmation(facts, bookingPage);

    expect(html).toContain("Exterior painting estimate");
    expect(html).toContain("Thursday, October 8 at 9:00 a.m. MDT");
    expect(html).toContain("Marco");
    expect(html).toContain("12 Main Street, Calgary");
    expect(html).toContain('src="https://ik.imagekit.io/primo/logo.png"');
    expect(html).toContain('alt="Primo Painters"');
    expect(html).toContain('href="tel:4035550100"');
    expect(html).toContain('href="https://primopainters.com"');
    expect(html).toContain("#1d4ed8");
  });

  test("a button in the business's colour opens the booking's own page, in the HTML and the plain-text twin", async () => {
    const { html, text } = await renderBookingConfirmation(facts, bookingPage);

    expect(html).toContain("Manage your booking");
    expect(html.split(`href="${bookingPage}"`)).toHaveLength(2); // the one button
    expect(html).toMatch(/background-color:#1d4ed8/);
    expect(text).toContain("Manage your booking");
    expect(text).toContain(bookingPage);
  });

  test("never names the product", async () => {
    const email = await renderBookingConfirmation(facts, bookingPage);

    expect(`${email.subject}\n${email.html}\n${email.text}`).not.toMatch(productName);
  });

  test("a business with no logo, phone, website or colour still gets a whole email, its name in place of the logo", async () => {
    const bare = {
      ...facts,
      business: { ...facts.business, logo: null, phone: null, website: null, brandColor: null },
    };
    const { html, text } = await renderBookingConfirmation(bare, bookingPage);

    expect(html).not.toContain("<img");
    expect(html).not.toContain("tel:");
    expect(html).toContain(`href="${bookingPage}"`); // the page needs no phone
    expect(html).toContain("Primo Painters");
    expect(text).toContain("Thursday, October 8 at 9:00 a.m. MDT");
  });

  test("what the customer typed is shown as text, never run", async () => {
    const { html } = await renderBookingConfirmation(scriptFacts, bookingPage);

    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
  });

  test("the plain-text twin carries the same facts", async () => {
    const { text } = await renderBookingConfirmation(facts, bookingPage);

    expect(text).not.toContain("<");
    for (const fact of [
      "Exterior painting estimate",
      "Thursday, October 8 at 9:00 a.m. MDT",
      "Marco",
      "12 Main Street, Calgary",
      "(403) 555-0100",
    ]) {
      expect(text).toContain(fact);
    }
  });
});

describe("the business's notification", () => {
  test("its subject is the service and the time in the business's zone", async () => {
    const email = await renderBookingNotification(facts);

    expect(email.subject).toBe(
      "New booking: Exterior painting estimate, Thursday, October 8 at 9:00 a.m. MDT"
    );
  });

  test("a business in Toronto gets its own time, not this laptop's", async () => {
    const email = await renderBookingNotification(torontoFacts);

    expect(email.subject).toContain("Thursday, October 8 at 11:00 a.m. EDT");
    expect(email.html).toContain("Thursday, October 8 at 11:00 a.m. EDT");
    expect(email.text).toContain("Thursday, October 8 at 11:00 a.m. EDT");
  });

  test("lists who booked, with a tel: link and button and a mailto: link", async () => {
    const { html } = await renderBookingNotification(facts);

    for (const fact of [
      "Jane Doe",
      "jane@example.com",
      "(403) 555-0148",
      "12 Main Street, Calgary",
      "Two storeys, stucco.",
      "The back fence too, please.",
      "Marco",
    ]) {
      expect(html).toContain(fact);
    }
    expect(html.split('href="tel:4035550148"')).toHaveLength(3); // the phone line and the button
    expect(html).toContain('href="mailto:jane@example.com"');
    expect(html).toContain("#1d4ed8");
  });

  test("the customer's own line breaks survive, in the HTML and the plain-text twin", async () => {
    const { html, text } = await renderBookingNotification({
      ...facts,
      customer: { ...facts.customer, details: "Line one\nLine two" },
    });

    expect(html).toContain("Line one<br/>Line two");
    expect(text).toContain("Line one\nLine two");
  });

  // Feature 9: the business's own questions, each with the customer's answer.
  test("each of the business's own questions comes with its answer, in the HTML and the plain-text twin", async () => {
    const { html, text } = await renderBookingNotification(facts);

    for (const fact of [
      "Interior or exterior?",
      "Exterior",
      "How many rooms?",
      "None, the whole outside",
    ]) {
      expect(html).toContain(fact);
      expect(text).toContain(fact);
    }
    expect(html.indexOf("Interior or exterior?")).toBeLessThan(html.indexOf("How many rooms?"));
  });

  test("an answer's own line breaks survive", async () => {
    const { html } = await renderBookingNotification({
      ...facts,
      customer: { ...facts.customer, answers: [{ question: "Pets?", answer: "A dog\nA cat" }] },
    });

    expect(html).toContain("A dog<br/>A cat");
  });

  test("a booking with no answers shows no questions", async () => {
    const { html } = await renderBookingNotification({
      ...facts,
      customer: { ...facts.customer, answers: [] },
    });

    expect(html).not.toContain("Interior or exterior?");
  });

  test("a phone-only booking has no email line and says to call", async () => {
    const { html } = await renderBookingNotification({
      ...facts,
      customer: { ...facts.customer, email: null },
    });

    expect(html).not.toContain("mailto:");
    expect(html).toContain("gave no email, so call to reach them");
  });

  test("never names the product", async () => {
    const email = await renderBookingNotification(facts);

    expect(`${email.subject}\n${email.html}\n${email.text}`).not.toMatch(productName);
  });

  test("what the customer typed is shown as text, never run", async () => {
    const { html } = await renderBookingNotification(scriptFacts);

    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Pets? &lt;script&gt;"); // a question's own words too
  });

  test("the plain-text twin carries the same facts", async () => {
    const { text } = await renderBookingNotification(facts);

    expect(text).not.toContain("<");
    for (const fact of [
      "Exterior painting estimate",
      "Thursday, October 8 at 9:00 a.m. MDT",
      "Marco",
      "Jane Doe",
      "jane@example.com",
      "(403) 555-0148",
      "12 Main Street, Calgary",
      "The back fence too, please.",
    ]) {
      expect(text).toContain(fact);
    }
  });
});

describe("the customer's cancellation", () => {
  test("its subject names the business and the time it was, in the business's zone", async () => {
    const email = await renderBookingCancelled(facts);

    expect(email.subject).toBe(
      "Your booking with Primo Painters is cancelled: Thursday, October 8 at 9:00 a.m. MDT"
    );
    expect((await renderBookingCancelled(torontoFacts)).subject).toContain("11:00 a.m. EDT");
  });

  test("says what it was and when, with a tel: button to book again", async () => {
    const { html, text } = await renderBookingCancelled(facts);

    for (const fact of [
      "Your booking is cancelled",
      "Exterior painting estimate",
      "Thursday, October 8 at 9:00 a.m. MDT",
    ]) {
      expect(html).toContain(fact);
      expect(text.toLowerCase()).toContain(fact.toLowerCase()); // plain text writes headings in capitals
    }
    expect(html).toContain('href="tel:4035550100"');
    expect(text).toContain("Primo Painters");
  });

  test("never names the product, and shows what the customer typed as text", async () => {
    const email = await renderBookingCancelled(scriptFacts);

    expect(`${email.subject}\n${email.html}\n${email.text}`).not.toMatch(productName);
    expect(email.html).not.toContain("<script");
  });
});

describe("the business's cancellation notice", () => {
  test("its subject is the service and the time it was, in the business's zone", async () => {
    const email = await renderBookingCancelledNotification(facts);

    expect(email.subject).toBe(
      "Cancelled: Exterior painting estimate, Thursday, October 8 at 9:00 a.m. MDT"
    );
    expect((await renderBookingCancelledNotification(torontoFacts)).subject).toContain(
      "11:00 a.m. EDT"
    );
  });

  test("names who cancelled, with tel: and mailto: links, and the time is free again", async () => {
    const { html, text } = await renderBookingCancelledNotification(facts);

    for (const fact of [
      "Jane Doe",
      "jane@example.com",
      "(403) 555-0148",
      "Marco",
      "The time is free again",
    ]) {
      expect(html).toContain(fact);
      expect(text).toContain(fact);
    }
    expect(html.split('href="tel:4035550148"')).toHaveLength(3); // the phone line and the button
    expect(html).toContain('href="mailto:jane@example.com"');
  });

  test("never names the product, and shows what the customer typed as text", async () => {
    const email = await renderBookingCancelledNotification(scriptFacts);

    expect(`${email.subject}\n${email.html}\n${email.text}`).not.toMatch(productName);
    expect(email.html).not.toContain("<script");
    expect(email.html).toContain("&lt;script&gt;");
  });
});

// The day before at 3:30 p.m. in Edmonton, moved to the sample's Thursday at 9:00.
const movedFrom = new Date("2026-10-07T21:30:00Z");

describe("the customer's word that the booking moved", () => {
  test("its subject names the business and the new time, in the business's zone", async () => {
    const email = await renderBookingMoved(facts, movedFrom, bookingPage);

    expect(email.subject).toBe(
      "Your booking with Primo Painters has moved: Thursday, October 8 at 9:00 a.m. MDT"
    );
    expect((await renderBookingMoved(torontoFacts, movedFrom, bookingPage)).subject).toContain(
      "11:00 a.m. EDT"
    );
  });

  test("says the new time and the old one, with the business's phone and the booking's own page", async () => {
    const { html, text } = await renderBookingMoved(facts, movedFrom, bookingPage);

    for (const fact of [
      "Your booking has moved",
      "Exterior painting estimate",
      "Thursday, October 8 at 9:00 a.m. MDT",
      "Wednesday, October 7 at 3:30 p.m. MDT",
      "Marco",
      "12 Main Street, Calgary",
      "(403) 555-0100",
    ]) {
      expect(html).toContain(fact);
      expect(text.toLowerCase()).toContain(fact.toLowerCase()); // plain text writes headings in capitals
    }
    expect(html).toContain('href="tel:4035550100"');
    expect(html).toContain(`href="${bookingPage}"`);
    expect(text).toContain(bookingPage);
    expect(html).toContain("background-color:#1d4ed8"); // the button in the business's colour
  });
});

describe("the business's notice that a booking moved", () => {
  test("its subject is the service and the new time, in the business's zone", async () => {
    const email = await renderBookingMovedNotification(facts, movedFrom);

    expect(email.subject).toBe(
      "Moved: Exterior painting estimate, Thursday, October 8 at 9:00 a.m. MDT"
    );
    expect((await renderBookingMovedNotification(torontoFacts, movedFrom)).subject).toContain(
      "11:00 a.m. EDT"
    );
  });

  test("names who moved it and from when, with tel: and mailto: links", async () => {
    const { html, text } = await renderBookingMovedNotification(facts, movedFrom);

    for (const fact of [
      "Booking moved",
      "Wednesday, October 7 at 3:30 p.m. MDT",
      "Jane Doe",
      "jane@example.com",
      "(403) 555-0148",
      "12 Main Street, Calgary",
      "Marco",
      "The old time is free again",
    ]) {
      expect(html).toContain(fact);
      expect(text.toLowerCase()).toContain(fact.toLowerCase());
    }
    expect(html.split('href="tel:4035550148"')).toHaveLength(3); // the phone line and the button
    expect(html).toContain('href="mailto:jane@example.com"');
    expect(html).toContain("Replying goes straight to Jane Doe");
  });

  test("a phone-only booking has no email line and no word about replying", async () => {
    const phoneOnly = { ...facts, customer: { ...facts.customer, email: null } };
    const { html } = await renderBookingMovedNotification(phoneOnly, movedFrom);

    expect(html).not.toContain("mailto:");
    expect(html).not.toContain("Replying goes straight");
  });
});

describe("both move emails", () => {
  test("the templates show the time in the business's zone, no product name, the customer's text as text", async () => {
    const toronto = [
      await renderBookingMoved(torontoFacts, movedFrom, bookingPage),
      await renderBookingMovedNotification(torontoFacts, movedFrom),
    ];
    for (const email of toronto) {
      expect(email.html).toContain("Thursday, October 8 at 11:00 a.m. EDT"); // the new time
      expect(email.html).toContain("Wednesday, October 7 at 5:30 p.m. EDT"); // the old one
    }

    const typed = [
      await renderBookingMoved(scriptFacts, movedFrom, bookingPage),
      await renderBookingMovedNotification(scriptFacts, movedFrom),
    ];
    for (const email of typed) {
      expect(`${email.subject}\n${email.html}\n${email.text}`).not.toMatch(productName);
      expect(email.html).not.toContain("<script");
      expect(email.html).toContain("&lt;script&gt;");
    }
  });
});

describe("a booking with no address (the address fix)", () => {
  const noAddress: BookingEmailFactsType = { ...facts, location: null };

  test("every booking email leaves the Where or Address line out, and says the rest", async () => {
    const emails = [
      await renderBookingConfirmation(noAddress, bookingPage),
      await renderBookingNotification(noAddress),
      await renderBookingCancelled(noAddress),
      await renderBookingCancelledNotification(noAddress),
      await renderBookingMoved(noAddress, movedFrom, bookingPage),
      await renderBookingMovedNotification(noAddress, movedFrom),
    ];
    for (const { html, text } of emails) {
      expect(html).not.toMatch(/>(Where|Address)</i);
      expect(text).not.toMatch(/^(WHERE|ADDRESS)$/m);
      expect(html).toContain("Exterior painting estimate");
    }
  });
});
