// Counts every call to a public route against its visitor: looks (GET) and actions (book, cancel,
// move) each have a limit. Mounted after the CORS middleware, which answers a browser's preflight
// itself, so a preflight is never counted and a refusal still carries the CORS headers.

import { createMiddleware } from "hono/factory";

import { tooManyTries } from "../../lib/errors/too-many-tries.js";
import { publicRateLimiters } from "../../lib/rate-limit/public-rate-limiters.js";
import { visitorAddress } from "../../lib/rate-limit/visitor-address.js";

export const publicRateLimitMiddleware = createMiddleware(async (c, next) => {
  const limiter = c.req.method === "GET" ? publicRateLimiters.reads : publicRateLimiters.writes;
  const result = limiter.take([visitorAddress(c)]);

  if (!result.allowed) {
    c.header("Retry-After", String(result.retryAfterSeconds));
    return c.json(tooManyTries, 429);
  }

  await next();
});
