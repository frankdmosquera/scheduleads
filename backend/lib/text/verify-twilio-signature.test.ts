// Whether a post came from Twilio, against the worked example in Twilio's own security docs
// (auth token 12345), so the check is proved against Twilio's algorithm, not a copy of ours.

import { describe, expect, test } from "vitest";

import { verifyTwilioSignature } from "./verify-twilio-signature.js";

const url = "https://mycompany.com/myapp.php?foo=1&bar=2";
const fields = {
  CallSid: "CA1234567890ABCDE",
  Caller: "+12349013030",
  Digits: "1234",
  From: "+12349013030",
  To: "+18005551212",
};
const signature = "0/KCTR6DLpKmkAf8muzZqo1nDgQ=";

describe("verifyTwilioSignature", () => {
  test("Twilio's own example is accepted", () => {
    expect(verifyTwilioSignature(url, fields, signature, "12345")).toBe(true);
  });

  test.each([
    ["no signature", url, fields, undefined, "12345"],
    ["another account's token", url, fields, signature, "54321"],
    ["another address", "https://mycompany.com/other.php?foo=1&bar=2", fields, signature, "12345"],
    ["a changed field", url, { ...fields, Digits: "1235" }, signature, "12345"],
    ["an added field", url, { ...fields, Body: "hello" }, signature, "12345"],
    ["a signature that is not one", url, fields, "not base64 at all", "12345"],
  ])("%s is refused", (_, address, given, header, token) => {
    expect(verifyTwilioSignature(address, given, header, token)).toBe(false);
  });
});
