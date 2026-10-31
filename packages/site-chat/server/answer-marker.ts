/*
 * The mark the AI replies with when one of the brief's numbered stored answers fully answers the visitor:
 * `[[answer:12]]` and nothing else. The route then sends that answer in the site's exact words.
 */

/** A whole mark in any letter case and spacing ("[[Answer: 3]]"), with the spaces before it. */
const WHOLE = /^\[\[\s*answer\s*:\s*(\d+)\s*\]\]/i;
const ANYWHERE = /\s*\[\[\s*answer\s*:\s*\d+\s*\]\]/gi;
/** Text that could still grow into a mark: "[", "[[ans", "[[answer: 1", "[[answer:12]". */
const PARTIAL = /^\[(\[\s*(a(n(s(w(e(r\s*(:\s*\d*\s*\]?)?)?)?)?)?)?)?)?$/i;
/** Any of our marks ([[answer:N]], [[person]]) or anything shaped like one. */
const ANY_MARK = /\[\[[^\]]*\]\]/g;

/**
 * A visitor's text (or an earlier turn) with every mark taken out, so only the AI can ever write one. Taken out
 * until none is left: one pass turned "[[answer:3][[x]]]" into "[[answer:3]]".
 */
export function withoutMarks(text: string): string {
  let out = text;
  for (let before = ""; before !== out;) {
    before = out;
    out = out.replace(ANY_MARK, "");
  }
  return out.trim();
}

export interface AnswerMarkerFilterType {
  /** The text to show so far, less every mark and less a tail that may be the start of one. */
  push(delta: string): string;
  /** The stored answer's number the AI picked, once a whole marker has opened its reply. */
  picked(): number | null;
  /** What is still held when the stream ends: dropped when it was a cut-off marker. */
  end(): string;
}

/** Where a possible mark starts at the end of `text`, with the spaces before it (a mark may follow them). */
function heldFrom(text: string): number {
  const open = text.lastIndexOf("[");
  let at = open > 0 && text[open - 1] === "[" ? open - 1 : open;
  if (at < 0 || !PARTIAL.test(text.slice(at))) at = text.length;
  while (at > 0 && /\s/.test(text[at - 1])) at--;
  return at;
}

/**
 * Reads a streaming answer: a reply that opens with a marker is never shown (whatever follows it is dropped too)
 * and names the stored answer. A mark written anywhere else is a slip, so it is taken out and the words around it
 * are kept; a mark split across deltas is held until it is whole or ruled out.
 */
export function createAnswerMarkerFilter(): AnswerMarkerFilterType {
  let held = "";
  let state: "undecided" | "text" | "marker" = "undecided";
  let number: number | null = null;
  return {
    push(delta) {
      if (state === "marker") return "";
      held += delta;
      if (state === "undecided") {
        const start = held.trimStart();
        const whole = WHOLE.exec(start);
        if (whole) {
          state = "marker";
          number = Number(whole[1]);
          held = "";
          return "";
        }
        if (PARTIAL.test(start) || !start) return "";
        state = "text";
      }
      const text = held.replace(ANYWHERE, "");
      const cut = heldFrom(text);
      held = text.slice(cut);
      return text.slice(0, cut);
    },
    picked: () => number,
    end() {
      if (state === "marker") return "";
      const rest = held.trimStart();
      return !rest || PARTIAL.test(rest) ? "" : held;
    },
  };
}
