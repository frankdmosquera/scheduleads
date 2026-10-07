// Backend: whether an incoming post really came from Twilio (feature 8b, decision 9). Twilio signs
// each one with the account's auth token: an HMAC-SHA1 of the full address it posted to, followed
// by every form field's name and value in name order, in base64, sent as X-Twilio-Signature. The
// address is the API's own public one, never the Host header a caller could change.

import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyTwilioSignature(
  url: string,
  fields: Record<string, string>,
  signature: string | undefined,
  authToken: string
): boolean {
  if (!signature) return false;
  const signed = Object.keys(fields)
    .sort()
    .reduce((text, name) => text + name + fields[name], url);
  const expected = createHmac("sha1", authToken).update(signed, "utf8").digest();
  const given = Buffer.from(signature, "base64");
  // Compared in constant time, so how long a wrong guess takes says nothing about the right one.
  return given.length === expected.length && timingSafeEqual(given, expected);
}
