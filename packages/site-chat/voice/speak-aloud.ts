import { allSentences } from "../agent/sentences.js";
import type { ChatLanguageType } from "../words/chat-words-type.js";
import { spokenText, voiceLineId } from "./voice-line-id.js";

/*
 * The chat's voice: plays what it says, one piece after another, in the site's own voice when it is there and in
 * the browser's voice when it is not. Web Audio plays our sound, so one tap of the mic unlocks it for the rest of
 * the visit, Safari included.
 */

/** How long a piece may keep the chat silent, once it is its turn, before the browser's voice says it. */
const TURN_WAIT_MS = 2000;
/** The breath between two spoken sentences, so an answer is not read out in one rush. */
const SENTENCE_PAUSE_MS = 350;
/** How long a fixed sentence may take to arrive at all; a late one still warms the cache for the next visitor. */
const FETCH_WAIT_MS = 15000;

/** A browser voice in the words' language ("en", "es"), a clear female one where the browser has it. */
function browserVoice(lang: ChatLanguageType): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;
  const inLanguage = speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith(lang));
  return (
    inLanguage.find((v) =>
      /female|samantha|zira|aria|jenny|libby|sonia|google us english|paulina|monica|sabina|helena|dalia|elvira|google español/i.test(
        v.name
      )
    ) ??
    inLanguage[0] ??
    null
  );
}

/** MP3 sent inside the AI's answer stream, as base64. */
function fromBase64(data: string): ArrayBuffer {
  return Uint8Array.from(atob(data), (c) => c.charCodeAt(0)).buffer;
}

interface PieceType {
  text: string;
  /** The language the browser's voice says it in, when ours is not there. */
  lang: ChatLanguageType;
  /** Our voice's sound for the text, or `null` for the browser's voice. */
  sound: Promise<ArrayBuffer | null>;
}

export interface SpeakerType {
  /** Call from a tap (the mic): lets our voice play for the rest of the visit. */
  unlock(): void;
  /** A fixed line of the site, sentence by sentence in our voice from their addresses; `then` runs once everything queued is said. */
  line(text: string, then?: () => void): void;
  /** One sentence of an answer, with our voice's sound when the server sent it, else the browser's voice. */
  sentence(text: string, sound?: string): void;
  /** Stops at once and forgets what was queued. */
  stop(): void;
  /** Stops and lets the sound go, when the chat leaves the page. */
  close(): void;
}

/**
 * A speaker for one chat. `voiceUrl` is the site's voice address, `voice` names the visitor's voice each time a
 * fixed line is fetched, and `lang` the language it is said in.
 */
export function createSpeaker(
  voiceUrl: string,
  voice: () => string,
  lang: () => ChatLanguageType
): SpeakerType {
  let context: AudioContext | null = null;
  let queue: PieceType[] = [];
  let waiting: (() => void)[] = [];
  let playing = false;
  let current: AudioBufferSourceNode | null = null;
  // Bumped by stop(), so a piece that was already playing or loading never carries on afterwards.
  let round = 0;

  async function fetchLine(text: string, inLang: ChatLanguageType): Promise<ArrayBuffer | null> {
    try {
      const id = await voiceLineId(text, inLang);
      const res = await fetch(`${voiceUrl}/${id}?voice=${encodeURIComponent(voice())}`, {
        signal: AbortSignal.timeout(FETCH_WAIT_MS),
      });
      return res.status === 200 ? await res.arrayBuffer() : null;
    } catch {
      return null;
    }
  }

  function audio(): AudioContext | null {
    if (!context && typeof AudioContext !== "undefined") context = new AudioContext();
    return context;
  }

  function browserSays(text: string, inLang: ChatLanguageType): Promise<void> {
    return new Promise((done) => {
      if (!("speechSynthesis" in window)) return done();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = inLang;
      const v = browserVoice(inLang);
      if (v) u.voice = v;
      u.rate = 1.04;
      // Some browsers never fire `end`: a timer by the text's length finishes it anyway.
      const timer = window.setTimeout(done, 1500 + text.length * 75);
      u.onend = u.onerror = () => {
        clearTimeout(timer);
        done();
      };
      speechSynthesis.speak(u);
    });
  }

  async function ourVoiceSays(sound: ArrayBuffer, myRound: number): Promise<boolean> {
    const ctx = audio();
    if (!ctx) return false;
    // A context the browser keeps suspended would never finish a sound: the browser's voice says it.
    if (ctx.state !== "running")
      await Promise.race([ctx.resume(), new Promise((done) => setTimeout(done, 300))]).catch(
        () => {}
      );
    if (ctx.state !== "running") return false;
    try {
      const buffer = await ctx.decodeAudioData(sound);
      if (myRound !== round) return true;
      return await new Promise<boolean>((done) => {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => done(true);
        current = source;
        source.start();
      });
    } catch {
      return false;
    }
  }

  async function play() {
    if (playing) return;
    playing = true;
    const myRound = round;
    let first = true;
    while (queue.length && myRound === round) {
      const piece = queue.shift()!;
      if (!first) await new Promise((done) => setTimeout(done, SENTENCE_PAUSE_MS));
      first = false;
      if (myRound !== round) break;
      // A piece still on its way when its turn comes gets 2 seconds, then the browser's voice says it.
      const sound = await Promise.race([
        piece.sound,
        new Promise<null>((done) => setTimeout(() => done(null), TURN_WAIT_MS)),
      ]);
      if (myRound !== round) break;
      const said = sound ? await ourVoiceSays(sound, myRound) : false;
      if (!said && myRound === round) await browserSays(piece.text, piece.lang);
    }
    // A loop a stop() ended leaves everything to the newer one, including the sound it is playing now.
    if (myRound !== round) return;
    current = null;
    playing = false;
    const then = waiting;
    waiting = [];
    then.forEach((fn) => fn());
  }

  function add(piece: PieceType, then?: () => void) {
    if (!piece.text) {
      then?.();
      return;
    }
    queue.push(piece);
    if (then) waiting.push(then);
    void play();
  }

  return {
    unlock() {
      void audio()?.resume();
    },
    line(text, then) {
      const sentences = allSentences(text);
      const inLang = lang();
      if (!sentences.length) then?.();
      // Every sentence starts arriving now, so the later ones are ready by their turn.
      sentences.forEach((sentence, i) =>
        add(
          { text: spokenText(sentence), lang: inLang, sound: fetchLine(sentence, inLang) },
          i === sentences.length - 1 ? then : undefined
        )
      );
    },
    sentence(text, sound) {
      add({
        text: spokenText(text),
        lang: lang(),
        sound: Promise.resolve(sound ? fromBase64(sound) : null),
      });
    },
    stop() {
      round++;
      queue = [];
      waiting = [];
      playing = false;
      try {
        current?.stop();
      } catch {
        // Already finished.
      }
      current = null;
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    },
    close() {
      this.stop();
      void context?.close();
      context = null;
    },
  };
}
