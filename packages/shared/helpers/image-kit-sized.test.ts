import { describe, expect, it } from "vitest";

import { imageKitSized } from "./image-kit-sized.js";

describe("imageKitSized", () => {
  it("asks ImageKit for the size", () => {
    expect(imageKitSized("https://ik.imagekit.io/a/logo.webp", "w-192")).toBe(
      "https://ik.imagekit.io/a/logo.webp?tr=w-192"
    );
  });

  it("adds to an address that already carries a question", () => {
    expect(imageKitSized("https://ik.imagekit.io/a/logo.webp?v=2", "f-png,w-280")).toBe(
      "https://ik.imagekit.io/a/logo.webp?v=2&tr=f-png,w-280"
    );
  });

  it("leaves any other address, and a broken one, as it is", () => {
    expect(imageKitSized("https://example.com/logo.png", "w-192")).toBe(
      "https://example.com/logo.png"
    );
    expect(imageKitSized("not an address", "w-192")).toBe("not an address");
  });
});
