/*
 * Listening to a spoken question in the browser: the browser's own speech recognition, so nothing is installed
 * and nothing is sent anywhere by us.
 */

// The browser's speech recognition; not in TypeScript's DOM types, and prefixed in Chrome and Safari.
interface SpeechResultsEventType {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
export interface SpeechRecognizerType {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((e: SpeechResultsEventType) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognizerClassType = new () => SpeechRecognizerType;

/** How long the visitor may pause before their question is taken as finished. */
const QUIET_MS = 1500;
/** The longest one spoken question may run. */
const LISTEN_CAP_MS = 30_000;

/**
 * The question so far, from the recognizer's pieces. A computer's Chrome sends each phrase once ("what type of
 * services", " do you offer"), so they join; a phone's Chrome sends the whole sentence again with each new word
 * ("what", "what type", "what type of"...), so a piece that starts with what is already there replaces it, and one
 * already contained in it is dropped.
 */
export function mergeHeard(pieces: readonly string[]): string {
  let said = "";
  for (const raw of pieces) {
    const piece = raw.trim();
    if (!piece) continue;
    const have = said.toLowerCase();
    const next = piece.toLowerCase();
    if (next.startsWith(have)) said = piece;
    else if (!have.endsWith(next)) said = `${said} ${piece}`;
  }
  return said;
}

/** The browser's recognizer, or nothing where it cannot listen (then the chat shows no mic). */
export function recognizerClass(): SpeechRecognizerClassType | undefined {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognizerClassType;
    webkitSpeechRecognition?: SpeechRecognizerClassType;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export interface ListenHandlersType {
  /** The recognizer's language, for example "en-US". */
  lang: string;
  onStart: () => void;
  /** The words so far, as they are spoken. */
  onHeard: (said: string) => void;
  /** The microphone is blocked, or nothing usable was caught. */
  onError: (why: "blocked" | "notCaught") => void;
  /** Listening ended; `said` is the whole question, empty when nothing was heard. */
  onEnd: (said: string) => void;
}

/**
 * Starts listening for one question. It keeps listening through short pauses: the question ends after `QUIET_MS`
 * without new words, `stop()` (a second tap of the mic) or `LISTEN_CAP_MS` at most, never at the first breath.
 * Returns the recognizer, or null when the browser cannot listen or refused to start.
 */
export function startListening(handlers: ListenHandlersType): SpeechRecognizerType | null {
  const Recognizer = recognizerClass();
  if (!Recognizer) return null;
  const r = new Recognizer();
  r.lang = handlers.lang;
  r.interimResults = true;
  r.continuous = true;
  let said = "";
  let quiet = 0;
  let cap = 0;
  let live = true;
  // A recognizer that already ended, or was let go of, is never stopped again by its timers.
  const end = () => {
    if (!live) return;
    try {
      r.stop();
    } catch {
      // Already stopped by the browser.
    }
  };
  r.onstart = () => {
    handlers.onStart();
    cap = window.setTimeout(end, LISTEN_CAP_MS);
  };
  r.onresult = (e) => {
    said = mergeHeard(Array.from(e.results, (result) => result[0].transcript));
    handlers.onHeard(said);
    window.clearTimeout(quiet);
    quiet = window.setTimeout(end, QUIET_MS);
  };
  r.onerror = (e) => handlers.onError(e.error === "not-allowed" ? "blocked" : "notCaught");
  r.onend = () => {
    live = false;
    window.clearTimeout(quiet);
    window.clearTimeout(cap);
    handlers.onEnd(said.trim());
  };
  try {
    r.start();
  } catch {
    return null;
  }
  return r;
}

/** Lets go of a recognizer at once (the visitor left): nothing it heard is ever asked. */
export function dropListening(r: SpeechRecognizerType | null) {
  if (!r) return;
  r.onstart = r.onresult = r.onerror = r.onend = null;
  r.abort();
}
