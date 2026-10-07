import { randomBytes, randomUUID } from "node:crypto";

import { describe, expect, test } from "vitest";

import { makeBookingPageToken, readBookingPageToken } from "./booking-page-token.js";
import { readBookingLinkKey } from "./read-booking-link-key.js";

const key = randomBytes(32);
const bookingId = randomUUID();

// One character swapped for another of the same kind, so the token keeps its shape.
const swapAt = (token: string, index: number) =>
  token.slice(0, index) + (token[index] === "a" ? "b" : "a") + token.slice(index + 1);

describe("a booking's private link", () => {
  test("a made token reads back to its booking", () => {
    const token = makeBookingPageToken(bookingId, key);

    expect(token).toMatch(/^[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{22}$/); // 45 characters, packed for a text
    expect(readBookingPageToken(token, key)).toBe(bookingId);
    expect(makeBookingPageToken(bookingId, key)).toBe(token); // the same link every time
  });

  // Links are permanent (decision 10): any change to how they are made ends every link already
  // sent. Packed once, in 8b before any customer had one (8b, decision 11).
  test("a link is made exactly the same way, always", () => {
    const id = "0f9c2a4e-3b1d-4e8a-9c7f-5d2e1a6b8c90";

    expect(makeBookingPageToken(id, Buffer.alloc(32, 7))).toBe(
      "D5wqTjsdToqcf10uGmuMkA.mVah-Rh6TSaGRd82Yl_yDg"
    );
  });

  test("one changed character in the link opens nothing, with the same answer as a made-up link", () => {
    const token = makeBookingPageToken(bookingId, key);

    for (let index = 0; index < token.length; index++) {
      if (token[index] === ".") continue;
      expect(readBookingPageToken(swapAt(token, index), key)).toBeNull();
    }
    expect(readBookingPageToken("hello", key)).toBeNull();
  });

  test("a cut-off token, another booking's signature or a made-up string reads as nothing", () => {
    const token = makeBookingPageToken(bookingId, key);
    const other = makeBookingPageToken(randomUUID(), key);
    const [, otherSignature] = other.split(".");

    for (const bad of [
      token.slice(0, -1), // cut off
      token.split(".")[0], // the booking id alone
      `${token.split(".")[0]}.${otherSignature}`, // another booking's signature
      `${token}.extra`,
      "",
      `${bookingId}.${token.split(".")[1]}`, // the booking id written out, as links once were
      `../${token}`,
    ]) {
      expect(readBookingPageToken(bad, key)).toBeNull();
    }
  });

  test("a second spelling of the same signature or booking opens nothing", () => {
    // The last character of 22 carries four spare bits: flipping one spells the same bytes.
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const respell = (part: string) =>
      part.slice(0, -1) + alphabet[alphabet.indexOf(part.at(-1)!) ^ 1];
    const [packedId, signature] = makeBookingPageToken(bookingId, key).split(".");

    for (const part of [packedId, signature]) {
      expect(Buffer.from(respell(part), "base64url")).toEqual(Buffer.from(part, "base64url"));
    }
    expect(readBookingPageToken(`${packedId}.${respell(signature)}`, key)).toBeNull();
    expect(readBookingPageToken(`${respell(packedId)}.${signature}`, key)).toBeNull();
  });

  test("a link signed with another key opens nothing", () => {
    const token = makeBookingPageToken(bookingId, randomBytes(32));

    expect(readBookingPageToken(token, key)).toBeNull();
  });

  test("only a booking id can be signed", () => {
    expect(() => makeBookingPageToken("not-an-id", key)).toThrow("needs a booking id");
  });
});

describe("the link key", () => {
  test("the API refuses to start without the link key, or with one that is not 32 bytes", () => {
    expect(() => readBookingLinkKey(undefined)).toThrow("BOOKING_LINK_KEY is not set");
    expect(() => readBookingLinkKey("")).toThrow("BOOKING_LINK_KEY is not set");
    expect(() => readBookingLinkKey(randomBytes(16).toString("base64"))).toThrow("32 random bytes");
    expect(() => readBookingLinkKey("not base64 at all!")).toThrow("32 random bytes");
    expect(readBookingLinkKey(key.toString("base64"))).toEqual(key);
  });
});
