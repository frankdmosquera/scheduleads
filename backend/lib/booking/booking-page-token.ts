// Backend: a booking's private link token, "<booking id>.<signature>" (decision 10), packed so a
// text stays one piece (feature 8b, decision 11): the booking id's 16 bytes and the first 16 bytes
// of an HMAC of it under BOOKING_LINK_KEY, each as 22 base64url characters. Nothing is stored and
// only this app can make one. Never logged: whoever holds it can see and cancel that booking.

import { createHmac, timingSafeEqual } from "node:crypto";

import { readBookingLinkKey } from "./read-booking-link-key.js";

const BOOKING_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/; // randomUUID's shape
const PACKED = /^[A-Za-z0-9_-]{22}$/; // 16 bytes in base64url, no padding

// The purpose is signed in too, so a signature made for anything else can never open a booking.
// 128 bits of it are kept: far past guessing, and half the characters of the whole HMAC.
const signatureOf = (bookingId: string, key: Buffer) =>
  createHmac("sha256", key).update(`booking-page:${bookingId}`).digest().subarray(0, 16);

const packId = (bookingId: string) =>
  Buffer.from(bookingId.replaceAll("-", ""), "hex").toString("base64url");

const unpackId = (bytes: Buffer) => {
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// One spelling only: 22 characters carry 4 spare bits, so a respelled part decodes to the same
// bytes and must still open nothing.
const unpack = (part: string) => {
  const bytes = Buffer.from(part, "base64url");
  return bytes.toString("base64url") === part ? bytes : null;
};

export function makeBookingPageToken(bookingId: string, key = readBookingLinkKey()): string {
  if (!BOOKING_ID.test(bookingId)) throw new Error("A booking page token needs a booking id.");
  return `${packId(bookingId)}.${signatureOf(bookingId, key).toString("base64url")}`;
}

// The booking id the token names, or null for anything changed, cut off or made up.
export function readBookingPageToken(token: string, key = readBookingLinkKey()): string | null {
  const [packedId, signature, ...rest] = token.split(".");
  if (rest.length > 0 || !PACKED.test(packedId ?? "") || !PACKED.test(signature ?? "")) {
    return null;
  }
  const idBytes = unpack(packedId);
  const given = unpack(signature);
  if (!idBytes || !given) return null;
  const bookingId = unpackId(idBytes);
  // Compared in constant time, so how long a wrong guess takes says nothing about the right one.
  return timingSafeEqual(given, signatureOf(bookingId, key)) ? bookingId : null;
}
