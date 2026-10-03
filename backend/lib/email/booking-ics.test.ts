import { describe, expect, test } from "vitest";

import { bookingIcs, type BookingIcsInputType } from "./booking-ics.js";

const plainBooking: BookingIcsInputType = {
  bookingId: "bk_123",
  service: "Exterior painting estimate",
  startsAt: new Date("2026-10-08T15:00:00.000Z"),
  endsAt: new Date("2026-10-08T16:00:00.000Z"),
  location: "12 Main Street",
  businessName: "Primo Painters",
  senderEmail: "bookings@PrimoPainters.com",
  customerName: "Jane Doe",
  customerEmail: "jane@example.com",
  stampedAt: new Date("2026-10-02T20:30:00.000Z"),
};

// A folded line rejoined: every line break followed by a space is removed (RFC 5545, 3.1).
function unfold(ics: string): string {
  return ics.replace(/\r\n /g, "");
}

describe("bookingIcs", () => {
  test("writes the exact invite for a plain booking", () => {
    expect(bookingIcs(plainBooking)).toBe(
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//primopainters.com//Bookings//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        "UID:bk_123@primopainters.com",
        "SEQUENCE:0",
        "DTSTAMP:20261002T203000Z",
        "DTSTART:20261008T150000Z",
        "DTEND:20261008T160000Z",
        "SUMMARY:Exterior painting estimate with Primo Painters",
        "LOCATION:12 Main Street",
        'ORGANIZER;CN="Primo Painters":mailto:bookings@PrimoPainters.com',
        'ATTENDEE;CN="Jane Doe";ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:ma', // 75 octets
        " ilto:jane@example.com",
        "STATUS:CONFIRMED",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
      ].join("\r\n")
    );
  });

  test("escapes a comma, a semicolon, a backslash and new lines in the address", () => {
    const ics = bookingIcs({
      ...plainBooking,
      location: "Unit 4, 12 Main St; back door\\side\r\nRing twice\nThanks",
    });

    expect(unfold(ics)).toContain(
      "\r\nLOCATION:Unit 4\\, 12 Main St\\; back door\\\\side\\nRing twice\\nThanks\r\n"
    );
  });

  test("keeps a quote or a line break in a name from breaking the organizer or attendee line", () => {
    const ics = unfold(
      bookingIcs({ ...plainBooking, businessName: 'Smith "and" Co', customerName: "Jane\r\nDoe" })
    );

    expect(ics).toContain('\r\nORGANIZER;CN="Smith and Co":mailto:');
    expect(ics).toContain('\r\nATTENDEE;CN="Jane Doe";');
  });

  test("folds a long Spanish service name at 75 octets and unfolds back to the same text", () => {
    const service =
      "Pintura exterior de la casa completa con preparación, reparación de grietas y acabado satinado en dos manos";
    const ics = bookingIcs({ ...plainBooking, service, businessName: "Los Pintores Latinos" });

    for (const line of ics.split("\r\n")) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
    expect(unfold(ics)).toContain(
      `\r\nSUMMARY:${service.replace(/,/g, "\\,")} with Los Pintores Latinos\r\n`
    );
  });

  test("never splits a character across two lines", () => {
    // "SUMMARY:" and 66 letters make 74 octets; the next "ó" is two, so it starts the next line.
    const ics = bookingIcs({ ...plainBooking, service: `${"a".repeat(66)}ó`, businessName: "B" });
    const lines = ics.split("\r\n");
    const summaryAt = lines.findIndex((line) => line.startsWith("SUMMARY:"));

    expect(lines[summaryAt]).toBe(`SUMMARY:${"a".repeat(66)}`);
    expect(lines[summaryAt + 1]).toBe(" ó with B");
  });

  test("gives one booking the same UID every time, and another booking a different one", () => {
    const uidOf = (ics: string) => ics.split("\r\n").find((line) => line.startsWith("UID:"));
    const later = { ...plainBooking, stampedAt: new Date("2026-10-05T09:00:00.000Z") };

    expect(uidOf(bookingIcs(later))).toBe(uidOf(bookingIcs(plainBooking)));
    expect(uidOf(bookingIcs({ ...plainBooking, bookingId: "bk_456" }))).not.toBe(
      uidOf(bookingIcs(plainBooking))
    );
  });
});
