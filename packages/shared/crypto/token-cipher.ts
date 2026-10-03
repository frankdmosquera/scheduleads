// Shared: the lock on stored calendar tokens. AES-256-GCM under CALENDAR_TOKEN_KEY, so a
// copy of the database shows nothing usable. Backend only: the frontend never imports it.
// Losing the key makes every stored connection unreadable; everyone reconnects.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1"; // in every value, so the key or format can change later without guessing
const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12; // a fresh one per value; reusing one under the same key breaks GCM
const TAG_BYTES = 16;

// A 32-byte key from a setting written in base64, named so its error says which one. Every key
// the API holds is read through here: the calendar lock, the booking link signature.
export function readBase64Key(name: string, encodedKey: string | undefined): Buffer {
  if (!encodedKey) {
    throw new Error(
      `${name} is not set. Make one with ` +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" ` +
        "and put it in the root .env."
    );
  }

  const key = Buffer.from(encodedKey, "base64");
  const isCanonicalBase64 = key.toString("base64") === encodedKey; // Buffer skips bad characters silently
  if (!isCanonicalBase64 || key.length !== KEY_BYTES) {
    throw new Error(`${name} must be ${KEY_BYTES} random bytes, written in base64.`);
  }

  return key;
}

// Stops the API at start when the key is missing or not 32 bytes, like BETTER_AUTH_SECRET.
export function readTokenKey(encodedKey = process.env.CALENDAR_TOKEN_KEY): Buffer {
  return readBase64Key("CALENDAR_TOKEN_KEY", encodedKey);
}

function assertKeyLength(key: Buffer): void {
  if (key.length !== KEY_BYTES) throw new Error(`The token key must be ${KEY_BYTES} bytes.`);
}

// Returns v1.<iv>.<ciphertext>.<tag>, each part base64url. `boundTo` names the owner of the
// value (a calendar connection's person): it is sealed in, not stored, so the value only
// opens when read back for that same owner, and a copy moved onto another row is refused.
export function encryptCredentials(plaintext: string, key: Buffer, boundTo: string): string {
  assertKeyLength(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(boundTo, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv, ciphertext, tag]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

// Throws on a changed value, the wrong key, another owner or an unknown version; never
// returns garbage.
export function decryptCredentials(value: string, key: Buffer, boundTo: string): string {
  assertKeyLength(key);
  const [version, ivPart, ciphertextPart, tagPart, ...rest] = value.split(".");
  if (
    version !== VERSION ||
    rest.length > 0 ||
    !ivPart ||
    !tagPart ||
    ciphertextPart === undefined
  ) {
    throw new Error("Stored credentials are not in a format this version can read.");
  }

  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Stored credentials are not in a format this version can read.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tag);
  decipher.setAAD(Buffer.from(boundTo, "utf8"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(), // throws when the value, the key or the owner is wrong
  ]);

  return plaintext.toString("utf8");
}
