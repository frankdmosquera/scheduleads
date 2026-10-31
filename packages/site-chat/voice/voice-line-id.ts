import type { ChatLanguageType } from "../words/chat-words-type.js";

/** The words as the voice speaks them: no arrows or markdown marks, single spaces. */
export function spokenText(text: string): string {
  return text
    .replace(/[→*_#`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A fixed line's short id: the first 16 hex characters of the SHA-256 of its spoken words, with the language in
 * front for every language but English, so the same words in another language are another sound. The browser
 * and the server compute it the same way, so the browser asks for a line by id and the server checks it is one of
 * the site's. The id changes whenever the words do.
 */
export async function voiceLineId(text: string, lang: ChatLanguageType): Promise<string> {
  const spoken = spokenText(text);
  const hashed = lang === "en" ? spoken : `${lang}\n${spoken}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(hashed));
  return Array.from(new Uint8Array(digest).subarray(0, 8), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}
