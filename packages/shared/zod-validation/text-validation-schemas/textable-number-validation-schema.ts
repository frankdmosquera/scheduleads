// Shared Zod schema: a phone a text can go to, as people type it ("403 555 0148"), kept as Twilio
// texts it ("+14035550148"). Used by every text setting that holds a phone (features 8b and 8c).

import { z } from "zod";

import { textablePhoneNumber } from "../../helpers/textable-phone-number.js";

export const textableNumberValidationSchema = z.string().transform((typed, context) => {
  const number = textablePhoneNumber(typed);
  if (!number) {
    context.addIssue({
      code: "custom",
      message: "Use a Canadian or US number, like 403 555 0148.",
    });
    return z.NEVER;
  }
  return number;
});
