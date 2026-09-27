# Independent Review

**Status:** passed
**Target commit:** e58e0a008527b9fd67f62dcb4c88d7fbe69947b3
**Base commit:** 931ecadd49bebb38bd9f02bf27a2deeab0236755
**Base ref:** main
**Spec hash:** 8b3a40d01cf7b650aabf4941e26e798fba0da27493030da7d2eeeb6c802b6717
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-09-27T01:57:32Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-09-27T02:02:01Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `931ecad..e58e0a0` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

This is a per-step review (`AGENTS.md`, "A review after every step"): feature 2
is built and approved one step at a time, so steps 2.1 to 2.4 are checked in
the spec and its status is not `verified`. The last receipt passed at
`7b04316` (step 2.3). New since then (`7b04316..e58e0a0`): the F-22 to F-25
seed fixes (`2bff953`, marked `fixed`, yours to close or reopen); a Sep 26
restructure that moved and renamed backend and `packages/shared` files with no
intended behaviour change (`0e00c9c` to `26c14b2`); build log page and
workflow-rule edits; and step 2.4 itself, commit `e58e0a0`
(`e55240c..e58e0a0`): the public booking link routes, `app.ts` / `server.ts`
split, `publicCorsMiddleware`, the `not_found` and `bad_request` refusals, two
address schemas in `packages/shared/zod-validation`, and 19 saved tests that
run against the local seeded database. Judge 2.4 against its own Done when as
approved on 2026-09-26 (Part 1 pieces 1 to 5, Part 2 checks).

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (target, base and spec hash match; only `review.md` differed)
- `npm run test --workspace=backend`: pass (2 files, 30 tests, against local seeded `scheduleads_dev`)
- `npm run test --workspace=@scheduleads-app/shared`: pass (2 files, 25 tests)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass
- `npm run lint --workspace=frontend`: pass
- `npx prettier --check backend packages/shared`: pass

## Evidence

- Tenant scope: `findBookableOrganizationId` (`public-booking-links-routes.ts:38-51`) finds the business by unique slug only; the detail query (`:82-92`) filters on that `organizationId`, the link id and `active`; `resolveBookableHours(organizationId, null, ...)` reads only the business row. No query takes an id alone.
- No leak: both routes select through `publicBookingLinkColumns` (`:24-32`, no `organizationId`); the detail strips `source` (`:99`); the saved tests assert exact key sets and that neither body contains `organizationId` or `source`.
- Indistinguishable 404: every "not here" returns the one `notFound` constant; unknown slug, no hours and a plan without booking all stop after the same single query, and unknown, inactive and another business's link all after the same two, so neither body nor query count separates them. 9 parametrised tests assert the identical body.
- CORS: `publicCorsMiddleware` is `credentials: false`, `GET` only, origins `WIDGET_ORIGINS` plus `appOrigin`, mounted only on `/public/*`; read off hono 4.13.8 `middleware/cors/index.js:22,43,80`, an unlisted origin gets no Allow-Origin, credentials are only ever set when the option is true, and `Vary: Origin` is appended. The dashboard rule is unchanged from `7b04316:backend/src/server.ts`.
- Input: slug and id pass Zod regexes before any query (400 in the `refuse` shape); Drizzle parameterises the rest.
- Restructure: `get-organization-from-session.ts`, the auth and subscription middleware and `auth-server.ts` compared line by line with their `7b04316` originals; only names, paths and the `org` to `organization` context key changed.
- Seed repairs F-22 to F-25 re-read at `seed-dev.ts:57-66, 89, 112, 159, 189, 238, 246-250, 340, 356`.
- Performance: list route 2 indexed queries, detail 3 (the business hours row is read twice), no loops over queries; booking links per business are few, so the unpaginated list is bounded in practice.

## Findings

- New: F-26 [P3] open, F-27 [P3] open, F-28 [P3] open
- Closed this pass: F-15, F-22, F-23, F-24, F-25
- No P0 or P1 finding is open or fixed

## Remaining risk

- The public routes have no rate limit (out of scope in the spec, recorded as a risk there); slug enumeration and request volume are unbounded until it lands.
- The by-hand browser half of the 2.4 Done when (an allowed origin reads, a disallowed one is blocked) was not repeated by this reviewer; CORS was verified from the Hono source and the saved header tests only.
- `/check` was not run (not required by the request).
- No `Verify` command or GitHub check exists; the frontend has no test script.
- Dashboard activity (`blueprint/.state/run.json`) was not written by this reviewer: the automatic reviewer was limited to `findings.md` and `review.md`.
