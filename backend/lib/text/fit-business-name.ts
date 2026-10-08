// Backend: a text with the business's name cut, a word at a time, until the text fits one piece
// (feature 8b, decision 4). Most names fit whole; a long one ("Summit Painting and Decorating
// Contractors of Southern Alberta Ltd") loses its tail rather than doubling what each text costs.

import { joinCutWords } from "./join-cut-words.js";
import { plainText } from "./plain-text.js";
import { textPieceLength } from "./text-piece-length.js";

const ONE_PIECE = 160;

// `write` makes the whole text from a name; the result is always plain.
export function fitBusinessName(businessName: string, write: (name: string) => string): string {
  let words = plainText(businessName).trim().split(/\s+/);
  let text = plainText(write(words.join(" ")));
  while (textPieceLength(text) > ONE_PIECE && words.length > 1) {
    words = words.slice(0, -1);
    text = plainText(write(joinCutWords(words)));
  }
  return text; // one word left: a name that long is sent whole, in two pieces
}
