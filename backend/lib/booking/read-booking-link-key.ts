// Backend: the key that signs every booking's private link (decision 10). Stops the API at start
// when it is missing or not 32 bytes, like CALENDAR_TOKEN_KEY. Changing it ends every link ever
// sent; losing it does the same.

import { readBase64Key } from "@scheduleads-app/shared/crypto";

export function readBookingLinkKey(encodedKey = process.env.BOOKING_LINK_KEY): Buffer {
  return readBase64Key("BOOKING_LINK_KEY", encodedKey);
}
