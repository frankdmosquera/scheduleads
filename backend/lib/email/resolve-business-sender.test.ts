// Which address a business's emails come from (feature 25a), with public DNS faked: no test looks
// anything up.

import { beforeEach, describe, expect, test, vi } from "vitest";

const signingRecords = new Set<string>();
const looked: string[] = [];
vi.mock("./has-resend-signing-record.js", () => ({
  hasResendSigningRecord: async (domain: string) => {
    looked.push(domain);
    return signingRecords.has(domain);
  },
}));

const { resolveBusinessSender } = await import("./resolve-business-sender.js");

beforeEach(() => {
  signingRecords.clear();
  looked.length = 0;
});

describe("the sender a business's emails use", () => {
  test("its own saved sender is kept, with the agency's address as the fallback, and no DNS look", async () => {
    expect(
      await resolveBusinessSender({
        name: "IA a la Orden",
        savedSender: "hola@ialaorden.com",
        website: "https://ialaorden.com",
      })
    ).toEqual({
      senderEmail: "hola@ialaorden.com",
      from: '"IA a la Orden" <hola@ialaorden.com>',
      fallbackFrom: '"IA a la Orden" <bookings@booking-crm.com>',
      ownDomain: "ialaorden.com",
    });
    expect(looked).toEqual([]);
  });

  test("with no saved sender, a website whose domain is in Resend gives bookings@ that domain", async () => {
    signingRecords.add("primopainters.ca");

    const sender = await resolveBusinessSender({
      name: "Primo Painters",
      savedSender: null,
      website: "https://www.PrimoPainters.ca/contact",
    });

    expect(sender.from).toBe('"Primo Painters" <bookings@primopainters.ca>');
    expect(sender.ownDomain).toBe("primopainters.ca");
    expect(looked).toEqual(["primopainters.ca"]);
  });

  test.each([
    ["a website whose domain is not in Resend", "https://faceandbody.ca"],
    ["no website", null],
    ["a website that cannot be read", "not a website"],
  ])("%s gives bookings@booking-crm.com in the business's name", async (_name, website) => {
    expect(
      await resolveBusinessSender({ name: "Smith, Jones & Co", savedSender: null, website })
    ).toEqual({
      senderEmail: "bookings@booking-crm.com",
      from: '"Smith, Jones & Co" <bookings@booking-crm.com>',
      fallbackFrom: null,
      ownDomain: null,
    });
  });

  test("a website typed without https still gives its domain", async () => {
    signingRecords.add("summitpainting.com");

    const sender = await resolveBusinessSender({
      name: "Summit Painting",
      savedSender: null,
      website: "summitpainting.com",
    });

    expect(sender.senderEmail).toBe("bookings@summitpainting.com");
  });
});
