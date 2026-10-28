// Backend: puts one of a business's pictures in the agency's ImageKit (feature 25e), in that
// business's own folder, through ImageKit's upload API with the private key (no package). The
// laptop's uploads go to a separate dev folder. Throws when the key is missing or ImageKit refuses.

import { readImageKitKey } from "./read-imagekit-key.js";

export type StoredPictureType = { url: string; fileId: string };

const ROOT = process.env.NODE_ENV === "production" ? "booking-crm" : "booking-crm-dev";

export async function uploadToImageKit(
  organizationId: string,
  bytes: Uint8Array,
  fileName: string
): Promise<StoredPictureType> {
  const form = new FormData();
  form.append("file", new Blob([Uint8Array.from(bytes)]), fileName);
  form.append("fileName", fileName);
  form.append("folder", `/${ROOT}/${organizationId}`);
  form.append("useUniqueFileName", "true"); // a replaced picture never comes back from a cache
  const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${readImageKitKey()}:`)}` },
    body: form,
  });
  if (!response.ok) throw new Error(`ImageKit refused the upload: ${response.status}`);
  const stored = (await response.json()) as { url?: unknown; fileId?: unknown };
  if (typeof stored.url !== "string" || typeof stored.fileId !== "string")
    throw new Error("ImageKit answered an upload without its address or id.");
  return { url: stored.url, fileId: stored.fileId };
}
