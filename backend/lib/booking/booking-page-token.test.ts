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

    expect(token).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
    expect(readBookingPageToken(token, key)).toBe(bookingId);
    expect(makeBookingPageToken(bookingId, key)).toBe(token); // the same link every time
  });

  test("one changed character in the link opens nothing, with the same answer as a made-up link", () => {
    const token = makeBookingPageToken(bookingId, key);

    for (let index = 0; index < token.length; index++) {
      if (token[index] === "." || token[index] === "-") continue;
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
      `${bookingId}.${otherSignature}`, // another booking's signature
      `${token}.extra`,
      "",
      `${bookingId.toUpperCase()}.${token.split(".")[1]}`,
      `../${token}`,
    ]) {
      expect(readBookingPageToken(bad, key)).toBeNull();
    }
  });

  test("a second spelling of the same signature opens nothing", () => {
    // The last character of 43 carries two spare bits: flipping one spells the same bytes.
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const token = makeBookingPageToken(bookingId, key);
    const last = alphabet[alphabet.indexOf(token.at(-1)!) ^ 1];
    const respelled = token.slice(0, -1) + last;

    expect(Buffer.from(respelled.split(".")[1], "base64url")).toEqual(
      Buffer.from(token.split(".")[1], "base64url")
    );
    expect(readBookingPageToken(respelled, key)).toBeNull();
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
