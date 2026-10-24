# Independent Review

**Status:** changes-requested
**Target commit:** 6e24d7e5b6d7fb5187e3fb9edd1520480d1cce62
**Base commit:** 576bdaf322eb1e4934a701ccfb7db81b5b96536a
**Base ref:** main
**Spec hash:** f32ceaf64418f57b12ff110bdd821d0731174af1d75d763eace5bb623829afec
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-24T18:33:33Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-24T18:41:26Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** changes-requested
**Check result:** not-required

## Handoff

Review the active spec and the complete `576bdaf322eb1e4934a701ccfb7db81b5b96536a..6e24d7e5b6d7fb5187e3fb9edd1520480d1cce62` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `npm run test --workspace=@scheduleads-app/shared`: pass (32 files, 214 tests)
- `npm run test --workspace=backend`: pass (92 files, 1077 tests, local Postgres)
- `npm run test --workspace=@frankdmosquera/booking-component`: pass (18 files, 98 tests)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass
- `npm run lint --workspace=frontend`: pass
- `npm run format:check`: pass

## Evidence

- Freshness checked before review: HEAD is 6e24d7e, `git merge-base main HEAD` is 576bdaf, the spec's SHA-256 matches, and only `blueprint/context/review.md` differed from the target.
- Blocker F-476 (P1): `schedule-screen.tsx:45-49` fetches one week when no date is asked, and the Today button (line 293) asks no date, so the Month view after Today draws a single week under the month's heading.
- F-477 (P2): only GET `/settings/days-off` names closed holidays in Spanish (`settings-routes.ts:485-497`); the PUT, close and open answers (lines 522, 579, 598) are English and replace the screen's list (`days-off-screen.tsx:98, 135, 187`).
- F-478 (P2): a script over backend routes, lib and middleware listing sentence literals missing from `spanish-messages.ts` found dashboard refusals the completeness test's two patterns cannot reach (ternaries in `refuse`, `reason:` literals in the email key checks).
- The custom fetch in `dashboard-api-client.ts` was read for Request, URL and string inputs, non-JSON and ok answers, admin paths, and its rebuilt headers (content-length dropped); no defect found. The provider's layout effect runs before any screen's passive effect, so first fetches use the right language.
- `dashboard-form-resolver.ts` is used by every non-admin form that has a resolver; the admin client-setup form and the customer booking page still use their own, unchanged.
- `calendar-dates.ts` (Monday, month weeks, zone placement, cut to the day) and `lanesOf` in `schedule-time-grid.tsx` were traced by hand; no date or lane defect found. The `live` flag drops a late calendar answer.
- F-471, F-472, F-473 and F-475 re-examined against the new code and moved to closed; F-474 stays accepted.

## Findings

- F-476 [P1] open: Month view after Today shows only the current week
- F-477 [P2] open: closed holidays turn English after a Days off save
- F-478 [P2] open: some dashboard refusals untranslated and missed by the completeness test
- F-479 [P3] open: Spanish templates with English values or wrong agreement
- F-480 [P3] open: Month view reads Google busy times 4-6 times for nothing shown
- F-481 [P3] open: question presets follow the login's language, not the business's
- F-482 [P3] open: misplaced comment in settings-routes.ts
- F-471, F-472, F-473, F-475 closed by this pass

## Remaining risk

- Check was not required and was not run; nothing was clicked on http://localhost:3400, so F-476 and F-477 rest on the code paths cited, not on a screen.
- The frontend has no test runner: the custom fetch, the form resolver and the calendar's date and lane logic have no saved tests.
- The completeness test reads code by pattern; messages built in other shapes than those named in F-478 may still be missed.
- F-480's cost (Google calls per Month view) was not measured.
