import { describe, expect, it } from "vitest";

import { decidePackIntoSite } from "./decide-pack-into-site.js";

const sitePackageJson = JSON.stringify({
  dependencies: { "@frankdmosquera/site-chat": "file:vendor/frankdmosquera-site-chat-0.1.0.tgz" },
});
const packedName = "frankdmosquera-site-chat-0.1.1.tgz";
const packedBytes = new Uint8Array([1, 2, 3]);

describe("decidePackIntoSite", () => {
  it("refuses a folder that does not use the chat", () => {
    const withoutChat = JSON.stringify({ dependencies: { next: "16.3.5", ai: "^7.0.127" } });
    for (const sitePackage of [null, withoutChat, "not json"]) {
      const decision = decidePackIntoSite({
        sitePackageJson: sitePackage,
        packedName,
        packedBytes,
        vendorFiles: [],
      });
      expect(decision.kind).toBe("refuse");
    }
  });

  it("takes a site's first copy once it lists what the chat's server needs", () => {
    const ready = JSON.stringify({ dependencies: { ai: "^7.0.127", "@ai-sdk/openai": "^4.0.83" } });
    expect(
      decidePackIntoSite({ sitePackageJson: ready, packedName, packedBytes, vendorFiles: [] })
    ).toEqual({
      kind: "install",
      copy: true,
      remove: [],
    });
  });

  it("refuses a different build under a version the site already has", () => {
    const decision = decidePackIntoSite({
      sitePackageJson,
      packedName,
      packedBytes,
      vendorFiles: [{ name: packedName, bytes: new Uint8Array([1, 2, 4]) }],
    });
    expect(decision).toMatchObject({
      kind: "refuse",
      reason: expect.stringContaining("bump the version"),
    });
  });

  it("copies a new version, leaves the same build alone, and removes only older packed chats", () => {
    const older = { name: "frankdmosquera-site-chat-0.1.0.tgz", bytes: new Uint8Array([9]) };
    const booking = {
      name: "frankdmosquera-booking-component-0.2.11.tgz",
      bytes: new Uint8Array([7]),
    };
    expect(
      decidePackIntoSite({
        sitePackageJson,
        packedName,
        packedBytes,
        vendorFiles: [older, booking],
      })
    ).toEqual({
      kind: "install",
      copy: true,
      remove: [older.name],
    });
    const sameBuild = { name: packedName, bytes: new Uint8Array([1, 2, 3]) };
    expect(
      decidePackIntoSite({
        sitePackageJson,
        packedName,
        packedBytes,
        vendorFiles: [sameBuild, older],
      })
    ).toEqual({
      kind: "install",
      copy: false,
      remove: [older.name],
    });
  });
});
