// Whether a domain is set up in Resend, read from its signing record (feature 25a), with public
// DNS faked: no test looks anything up.

import { beforeEach, describe, expect, test, vi } from "vitest";

const records = new Map<string, string[][] | Error>();
let lookups = 0;
vi.mock("node:dns/promises", () => ({
  resolveTxt: async (name: string) => {
    lookups += 1;
    const answer = records.get(name);
    if (!answer || answer instanceof Error) throw answer ?? new Error("ENOTFOUND");
    return answer;
  },
}));

const { hasResendSigningRecord } = await import("./has-resend-signing-record.js");

beforeEach(() => {
  records.clear();
  lookups = 0;
});

describe("a domain's Resend signing record", () => {
  test("a record carrying a key counts as set up, even split over several strings", async () => {
    records.set("resend._domainkey.primo-a.ca", [["p=MIGfMA0GCSqGSIb3", "DQEBAQUAA4GNADCB"]]);

    expect(await hasResendSigningRecord("primo-a.ca")).toBe(true);
  });

  test('an empty "p=" is a withdrawn record, not set up', async () => {
    records.set("resend._domainkey.example-b.com", [["v=DKIM1; p="]]);

    expect(await hasResendSigningRecord("example-b.com")).toBe(false);
  });

  test("no record, or DNS not answering, is not set up", async () => {
    records.set("resend._domainkey.down-c.ca", new Error("ETIMEOUT"));

    expect(await hasResendSigningRecord("nothing-c.ca")).toBe(false);
    expect(await hasResendSigningRecord("down-c.ca")).toBe(false);
  });

  test("an answer is kept for an hour, then looked up again", async () => {
    records.set("resend._domainkey.kept-d.ca", [["p=MIGfMA0GCSq"]]);
    const now = Date.now();

    await hasResendSigningRecord("kept-d.ca", now);
    records.delete("resend._domainkey.kept-d.ca");
    expect(await hasResendSigningRecord("kept-d.ca", now + 59 * 60_000)).toBe(true);
    expect(lookups).toBe(1);
    expect(await hasResendSigningRecord("kept-d.ca", now + 61 * 60_000)).toBe(false);
    expect(lookups).toBe(2);
  });
});
