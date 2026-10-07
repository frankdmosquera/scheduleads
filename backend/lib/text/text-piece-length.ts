// Backend: how much of a text piece's 160 a plain text uses (feature 8b, decision 4). Most plain
// characters cost one; these cost two, because a text can only carry them through an escape.

const COSTS_TWO = new Set(["[", "]", "\\", "^", "{", "|", "}", "~"]);

export function textPieceLength(text: string): number {
  let length = 0;
  for (const character of text) length += COSTS_TWO.has(character) ? 2 : 1;
  return length;
}
