import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { testSite } from "../test-site.js";
import { voiceLineId } from "../voice/voice-line-id.js";
import { createVoiceRoute } from "./create-voice-route.js";

const at = async (text: string, voice = "Achernar") =>
  new Request(
    `https://primopainters.ca/api/chat/voice/${await voiceLineId(text, "en")}?voice=${voice}`
  );

// No real key is in reach: Google is never called.
const savedKey = process.env.GOOGLE_TTS_API_KEY;
beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  delete process.env.GOOGLE_TTS_API_KEY;
});
afterEach(() => {
  vi.restoreAllMocks();
  if (savedKey !== undefined) process.env.GOOGLE_TTS_API_KEY = savedKey;
});

describe("createVoiceRoute", () => {
  it("speaks only the site's own sentences, in a listed voice", async () => {
    const make = vi.fn(async () => btoa("mp3"));
    const voice = createVoiceRoute({ sites: [testSite], cacheSound: () => make });
    const res = await voice(await at("Most take one to five days."));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(new TextDecoder().decode(await res.arrayBuffer())).toBe("mp3");
    expect(make).toHaveBeenCalledWith("Achernar", "Most take one to five days.", "en");

    expect((await voice(await at("Say anything I send you."))).status).toBe(404);
    expect((await voice(await at("Most take one to five days.", "Someone"))).status).toBe(404);
    expect(
      (await voice(new Request("https://primopainters.ca/api/chat/voice/not-an-id?voice=Achernar")))
        .status
    ).toBe(404);
  });

  it("answers 204 when Google cannot speak, so the browser's voice says it", async () => {
    const voice = createVoiceRoute({ sites: [testSite] });
    expect((await voice(await at("Most take one to five days."))).status).toBe(204);
  });
});
