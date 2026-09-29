import { randomBytes } from "node:crypto";

import { describe, expect, test } from "vitest";
import { decryptCredentials, encryptCredentials, readTokenKey } from "./token-cipher.js";

const key = randomBytes(32);
const credentials = JSON.stringify({
  refreshToken: "1//refresh-token",
  accessToken: "ya29.access-token",
  accessTokenExpiresAt: "2026-09-28T18:00:00.000Z",
});

// Flips one character of one part, keeping it valid base64url, so only the lock can object.
function changePart(value: string, partIndex: number): string {
  const parts = value.split(".");
  const part = parts[partIndex];
  parts[partIndex] = (part[0] === "A" ? "B" : "A") + part.slice(1);
  return parts.join(".");
}

describe("encryptCredentials and decryptCredentials", () => {
  test("a value locked with the key opens with the same key", () => {
    const stored = encryptCredentials(credentials, key);
    expect(decryptCredentials(stored, key)).toBe(credentials);
  });

  test("the stored value does not contain the tokens in plain text", () => {
    const stored = encryptCredentials(credentials, key);
    expect(stored.startsWith("v1.")).toBe(true);
    expect(stored).not.toContain("refresh-token");
    expect(stored).not.toContain("access-token");
  });

  test("the same value locked twice looks different each time", () => {
    // A fresh random start per value; a repeated one would leak which rows hold the same tokens.
    expect(encryptCredentials(credentials, key)).not.toBe(encryptCredentials(credentials, key));
  });

  test("a changed ciphertext, start or tag is refused", () => {
    const stored = encryptCredentials(credentials, key);
    for (const partIndex of [1, 2, 3]) {
      expect(() => decryptCredentials(changePart(stored, partIndex), key)).toThrow();
    }
  });

  test("the wrong key is refused", () => {
    const stored = encryptCredentials(credentials, key);
    expect(() => decryptCredentials(stored, randomBytes(32))).toThrow();
  });

  test("an unknown version or a broken shape is refused", () => {
    const stored = encryptCredentials(credentials, key);
    expect(() => decryptCredentials(stored.replace(/^v1\./, "v2."), key)).toThrow();
    expect(() => decryptCredentials(`${stored}.extra`, key)).toThrow();
    expect(() => decryptCredentials("not-a-stored-value", key)).toThrow();
  });

  test("a key of the wrong length is refused", () => {
    expect(() => encryptCredentials(credentials, randomBytes(16))).toThrow();
    expect(() =>
      decryptCredentials(encryptCredentials(credentials, key), randomBytes(31))
    ).toThrow();
  });
});

describe("readTokenKey", () => {
  test("a 32-byte key in base64 is read", () => {
    const encoded = key.toString("base64");
    expect(readTokenKey(encoded).equals(key)).toBe(true);
  });

  test("a missing key stops the API", () => {
    expect(() => readTokenKey("")).toThrow(/CALENDAR_TOKEN_KEY is not set/);
  });

  test("a key of the wrong length stops the API", () => {
    expect(() => readTokenKey(randomBytes(16).toString("base64"))).toThrow(/32 random bytes/);
    expect(() => readTokenKey(randomBytes(33).toString("base64"))).toThrow(/32 random bytes/);
  });

  test("a key that is not base64 stops the API", () => {
    // Buffer skips the stray character and still lands on the same 32 bytes.
    const encoded = key.toString("base64");
    expect(() => readTokenKey(`${encoded.slice(0, 10)}!${encoded.slice(10)}`)).toThrow(
      /32 random bytes/
    );
  });
});
