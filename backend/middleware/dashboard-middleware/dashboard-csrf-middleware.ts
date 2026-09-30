// A dashboard request that changes something must come from the dashboard's own address,
// so another website cannot press a button with the owner's login cookie. Hono's own check:
// it looks only at requests a plain form could send, since the CORS rule already stops the rest.

import { csrf } from "hono/csrf";

import { appOrigin } from "../../lib/auth/auth-server.js";

export const dashboardCsrfMiddleware = csrf({ origin: appOrigin });
