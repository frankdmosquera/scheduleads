/**
 * Splits streaming text into the sentences finished so far, and the rest still being written. A
 * sentence ends on ".", "!" or "?" followed by a space (so "$1,490" and "1.5" never split), or on a
 * line break. A period with a small letter after it is an abbreviation ("8:00 a. m."), not an end; one
 * that closes a lone letter is held until the next word shows which. The rest is spoken when the stream ends.
 */
export function finishedSentences(text: string): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  const end = /[.!?]+["')\]]*\s+|\n+/g;
  let start = 0;
  for (let m = end.exec(text); m; m = end.exec(text)) {
    const after = m.index + m[0].length;
    if (!m[0].includes("\n")) {
      if (
        after < text.length
          ? /\p{Ll}/u.test(text[after])
          : /(^|\s)\p{L}$/u.test(text.slice(0, m.index))
      )
        continue;
    }
    const sentence = text.slice(start, m.index + m[0].length).trim();
    if (sentence) sentences.push(sentence);
    start = m.index + m[0].length;
  }
  return { sentences, rest: text.slice(start) };
}

/** Every sentence of a finished text, the last one included even without an end mark. */
export function allSentences(text: string): string[] {
  const { sentences, rest } = finishedSentences(text);
  return rest.trim() ? [...sentences, rest.trim()] : sentences;
}

/** A sentence shorter than this ("Yes.", "Not yet.") opens the next one instead of standing alone. */
const SHORT_OPENER_CHARS = 16;

/**
 * A written answer as paragraphs, so a long one never reads as a single block: every sentence after the
 * first on a line starts a new paragraph, while a list's lines (one sentence each) stay together in one.
 * A paragraph keeps its own line breaks. Works on text still streaming in.
 */
export function answerParagraphs(text: string): string[] {
  const paragraphs: string[] = [];
  let current: string[] = [];
  const close = () => {
    if (current.length) paragraphs.push(current.join("\n"));
    current = [];
  };
  for (const line of text.split("\n")) {
    if (!line.trim()) {
      close();
      continue;
    }
    const sentences = allSentences(line);
    if (sentences.length <= 1) {
      current.push(line.trim());
      continue;
    }
    let pending = "";
    sentences.forEach((sentence, i) => {
      const words = pending ? `${pending} ${sentence}` : sentence;
      if (words.length < SHORT_OPENER_CHARS && i < sentences.length - 1) {
        pending = words;
        return;
      }
      pending = "";
      if (i > 0) close();
      current.push(words);
    });
    close();
  }
  close();
  return paragraphs;
}
