// Backend: the refusal code for a test email that did not go, by what it is about, so each form
// shows it under the right field.

import type { RefusalCodeType } from "../errors/refuse.js";
import type { EmailRefusalAboutType } from "./check-email-sending-key.js";

export const emailRefusalCode: Record<EmailRefusalAboutType, RefusalCodeType> = {
  key: "key_refused",
  sender: "sender_refused",
  other: "email_test_failed",
};
