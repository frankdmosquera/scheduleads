// Backend: whether a domain is set up to send through Resend, read from public DNS: Resend's
// signing record, resend._domainkey.<domain>, is there (feature 25a). No key is needed, so none
// with power over the agency's Resend account sits on the server. Each answer is kept for an
// hour; a lookup that fails counts as "not set up".

import { resolveTxt } from "node:dns/promises";

const HOUR_MS = 60 * 60 * 1000;
const answers = new Map<string, { setUp: boolean; until: number }>();

export async function hasResendSigningRecord(domain: string, now = Date.now()): Promise<boolean> {
  const kept = answers.get(domain);
  if (kept && kept.until > now) return kept.setUp;
  let setUp = false;
  try {
    const records = await resolveTxt(`resend._domainkey.${domain}`);
    // A key after p=; an empty "p=" is a withdrawn record (example.com publishes one).
    setUp = records.some((parts) => /(^|;)\s*p=[A-Za-z0-9+/]/.test(parts.join("")));
  } catch {
    setUp = false; // no record, or DNS not answering: the agency's own domain sends instead
  }
  answers.set(domain, { setUp, until: now + HOUR_MS });
  return setUp;
}
