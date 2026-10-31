import { CHAT_SETTINGS } from "../agent/chat-settings.js";
import { spokenText } from "../voice/voice-line-id.js";
import type { ChatLanguageType } from "../words/chat-words-type.js";

/*
 * The site's own voice: one call to Google Cloud Text-to-Speech. Server only: the key never reaches a page, a URL
 * or a log, and Google's own error text never reaches the browser.
 */

const ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";
const { choices, languageCodes, maxSpokenChars } = CHAT_SETTINGS.voice;

/** A listed voice choice, or the default for anything else (a missing or unknown `voice`). */
export function listedVoice(asked: string | null | undefined): string {
  return asked && choices.includes(asked) ? asked : choices[0];
}

/**
 * The words spoken in one of the voices as base64 MP3, or `null` when Google cannot (no key, the free amount used,
 * a network error), so the browser's voice says them instead. Logs counts only.
 */
export async function synthesize(
  text: string,
  choice: string,
  lang: ChatLanguageType,
  signal?: AbortSignal
): Promise<string | null> {
  const key = process.env.GOOGLE_TTS_API_KEY;
  const words = spokenText(text).slice(0, maxSpokenChars);
  if (!key || !words) return null;
  const languageCode = languageCodes[lang];
  const name = `${languageCode}-Chirp3-HD-${listedVoice(choice)}`;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        input: { text: words },
        voice: { languageCode, name },
        audioConfig: { audioEncoding: "MP3" },
      }),
      signal,
    });
    if (!res.ok) {
      console.error(`voice: ${words.length} chars, failed (${res.status})`);
      return null;
    }
    const { audioContent } = (await res.json()) as { audioContent?: string };
    if (!audioContent) return null;
    console.info(`voice: ${words.length} chars, ok`);
    return audioContent;
  } catch (error) {
    if (!signal?.aborted)
      console.error(
        `voice: ${words.length} chars, failed (${error instanceof Error ? error.name : "unknown"})`
      );
    return null;
  }
}
