// Backend: who is calling a public route, by internet address, for the per-visitor limits.

import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";

export function visitorAddress(c: Context): string {
  // On Railway the socket is Railway's own proxy, which names the visitor in X-Real-IP (Railway's
  // networking docs). Read only in production: anywhere else anyone could send it.
  if (process.env.NODE_ENV === "production") {
    const realAddress = c.req.header("x-real-ip")?.trim();
    if (realAddress) return realAddress;
  }

  // Tests call the app with no socket at all: they count as one visitor.
  if (!c.env?.incoming) return "unknown";
  return getConnInfo(c).remote.address ?? "unknown";
}
