import { describe, expect, it } from "vitest";

import { decidePackIntoSite } from "./decide-pack-into-site.js";

const sitePackageJson = JSON.stringify({
  dependencies: {
    "@frankdmosquera/booking-component": "file:vendor/frankdmosquera-booking-component-0.2.1.tgz",
  },
});
const packedName = "frankdmosquera-booking-component-0.2.2.tgz";
const packedBytes = new Uint8Array([1, 2, 3]);

describe("decidePackIntoSite", () => {
  it("refuses a folder that does not use the booking window", () => {
    const withoutWindow = JSON.stringify({ dependencies: { next: "16.3.5" } });
    for (const sitePackage of [null, withoutWindow, "not json"]) {
      const decision = decidePackIntoSite({
        sitePackageJson: sitePackage,
        packedName,
        packedBytes,
        vendorFiles: [],
      });
      expect(decision.kind).toBe("refuse");
    }
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

  it("copies a new version, leaves the same build alone, and removes only older packed files", () => {
    const older = {
      name: "frankdmosquera-booking-component-0.2.1.tgz",
      bytes: new Uint8Array([9]),
    };
    const unrelated = { name: "logo.png", bytes: new Uint8Array([7]) };

    expect(
      decidePackIntoSite({
        sitePackageJson,
        packedName,
        packedBytes,
        vendorFiles: [older, unrelated],
      })
    ).toEqual({ kind: "install", copy: true, remove: [older.name] });

    const sameBuild = { name: packedName, bytes: new Uint8Array([1, 2, 3]) };
    expect(
      decidePackIntoSite({
        sitePackageJson,
        packedName,
        packedBytes,
        vendorFiles: [sameBuild, older],
      })
    ).toEqual({ kind: "install", copy: false, remove: [older.name] });
  });
});
