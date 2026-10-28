// Backend: what kind of picture a file really is (feature 25e), read from its first bytes, never from
// its name or the type the browser claims: PNG, JPEG or WebP; anything else, SVG (which can carry
// script) included, is null.

export type PictureKindType = {
  mime: "image/png" | "image/jpeg" | "image/webp";
  extension: string;
};

const startsWith = (bytes: Uint8Array, signature: number[], at = 0) =>
  signature.every((byte, index) => bytes[at + index] === byte);

export function pictureKindOf(bytes: Uint8Array): PictureKindType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mime: "image/png", extension: "png" };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", extension: "jpg" };
  // "RIFF", four bytes of length, then "WEBP".
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8))
    return { mime: "image/webp", extension: "webp" };
  return null;
}
