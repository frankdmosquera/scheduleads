// Backend: a customer's reply as it is passed on to the business's phone (feature 8b, decision 9):
// who sent it and their number, then their words exactly as written, and where to answer them, so
// the business never answers into the texting number. Only the words around theirs are kept plain;
// theirs are never changed, even when an emoji makes the text cost more.

import { plainText } from "./plain-text.js";
import { readablePhoneNumber } from "./readable-phone-number.js";

// `number` is as Twilio gives it, "+14035550148".
export function renderReplyText(senderName: string | null, number: string, words: string): string {
  const shown = readablePhoneNumber(number);
  const who = senderName ? `${plainText(senderName)}, ${shown}` : shown;
  return `Reply from ${who}: ${words} (answer at ${shown}, not here)`;
}
