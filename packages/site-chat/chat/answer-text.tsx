import { useState } from "react";

import { CHAT_SETTINGS } from "../agent/chat-settings.js";
import { answerParagraphs } from "../agent/sentences.js";

const { lineGapMs, maxMs } = CHAT_SETTINGS.textArrival;

interface LineType {
  text: string;
  /** Its place among all the answer's lines, from 0. */
  index: number;
}

/** An answer's paragraphs, each as its lines (a list is one paragraph of several lines). */
function linesOf(text: string): LineType[][] {
  let index = 0;
  return answerParagraphs(text).map((paragraph) =>
    paragraph.split("\n").map((line) => ({ text: line, index: index++ }))
  );
}

/**
 * A chat answer, one short paragraph per sentence (a list's lines stay together). An answer that `arrive`s shows its
 * first line at once and each next line a moment after. Only the showing waits: the words are all in the page, and
 * read by a screen reader, from the start, and each line keeps its space so the bubble never jumps.
 */
export function AnswerText({ text, arrive = false }: { text: string; arrive?: boolean }) {
  const paragraphs = linesOf(text);
  // Lines there on the first render came whole (a stored answer): they follow one another. Lines added later were
  // streamed in by the AI, already one after another: each fades in as it lands.
  const [whole] = useState(() => paragraphs.flat().length);
  // A long answer's lines come closer together, so the whole never takes longer than maxMs.
  const gap = whole > 1 ? Math.min(lineGapMs, maxMs / (whole - 1)) : 0;
  return paragraphs.map((lines, p) => (
    <span key={p} className="sc-paragraph">
      {lines.map((line) => (
        <span
          key={line.index}
          className={arrive ? "sc-line sc-arrive" : "sc-line"}
          style={
            arrive
              ? { animationDelay: `${line.index < whole ? Math.round(line.index * gap) : 0}ms` }
              : undefined
          }
        >
          {line.text}
        </span>
      ))}
    </span>
  ));
}
