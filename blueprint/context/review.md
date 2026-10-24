# Independent Review

**Status:** passed
**Target commit:** fe03a61255f163fd2eb41cafc08fc79af84c5032
**Base commit:** 576bdaf322eb1e4934a701ccfb7db81b5b96536a
**Base ref:** main
**Spec hash:** c57ef1ccde6c4bbab337ac1fefe3912ee808901510df97b6ef1bab7af9373901
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-24T14:25:07Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-24T14:31:00Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `576bdaf322eb1e4934a701ccfb7db81b5b96536a..fe03a61255f163fd2eb41cafc08fc79af84c5032` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain`: pass (HEAD and merge base match the request, spec hash matches, only review.md differed)
- `npm run test --workspace=@scheduleads-app/shared`: pass (31 files, 209 tests)
- `npm run test --workspace=@frankdmosquera/booking-component`: pass (18 files, 98 tests)
- `npm run test --workspace=backend`: pass (92 files, 1074 tests, against local `scheduleads_dev` with 0032 applied)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass
- `npm run lint --workspace=frontend`: pass
- `npm run format:check`: pass

## Evidence

- Whole delta read (38 files, one commit fe03a61), the 3127-line drizzle snapshot excepted beyond its journal entry.
- `PUT /me/language` (backend/app.ts:80-97) takes the login from the session only, validates with a two-value Zod enum, answers 400 `bad_request` "Use en or es.", sits behind CORS, CSRF and no-store (`/me/*`, app.ts:36); backend/app-me.test.ts proves own login only, a `userId` in the body ignored, 400 for `fr`/null/missing/non-object, 401 signed out, 403 for a cross-site form, idempotent, read back on `/me`.
- `user.language` is nullable text with check `in ('en','es')` (migration 0032, user-table.ts:27-29) and `input: false` to Better Auth (auth-server.ts), so Better Auth's own endpoints cannot write it; the middleware narrows the session value to `en | es | null`.
- Better Auth 1.7.5 calls `sendVerificationOTP(data, ctx)` with the endpoint context (node_modules/better-auth/dist/plugins/email-otp/routes.mjs:107-111) and only for known addresses when sign-up is closed; the language lookup runs inside the un-awaited send, so a known address still answers before its email (login-code-timing.test.ts).
- The client sends `Accept-Language` through Better Auth's second-argument fetch options (client/proxy.mjs:31-35); the value is a safelisted header and is reduced to `en | es` by `pickDashboardLanguage`, so it cannot inject anything.
- Email HTML interpolates only fixed words and the code; every dashboard word is rendered as React text.
- Word lists: one `DashboardWordsType`, English and Spanish objects typed against it, Spanish in "usted"; the provider in the root layout, `localStorage` reads and writes wrapped in try/catch.
- Performance: one indexed lookup by email per code email sent; no new per-render or unbounded work found.

## Findings

- F-469 [P2] open: the sign-in page's switch tries to save to an ended login after "Sign in again" (client-side navigation keeps `signedIn: true`).
- F-470 [P3] open: no saved test carries `Accept-Language` through Better Auth's hook to the code email's language.

## Remaining risk

- Check was not required and was not run: the Done when's browser walk (Spanish browser, switch surviving reload and a second browser, two logins keeping their own, a Spanish code email) was not re-observed by this review.
- F-469 is code-path evidence only, not reproduced in a browser.
- Migration 0032 still has to be applied on live by hand before the merge deploys the API (spec Build loop).
- The frontend has no test runner; the word lists rest on the type check and hand checks.
