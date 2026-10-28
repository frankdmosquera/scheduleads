import { describe, expect, it } from "vitest";

import { pictureKindOf } from "./picture-kind-of.js";

const bytes = (...values: number[]) => new Uint8Array([...values, 0, 0, 0, 0]);
const text = (value: string) => new TextEncoder().encode(value);

describe("pictureKindOf", () => {
  it("knows PNG, JPEG and WebP by their bytes", () => {
    expect(pictureKindOf(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.mime).toBe(
      "image/png"
    );
    expect(pictureKindOf(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe("image/jpeg");
    expect(pictureKindOf(text("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))?.mime).toBe("image/webp");
  });

  it("refuses an SVG, a PDF, a text file and an empty file", () => {
    expect(pictureKindOf(text('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toBe(
      null
    );
    expect(pictureKindOf(text("%PDF-1.7"))).toBe(null);
    expect(pictureKindOf(text("just text, named logo.png"))).toBe(null);
    expect(pictureKindOf(new Uint8Array())).toBe(null);
  });

  it("refuses a RIFF file that is not WebP, such as a WAV", () => {
    expect(pictureKindOf(text("RIFF\u0000\u0000\u0000\u0000WAVEfmt "))).toBe(null);
  });
});
