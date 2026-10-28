// Backend: the one picture an upload form sent (feature 25e), checked before anything is stored:
// a file, at most 1 MB, and really a PNG, JPEG or WebP by its own bytes.

import { pictureKindOf, type PictureKindType } from "./picture-kind-of.js";

const MOST_PICTURE_BYTES = 1_000_000; // the dashboard shrinks pictures well below this

export type UploadedPictureType =
  { ok: true; bytes: Uint8Array; kind: PictureKindType } | { ok: false; message: string };

export async function readUploadedPicture(sent: unknown): Promise<UploadedPictureType> {
  if (!(sent instanceof File) || sent.size === 0)
    return { ok: false, message: "Choose a picture to upload." };
  if (sent.size > MOST_PICTURE_BYTES)
    return { ok: false, message: "That picture is over 1 MB. Choose a smaller one." };
  const bytes = new Uint8Array(await sent.arrayBuffer());
  const kind = pictureKindOf(bytes);
  if (!kind) return { ok: false, message: "Use a PNG, JPEG or WebP picture." };
  return { ok: true, bytes, kind };
}
