# Independent Review

**Status:** changes-requested
**Target commit:** 258544ce81261578e0187741bf2c6456c8d0db04
**Base commit:** aa8627dc45f0c3f93ccb24187403abaa3f2f839c
**Base ref:** main
**Spec hash:** a10376e6d133f590b47750c12077564a15fea6de9815c01dde0f925a8b98c3f4
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-27T16:43:22Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-27T16:48:28Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** changes-requested
**Check result:** not-required

## Handoff

Review the active spec and the complete `aa8627dc45f0c3f93ccb24187403abaa3f2f839c..258544ce81261578e0187741bf2c6456c8d0db04` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain`: pass (HEAD, merge base and spec hash match the request; only review.md differed)
- `npm run build --workspace=backend`: pass
- `npm run test --workspace=backend`: pass (96 files, 1103 tests)
- `npx vitest run routes/public-booking-links-routes.test.ts --reporter=verbose` (in backend): pass (all five 25b tests green)

## Evidence

- Delta reviewed in full: backend/lib/booking/website-domain-for-slug.ts (new), backend/middleware/public-middleware/public-cors-middleware.ts, backend/routes/public-booking-links-routes.test.ts, AGENTS.md, blueprint/build-plan.md, blueprint/context/project-overview.md, blueprint/context/current-feature.md.
- Context read: backend/app.ts:54 (CORS before the rate limiter on /public/*), hono 4.13.14 cors (origin function awaited on every request; OPTIONS answered inside cors without next()), hono getPath (decodeURI, so %62ookings resolves to the reserved `bookings` segment and %2F stays encoded), backend/lib/email/website-domain.ts, the slug schema, business-name-validation-schema.ts (`bookings` refused as a slug).
- Origin matching holds: exact string equality against `https://<domain>` and `https://www.<domain>`, domain lowercased from the Website; look-alike suffixes, other subdomains, http, and any explicit port are refused; Allow-Origin names the Origin, never `*`, never with credentials; Vary: Origin is still appended.
- Tenant isolation holds: the Website compared is the one of the slug in the path, and the router reads the same decoded path, so the slug checked is the slug served.
- The booking page (`/public/bookings/...`) keeps the fixed list only; a failed lookup returns null and is not cached; the warning logs only safeErrorReason, never an Origin or Website.
- Blocking: F-544, the Map is never pruned and a preflight to any slug-shaped path adds an entry and a query with no rate limit (website-domain-for-slug.ts:15,28; public-cors-middleware.ts:29-34; app.ts:54).

## Findings

- F-544 [P1] open - The Website cache grows without limit, and a preflight fills it with no rate limit
- F-545 [P3] open - `.env.example` still says WIDGET_ORIGINS is for live client sites
- F-546 [P3] open - The one-minute cache and the failed-lookup path have no test, and the `now` seam is unused

## Remaining risk

- Check was not required and was not run; no browser has called a real client site against the API.
- F-544's memory growth is confirmed from the code path, not measured under load.
- Staleness after a Website change (up to one minute) is by design and untested (F-546).
