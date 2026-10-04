// Backend: one booking as the text of a calendar invite (RFC 5545), attached to the customer's
// confirmation as invite.ics, again to the word that it moved, so their calendar moves the event
// (feature 7b), and in its cancelling form to their cancellation, so their calendar removes it
// (feature 7a, decision 8). Pure: no database, no clock.

export type BookingIcsInputType = {
  bookingId: string;
  service: string;
  startsAt: Date;
  endsAt: Date;
  location: string; // the customer's address, as they typed it
  businessName: string;
  senderEmail: string; // the address the business's emails come from
  customerName: string;
  customerEmail: string;
  stampedAt: Date; // when the invite is written (DTSTAMP)
  sequence: number; // above every invite for this booking sent before (feature 7b, decision 6)
  cancelled?: boolean; // the cancelling form: withdraws the event it once sent
};

export function bookingIcs(input: BookingIcsInputType): string {
  const senderDomain = input.senderEmail
    .slice(input.senderEmail.lastIndexOf("@") + 1)
    .toLowerCase();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${senderDomain}//Bookings//EN`, // the business's, never the product's name
    "CALSCALE:GREGORIAN",
    input.cancelled ? "METHOD:CANCEL" : "METHOD:REQUEST",
    "BEGIN:VEVENT",
    // The booking's own id, a random UUID, and never the sender's domain, which the owner can
    // change: the same every time, so a move updates this event instead of adding a second.
    `UID:${input.bookingId}`,
    // A change must carry a higher number than the invite it changes, or calendars ignore it.
    `SEQUENCE:${input.sequence}`,
    `DTSTAMP:${utcStamp(input.stampedAt)}`,
    `DTSTART:${utcStamp(input.startsAt)}`, // UTC: each calendar shows its reader's own zone
    `DTEND:${utcStamp(input.endsAt)}`,
    `SUMMARY:${escapeText(`${input.service} with ${input.businessName}`)}`,
    `LOCATION:${escapeText(input.location)}`,
    `ORGANIZER;CN=${quoteParameter(input.businessName)}:mailto:${input.senderEmail}`,
    // She booked it herself, so she is already in, and no reply is asked of her.
    `ATTENDEE;CN=${quoteParameter(input.customerName)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${input.customerEmail}`,
    input.cancelled ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// 2026-10-08T15:00:00.000Z becomes 20261008T150000Z.
function utcStamp(moment: Date): string {
  return moment
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[-:]/g, "");
}

// The backslash goes first, or the ones added for the others would be doubled. Any other control
// character but a tab is not allowed in the text at all, and a strict calendar refuses the file.
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/[\u0000-\u0008\u000a-\u001f\u007f]+/g, " ");
}

// A parameter value cannot hold a double quote or a control character, even quoted.
function quoteParameter(value: string): string {
  return `"${value
    .replace(/"/g, "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim()}"`;
}

// At most 75 octets a line; each continuation starts with a space, which counts. Splits between
// characters, never inside one, so an accented letter or an emoji arrives whole.
function foldLine(line: string): string {
  const parts: string[] = [];
  let part = "";
  let partOctets = 0;
  let limit = 75;
  for (const character of line) {
    const octets = Buffer.byteLength(character, "utf8");
    if (partOctets + octets > limit) {
      parts.push(part);
      part = "";
      partOctets = 0;
      limit = 74;
    }
    part += character;
    partOctets += octets;
  }
  parts.push(part);
  return parts.join("\r\n ");
}
