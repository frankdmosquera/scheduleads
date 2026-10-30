import { CHAT_SETTINGS } from "../agent/chat-settings.js";
import type { ChatLanguageType } from "../words/chat-words-type.js";
import type { ChatSiteType } from "./chat-site-type.js";
import { synthesize } from "./voice.js";
import { buildVoiceLines, type VoiceLineType } from "./voice-lines.js";

/** Makes one sentence's sound as base64 MP3, throwing when Google cannot, so a failure is never cached. */
export type MakeSoundType = (
  voice: string,
  text: string,
  lang: ChatLanguageType
) => Promise<string>;

export interface VoiceRouteOptionsType {
  sites: readonly Pick<ChatSiteType, "lang" | "words" | "answers">[];
  /**
   * Keeps each made sound in the host's shared cache, so Google speaks each sentence once per voice for the life of
   * the deploy. A Next site passes `(make) => unstable_cache(make, ["chat-voice"])`; without it, each server
   * instance keeps its own.
   */
  cacheSound?: (make: MakeSoundType) => MakeSoundType;
}

const NO_STORE = { "Cache-Control": "no-store" };
const notOurs = () => new Response(null, { status: 404, headers: NO_STORE });
const LINE_ID = /^[0-9a-f]{16}$/;

function fromBase64(data: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
}

/**
 * The GET handler for `<voice address>/<id>?voice=<name>`: one sentence of the site's fixed lines in one voice.
 * Only a sentence the server already holds and a listed voice are answered, so this address can never speak text
 * someone sends, and the set of sounds it can make is fixed. A sentence's id changes when its words do, so its sound
 * is cached for good by the browser and the host. No key or a Google refusal is 204: the browser's voice speaks.
 */
export function createVoiceRoute(options: VoiceRouteOptionsType) {
  let lines: Promise<Map<string, VoiceLineType>> | null = null;
  const make: MakeSoundType = async (voice, text, lang) => {
    const audio = await synthesize(text, voice, lang);
    if (!audio) throw new Error("voice unavailable");
    return audio;
  };
  const kept = new Map<string, Promise<string>>();
  const sound: MakeSoundType =
    options.cacheSound?.(make) ??
    ((voice, text, lang) => {
      const key = `${voice}\n${lang}\n${text}`;
      let made = kept.get(key);
      if (!made) {
        made = make(voice, text, lang);
        kept.set(key, made);
        made.catch(() => kept.delete(key));
      }
      return made;
    });

  return async function GET(request: Request): Promise<Response> {
    const { pathname, search } = new URL(request.url);
    const id = pathname.slice(pathname.lastIndexOf("/") + 1);
    const voice = CHAT_SETTINGS.voice.choices.find((choice) => search === `?voice=${choice}`);
    if (!voice || !LINE_ID.test(id)) return notOurs();
    lines ??= buildVoiceLines(options.sites);
    const line = (await lines).get(id);
    if (!line) return notOurs();
    try {
      const audio = fromBase64(await sound(voice, line.text, line.lang));
      return new Response(audio, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
        },
      });
    } catch {
      return new Response(null, { status: 204, headers: NO_STORE });
    }
  };
}
