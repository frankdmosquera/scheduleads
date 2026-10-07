// Before a text is tried again: does Twilio already have it? Twilio faked; no test reaches it.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { findSentText } from "./find-sent-text.js";

const firstTry = new Date("2026-10-07T16:00:00Z");
const text = {
  from: "+14035550199",
  to: "+14035550148",
  body: "Summit Painting: you're booked for Estimate, Tue Oct 13, 7:30 AM.",
  since: firstTry,
};

const message = (changes: Record<string, string> = {}) => ({
  sid: "SM1",
  body: text.body,
  direction: "outbound-api",
  status: "delivered",
  date_created: "Wed, 07 Oct 2026 16:00:02 +0000",
  ...changes,
});

let urls: string[];
function fakeTwilio(answer: () => Response) {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return answer();
  });
}

beforeEach(() => {
  urls = [];
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC123");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "secret-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("findSentText", () => {
  test("asks for the latest texts from the business's number to the customer's", async () => {
    fakeTwilio(() => Response.json({ messages: [] }));

    await findSentText(text);

    const url = new URL(urls[0]);
    expect(url.origin + url.pathname).toBe(
      "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json"
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      From: text.from,
      To: text.to,
      PageSize: "20",
    });
  });

  test("the same words sent since the first try: that text's id, so nothing is sent again", async () => {
    fakeTwilio(() => Response.json({ messages: [message({ sid: "SM9", status: "queued" })] }));

    expect(await findSentText(text)).toBe("SM9");
  });

  test.each([
    ["no text at all", []],
    ["other words", [message({ body: "Summit Painting: a reminder of your Estimate." })]],
    [
      "the same words, from before this booking's first try",
      [message({ date_created: "Tue, 06 Oct 2026 09:00:00 +0000" })],
    ],
    ["the same words, failed on the way", [message({ status: "failed" })]],
    ["the same words, never delivered", [message({ status: "undelivered" })]],
    ["the same words, but a reply coming in", [message({ direction: "inbound" })]],
  ])("%s: nothing found, so it is sent", async (_, messages) => {
    fakeTwilio(() => Response.json({ messages }));

    expect(await findSentText(text)).toBeNull();
  });

  test("a text Twilio's clock stamps a little before ours still counts", async () => {
    fakeTwilio(() =>
      Response.json({ messages: [message({ date_created: "Wed, 07 Oct 2026 15:59:30 +0000" })] })
    );

    expect(await findSentText(text)).toBe("SM1");
  });

  test("when Twilio cannot answer, the check fails and the job tries again later", async () => {
    fakeTwilio(() => Response.json({ code: 20503, status: 503 }, { status: 503 }));

    await expect(findSentText(text)).rejects.toMatchObject({ code: "20503", retry: true });
  });

  test("without keys nothing could have been sent: none found, Twilio not asked", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "");
    fakeTwilio(() => Response.json({ messages: [message()] }));

    expect(await findSentText(text)).toBeNull();
    expect(urls).toHaveLength(0);
  });
});
