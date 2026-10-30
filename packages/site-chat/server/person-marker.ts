/**
 * The mark the AI ends an answer with when a person should take over (the instructions say when). The route
 * takes it out before the visitor sees or hears anything, and only then offers the ways to a person.
 */
export const PERSON_MARKER = "[[person]]";

/** The marker in any letter case, with the spaces before it, so "estimate [[person]]." reads "estimate.". */
const MARKED = /\s*\[\[person\]\]/gi;

export interface PersonMarkerFilterType {
  /** The streamed text so far, less every marker and less a tail that may be the start of one. */
  push(delta: string): string;
  /** Whether a whole marker has been seen. */
  marked(): boolean;
  /** What the answer still needs when the stream ends: a full stop when the marker took its place. */
  end(): string;
}

/**
 * Filters a streaming answer: a marker split across deltas ("[[per" then "son]]") is held back, with the spaces
 * before it, until it is complete or ruled out, so no part of it is ever shown or spoken. A tail still held when
 * the stream ends is spaces or a cut-off marker, and is dropped. The AI often writes the marker where the full
 * stop goes, so a marked answer that ends without one gets it back from `end()`.
 */
export function createPersonMarkerFilter(): PersonMarkerFilterType {
  let held = "";
  let seen = false;
  // The end of everything shown, not the last piece alone: a closing quote can arrive on its own.
  let tail = "";
  return {
    push(delta) {
      const text = (held + delta).replace(MARKED, () => {
        seen = true;
        return "";
      });
      let keep = 0;
      for (let n = Math.min(PERSON_MARKER.length - 1, text.length); n > 0 && !keep; n--) {
        if (PERSON_MARKER.startsWith(text.slice(-n).toLowerCase())) keep = n;
      }
      let cut = text.length - keep;
      while (cut > 0 && /\s/.test(text[cut - 1])) cut--;
      held = text.slice(cut);
      const shown = text.slice(0, cut);
      tail = (tail + shown).slice(-8);
      return shown;
    },
    marked: () => seen,
    end: () => (seen && tail && !/[.!?]["')\]]*$/.test(tail) ? "." : ""),
  };
}
