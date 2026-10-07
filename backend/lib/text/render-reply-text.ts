// Backend: a customer's reply as it is passed on to the business's phone (feature 8b, decision 9):
// who sent it and their number, then their words exactly as written, and where to answer them.

import { plainText } from "./plain-text.js";
import { readablePhoneNumber } from "./readable-phone-number.js";

const MOST_CHARACTERS = 1600; // Twilio refuses a longer text, and that refusal is never retried

export type ReplyTextFactsType = {
  senderName: string | null; // when their number is on one of the business's leads
  number: string; // as Twilio gives it, "+14035550148"
  words: string;
  hasPicture: boolean;
};

export function renderReplyText(facts: ReplyTextFactsType): string {
  const shown = readablePhoneNumber(facts.number);
  // Only the words around theirs are kept plain. A name with no plain letters ("李明") would be
  // left empty, so it is shown by number instead.
  const name = facts.senderName ? plainText(facts.senderName).trim() : "";
  const who = name ? `${name}, ${shown}` : shown;
  // Answering this text would reach the texting number, not them: hence where to answer.
  const write = (said: string) => `Reply from ${who}: ${said} (answer at ${shown}, not here)`;

  // Their words are never changed, even when an emoji makes the text cost more.
  const said = facts.hasPicture ? `${facts.words} [picture not shown]`.trim() : facts.words;
  if (write(said).length <= MOST_CHARACTERS) return write(said);

  // Too long for one text: cut, never split inside a character, rather than lose it all. The
  // email, when the business has one, carries every word.
  const room = MOST_CHARACTERS - write("...").length;
  let cut = "";
  for (const character of said) {
    if (cut.length + character.length > room) break;
    cut += character;
  }
  return write(`${cut}...`);
}
