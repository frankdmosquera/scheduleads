// Backend: what the ticket table keeps instead of the state value itself (SHA-256, hex).

import { createHash } from "node:crypto";

export const oauthStateFingerprint = (state: string) =>
  createHash("sha256").update(state).digest("hex");
