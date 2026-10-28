// Backend: the agency's ImageKit private key, from the environment only (feature 25e). It never
// reaches the frontend. Throws when it is missing, so a picture is never half saved.

import { ImageKitKeyMissingError } from "./imagekit-key-missing-error.js";

export function readImageKitKey(): string {
  const key = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!key) throw new ImageKitKeyMissingError("IMAGEKIT_PRIVATE_KEY is not set.");
  return key;
}
