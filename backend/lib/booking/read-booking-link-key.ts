// Backend: the key that signs every booking's private link (decision 10). Stops the API at start
// when it is missing or not 32 bytes, like CALENDAR_TOKEN_KEY. Changing it ends every link ever
// sent; losing it does the same.

const KEY_BYTES = 32;

export function readBookingLinkKey(encodedKey = process.env.BOOKING_LINK_KEY): Buffer {
  if (!encodedKey) {
    throw new Error(
      "BOOKING_LINK_KEY is not set. Make one with " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" ` +
        "and put it in the root .env."
    );
  }

  const key = Buffer.from(encodedKey, "base64");
  const isCanonicalBase64 = key.toString("base64") === encodedKey; // Buffer skips bad characters silently
  if (!isCanonicalBase64 || key.length !== KEY_BYTES) {
    throw new Error(`BOOKING_LINK_KEY must be ${KEY_BYTES} random bytes, written in base64.`);
  }

  return key;
}
