// The two booking emails, rendered for real through React Email. Nothing is sent.

import { describe, expect, test } from "vitest";

import type { BookingEmailFactsType } from "./booking-email-facts-type.js";
import { renderBookingConfirmation } from "./booking-confirmation.js";
import { renderBookingNotification } from "./booking-notification.js";

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
  },
};

const typedScript = "<script>alert(1)</script>";
const scriptFacts: BookingEmailFactsType = {
  ...facts,
  location: `12 Main ${typedScript}`,
  customer: { ...facts.customer, name: `Jane ${typedScript}`, details: typedScript },
};

const productName = /scheduleads/i;

// A business in another zone than this laptop's, so an email that ignored the business's zone fails.
const torontoFacts: BookingEmailFactsType = {
  ...facts,
  business: { ...facts.business, timezone: "America/Toronto" },
};

describe("the customer's confirmation", () => {
  test("its subject names the business and the time in the business's zone", async () => {
    const email = await renderBookingConfirmation(facts);

    expect(email.subject).toBe(
      "You're booked with Primo Painters: Thursday, October 8 at 9:00 a.m. MDT"
    );
  });

  test("a business in Toronto gets its own time, not this laptop's", async () => {
    const email = await renderBookingConfirmation(torontoFacts);

    expect(email.subject).toContain("Thursday, October 8 at 11:00 a.m. EDT");
    expect(email.html).toContain("Thursday, October 8 at 11:00 a.m. EDT");
    expect(email.text).toContain("Thursday, October 8 at 11:00 a.m. EDT");
  });

  test("the plain-text twin names the business even with a logo and no phone", async () => {
    const { text } = await renderBookingConfirmation({
      ...facts,
      business: { ...facts.business, phone: null },
    });

    expect(text).toContain("Primo Painters");
  });

  test("says what, when, with whom and where, with the logo and a tel: button", async () => {
    const { html } = await renderBookingConfirmation(facts);

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

  test("never names the product", async () => {
    const email = await renderBookingConfirmation(facts);

    expect(`${email.subject}\n${email.html}\n${email.text}`).not.toMatch(productName);
  });

  test("a business with no logo, phone, website or colour still gets a whole email, its name in place of the logo", async () => {
    const bare = {
      ...facts,
      business: { ...facts.business, logo: null, phone: null, website: null, brandColor: null },
    };
    const { html, text } = await renderBookingConfirmation(bare);

    expect(html).not.toContain("<img");
    expect(html).not.toContain("tel:");
    expect(html).toContain("Primo Painters");
    expect(text).toContain("Thursday, October 8 at 9:00 a.m. MDT");
  });

  test("what the customer typed is shown as text, never run", async () => {
    const { html } = await renderBookingConfirmation(scriptFacts);

    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
  });

  test("the plain-text twin carries the same facts", async () => {
    const { text } = await renderBookingConfirmation(facts);

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
