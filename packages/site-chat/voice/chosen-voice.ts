import { CHAT_SETTINGS } from "../agent/chat-settings.js";

const KEY = "site-chat-voice";

/**
 * The visitor's voice for the visit: one kept in sessionStorage when it is still listed, else the default. The
 * corner chat has no picker of its own; a site page with one saves the choice under the same key.
 */
export function chosenVoice(): string {
  const { choices } = CHAT_SETTINGS.voice;
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved && choices.includes(saved)) return saved;
  } catch {
    // Storage blocked: the default.
  }
  return choices[0];
}
