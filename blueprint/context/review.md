# Independent Review

**Status:** passed
**Target commit:** 1811dcc796815ec58782be0720112bc715676b09
**Base commit:** 576bdaf322eb1e4934a701ccfb7db81b5b96536a
**Base ref:** main
**Spec hash:** f32ceaf64418f57b12ff110bdd821d0731174af1d75d763eace5bb623829afec
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-24T19:01:18Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-24T19:07:41Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `576bdaf322eb1e4934a701ccfb7db81b5b96536a..1811dcc796815ec58782be0720112bc715676b09` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `npm run test --workspace=@scheduleads-app/shared`: pass (32 files, 214 tests)
- `npm run test --workspace=backend`: pass (92 files, 1078 tests, against the local seeded `scheduleads_dev`)
- `npm run test --workspace=@frankdmosquera/booking-component`: pass (18 files, 98 tests)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass (types, routes and the typed client compile with `google: "skipped"` and the new Days off query)
- `npm run lint --workspace=frontend`: pass
- `npm run format:check`: pass

## Evidence

- Freshness: `HEAD` is 1811dcc796815ec58782be0720112bc715676b09, `git merge-base main HEAD` is 576bdaf322eb1e4934a701ccfb7db81b5b96536a, the spec's SHA-256 matches, and only `blueprint/context/review.md` differed from the target before this receipt.
- F-476: every `onAsk` in `frontend/components/schedule/schedule-screen.tsx` now carries a date (picker line 208, Today line 295), so the Month view always asks `weeksOfMonth`.
- F-477: `namedIn` (`backend/routes/settings-routes.ts:76-99`) serves GET, PUT, POST close and POST open; each validates `language` before the body; `frontend/lib/api-client/settings/save-days-off.ts` sends it; `days-off-screen.tsx:56-61` adopts a re-read answer during render after the provider's layout effect sets the language.
- F-478/F-479: the widened completeness rules pass; a separate probe of every backend sentence literal found none reachable from a dashboard refusal without Spanish; `spanishValueOf` rewrites only values shaped exactly like `formatTextTime`'s output.
- F-480: the strict week query takes only `google=skip`; `find-schedule-week.ts:151-152` skips the connection read and `getBusyTimes`; the one `google` consumer (`schedule-screen.tsx:305`) is unaffected by "skipped".
- F-481: the repair reads the business's language, but only as read when the page opened (reopened, P3).
- Security: `PUT /me/language` takes the login from the session alone, `language` is `input: false` in Better Auth, the login code's language is read off the response path, and no cookie cache keeps a stale session language.

## Findings

- F-476, F-477, F-478, F-479, F-480, F-482 closed.
- F-481 [P3] reopened as open: ready-made questions use the business language read at page load, stale after a language save on the same page.
- F-483 [P3] open: after a language switch, the Days off holiday picker keeps its countries and holiday names in the old language.

## Remaining risk

- The frontend has no test runner, so F-476, F-477's re-read and F-480's Month request are proved by code reading and the builder's manual checks only.
- POST `/settings/days-off/close` and `/open` in Spanish, and a bad `language` on PUT, close or open, have no route test of their own; they share `namedIn` and the validator with the tested GET and PUT.
- A save answer that arrives after a language switch merges names in the old language over the re-read list; not reproduced, low likelihood.
