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
  test("its own saved sender at its website's domain is kept, with the agency's address as the fallback", async () => {
    signingRecords.add("ialaorden.com");

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
  });

  test("a saved sender at another domain is never used: only the website's domain sends (F-531)", async () => {
    signingRecords.add("primopainters.ca");
    signingRecords.add("someone-else.com");

    const sender = await resolveBusinessSender({
      name: "Primo Painters",
      savedSender: "bookings@someone-else.com",
      website: "https://primopainters.ca",
    });

    expect(sender.senderEmail).toBe("bookings@primopainters.ca");
  });

  test("a saved sender whose domain is not set up in Resend goes from booking-crm.com, as the card says (F-532)", async () => {
    const sender = await resolveBusinessSender({
      name: "Face and Body",
      savedSender: "bookings@faceandbody.ca",
      website: "https://faceandbody.ca",
    });

    expect(sender.senderEmail).toBe("bookings@booking-crm.com");
    expect(sender.ownDomain).toBeNull();
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
