// Tells the browser never to keep a copy of a signed-in answer, so the next person on
// a shared computer cannot see it. Every dashboard route mounts it.

import { createMiddleware } from "hono/factory";

export const dashboardNoStoreMiddleware = createMiddleware(async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store"); // set after next(), on the finished response
});
