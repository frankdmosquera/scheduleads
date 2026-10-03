// Backend: a booking's private link token, "<booking id>.<signature>" (decision 10). The signature
// is an HMAC of the booking id under BOOKING_LINK_KEY, so nothing is stored and only this app can
// make one. Never logged: whoever holds it can see and cancel that booking.

import { createHmac, timingSafeEqual } from "node:crypto";

import { readBookingLinkKey } from "./read-booking-link-key.js";

const BOOKING_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/; // randomUUID's shape
const SIGNATURE = /^[A-Za-z0-9_-]{43}$/; // 32 bytes in base64url, no padding

// The purpose is signed in too, so a signature made for anything else can never open a booking.
const signatureOf = (bookingId: string, key: Buffer) =>
  createHmac("sha256", key).update(`booking-page:${bookingId}`).digest();

export function makeBookingPageToken(bookingId: string, key = readBookingLinkKey()): string {
  if (!BOOKING_ID.test(bookingId)) throw new Error("A booking page token needs a booking id.");
  return `${bookingId}.${signatureOf(bookingId, key).toString("base64url")}`;
}

// The booking id the token names, or null for anything changed, cut off or made up.
export function readBookingPageToken(token: string, key = readBookingLinkKey()): string | null {
  const [bookingId, signature, ...rest] = token.split(".");
  if (rest.length > 0 || !BOOKING_ID.test(bookingId ?? "") || !SIGNATURE.test(signature ?? "")) {
    return null;
  }
  const given = Buffer.from(signature, "base64url");
  if (given.toString("base64url") !== signature) return null; // only one spelling of a signature opens
  // Compared in constant time, so how long a wrong guess takes says nothing about the right one.
  return timingSafeEqual(given, signatureOf(bookingId, key)) ? bookingId : null;
}
