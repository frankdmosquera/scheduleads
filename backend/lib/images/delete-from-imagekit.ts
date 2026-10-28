// Backend: deletes a picture a business replaced or removed from ImageKit (feature 25e). Called
// after the database no longer points at it, so a failure only leaves a stray file behind: it is
// logged, never thrown at the owner, whose change is already saved.

import { readImageKitKey } from "./read-imagekit-key.js";

export async function deleteFromImageKit(fileId: string): Promise<void> {
  try {
    const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: { Authorization: `Basic ${btoa(`${readImageKitKey()}:`)}` },
    });
    if (!response.ok && response.status !== 404)
      console.warn(`ImageKit kept a replaced picture (${fileId}): ${response.status}`);
  } catch (error) {
    console.warn(`ImageKit kept a replaced picture (${fileId}):`, error);
  }
}
