# Feature: A client's site can book once its business has a Website

**From build-plan:** feature 25b

**Size:** light - one piece of logic (which site may call which business's booking routes); no data change, no screen.
**Status:** built
**Branch:** feature/25b-a-client-s-site-can-book-once-its-business-has-a-website

## Goal

A new client's site books as soon as the agency admin fills in the business's
Website, with no Railway edit and no redeploy. The API lets a browser on that
business's own website call that business's public booking routes; every other
site stays refused, as today.

## In scope

- **The rule**, in `publicCorsMiddleware`: a browser's Origin is allowed when
  1. it is on the fixed list, as today: `WIDGET_ORIGINS` (now only the laptop's
     dev sites) and the dashboard (`APP_ORIGIN`); or
  2. the path names a business (`/public/<slug>/...`) and the Origin is that
     business's own Website: `https://<domain>` or `https://www.<domain>`, the
     domain read from its Website field the same way 25a does
     (`website-domain.ts`).
  Anything else gets no `Access-Control-Allow-Origin`, so the browser blocks
  it, exactly as an unlisted site does today.
- **Only that business.** Business A's website never opens business B's routes:
  the Website compared is the one of the business in the path.
- **Not the booking page.** `/public/bookings/<token>...` (the customer's own
  booking page, served by the dashboard) keeps the fixed list only.
- **https only.** An `http://` Origin never matches a Website (the Website field
  already requires `https://`).
- **Fast.** A business's Website is looked up by slug and kept for 60 seconds
  inside the process, so a busy site does not query the database on every call
  and a changed Website works within a minute. An unknown slug, or a lookup that
  fails, allows nothing beyond the fixed list.
- **Docs.** `AGENTS.md` and the `.env.example` comment say `WIDGET_ORIGINS` is
  for the laptop's dev sites; live client sites come from each business's
  Website.

## Out of scope

- Removing Face and Body's and IA a la Orden's entries from Railway's
  `WIDGET_ORIGINS` (harmless; tidied later, by hand, on Frank's yes).
- Several websites per business, or subdomains other than `www`.
- Changing the Website field itself or who may edit it (still the agency admin).

## Build loop

After Frank's yes on this plan, the one step runs straight through: build,
tests, the build log, commit and push to the feature branch. The review comes
once, at `/complete` (light). Stops only for the three reasons in `AGENTS.md`.

## Build steps

- [x] 1. The origin rule in `publicCorsMiddleware` with a small cached lookup
  of a business's Website by slug, its tests, and the docs.
  **Done when:** backend tests pass, including new ones for: the business's
  own Website allowed (with and without `www`, on a read and on the preflight
  for a booking POST); another business's Website refused on this business's
  routes; an `http://` Origin refused; the booking page routes not opened by a
  Website; an unknown slug refused; the fixed list still allowed. Backend build
  passes.

## Files / areas

- `backend/middleware/public-middleware/public-cors-middleware.ts`
- a new `backend/lib/...` file: the cached Website-by-slug lookup (one export)
- `backend/lib/email/website-domain.ts` (reused, not changed)
- `backend/routes/public-booking-links-routes.test.ts` (its CORS tests), or a
  new middleware test
- `AGENTS.md`, `.env.example` (Frank's uncommitted copy)

## Data / contracts

- No migration. `organization.website` (https URL, set by the agency admin)
  decides; `organization.slug` finds it.
- Response headers unchanged in shape: `Access-Control-Allow-Origin` names the
  calling Origin when allowed, never `*`, never with credentials.

## Testing

Backend Vitest against the local database (the route tests' existing setup),
each test with its own throwaway business and Website, so the 60-second cache
never carries one test into another.

## Notes for the AI

- One export per backend file; types end in `Type`.
- The lookup never logs an Origin or a Website.
