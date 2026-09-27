# Independent Review

**Status:** passed
**Target commit:** 78370d9dbf9555bdcbb0fc4dcb91c8746d7908da
**Base commit:** 931ecadd49bebb38bd9f02bf27a2deeab0236755
**Base ref:** main
**Spec hash:** 67cc0e5600e408d762c53bd2ab6455fdc291d7beba31e60405f768b4203ca0e8
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-09-27T04:16:13Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-09-27T04:19:39Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `931ecad..78370d9` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

This is a per-step review (`AGENTS.md`, "A review after every step"): feature 2
is built and approved one step at a time, so steps 2.1 to 2.5 are checked in
the spec and its status is not `verified`. The last receipt passed at
`e58e0a0` (step 2.4). New since then (`e58e0a0..78370d9`): the F-26 to F-28
fixes (`fe5a144`, marked `fixed`, yours to close or reopen), and step 2.5
itself, commit `78370d9` (`fe5a144..78370d9`): `hono` and the workspace link
`"backend": "*"` declared in the frontend; `backend/tsconfig.types.json` and
the types-only export `backend/app-type`, written fresh by the frontend's
`predev`/`prebuild`; two `hc<AppType>` clients in `frontend/lib/api-client.ts`
(`dashboardApiClient` with the cookie, `publicApiClient` without); the home's
booking links list (`frontend/components/booking-links/booking-links-list.tsx`,
`frontend/app/page.tsx`); `coding-standards.md` and `AGENTS.md` corrected.
Judge 2.5 against its own Done when as approved on 2026-09-27 (Part 1 pieces 1
to 5, Part 2 checks). The by-hand browser checks and the four broken-build
outputs are recorded on the build log page, not in the repo; the broken builds
can be re-run by renaming the list route or the `durationMinutes` field in
`backend/routes/public-booking-links-routes.ts` and running
`npm run build --workspace=frontend` (restore after).

## Commands

- Freshness: `HEAD` = target, `git merge-base main HEAD` = base, spec SHA-256 matches, working tree differed only in `review.md`: pass
- `npm run test --workspace=@scheduleads-app/shared`: pass (25 tests)
- `npm run test --workspace=backend`: pass (30 tests, `pretest` seen rebuilding `packages/shared` first, against the seeded local `scheduleads_dev`)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass (`prebuild` wrote `backend/dist/types/`)
- `npm run lint --workspace=frontend`: pass
- `npm run format:check`: pass
- Broken on purpose: list route renamed to `/:slug/booking-linkz`, `npm run build --workspace=frontend`: fail as expected, `TS2339` at `lib/api-client.ts(74,28)` and `(85,44)`; restored with `git checkout`, rebuilt: pass, and the regenerated declarations no longer carry the renamed path

## Evidence

- F-26 closed: `require-known-subscription-middleware.ts:27-30` names both readers of `organization.plan`; `public-booking-links-routes.ts:37-38` points back
- F-27 closed: `coding-standards.md:197-205` public-route exception matches the route code (`public-booking-links-routes.ts:39-52`, `:63-67`, `:83-93`); `:37-40`, `:111`, `:124-125` layout and areas
- F-28 closed: `backend/package.json:16`, `:18` pre scripts; `AGENTS.md:660-665`
- 2.5 piece 1: `frontend/package.json` adds `hono ^4.13.8` and `"backend": "*"`; lockfile gains only those two lines, one `hono` 4.13.8 at the root, `node_modules/backend` a workspace link
- 2.5 piece 2: `backend/tsconfig.types.json` emits declarations only from `app.ts` into `dist/types/` (gitignored, `backend/.gitignore:2`); `backend/package.json:4-8` types-only export; `frontend/package.json` `predev`/`prebuild` chain it with `&&`, so a backend type error stops the frontend build. Emitted declarations checked for connection strings or secret names: none
- 2.5 piece 3: `api-client.ts` builds `dashboardApiClient` with `credentials: "include"` and `publicApiClient` with the fetch default (no cookie cross-origin), matching `publicCorsMiddleware`'s `credentials: false`; `MeType` inferred from `/me`'s 200 (`app.ts:27-45`); `fetchMe` keeps its signed-out, 403 and unexpected-status paths
- 2.5 piece 4: `booking-links-list.tsx` reads once per slug with a `live` guard, loading/list/empty/unreachable states, names in the route's name order; mounted at `page.tsx:225`. The 404 case is mis-stated (F-29)
- 2.5 piece 5: `coding-standards.md:51-59` and `:158-168` no longer place `AppType` in `packages/shared` and add the two-clients rule; wording slip recorded as F-30
- Security: no new write path, no `organizationId` added to any public answer, no bare `fetch` to the API left in `frontend/`; the dashboard list goes through the unauthenticated public route, so it shows exactly what a stranger sees
- Performance: one extra request per home load, after `/me`; the list is a business's services, no pagination needed at this size
- Tests: no skipped or focused tests; no frontend test runner (spec says adding one needs a yes); the typed seam is proved by the type system at every build, not by a saved test

## Findings

- F-29 [P2] open: a business with no hours yet shows "unexpected status (404)" with a Try again that cannot help (`frontend/lib/api-client.ts:82`)
- F-30 [P3] open: the docs around the new types build are half updated (`blueprint/context/coding-standards.md:59`, `AGENTS.md:644-647`)
- Closed this pass: F-26, F-27, F-28

## Remaining risk

- `/check` not run (not required); the by-hand browser checks of 2.5 (three links, empty state, unreachable and recovery, `/me`) were not repeated here, and no dev server was started, so F-29 is read off the code, not observed live
- The broken-on-purpose `durationMinutes` rename was not re-run; only the route rename was
- Vercel's install and build of the frontend (workspace root install, `backend` devDependencies present for `build:types`) are assumed, not proved; if the frontend were ever installed outside the workspace, the unscoped `"backend": "*"` would resolve from the public registry
- The dashboard dev server keeps old route types until restarted (said out loud in the spec)
- Open from earlier work and not re-examined: F-12, F-13, F-14, F-16
