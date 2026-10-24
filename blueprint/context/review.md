# Independent Review

**Status:** passed
**Target commit:** 639a834d5d4e03e8bd2a0e7283fe77706beee251
**Base commit:** c2173536dc775768d51b40250145b611b0a2f9df
**Base ref:** main
**Spec hash:** 29280a14bdb4bb55478fe63844ca1767cc89ed354292f1d549bca275cccc50e3
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-24T00:22:48Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-24T00:28:37Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `c2173536dc775768d51b40250145b611b0a2f9df..639a834d5d4e03e8bd2a0e7283fe77706beee251` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `npm run test --workspace=@frankdmosquera/booking-component`: pass (93/93 on two reruns; the first run failed 2 window tests on timing, recorded as F-461)
- `npm run build --workspace=@frankdmosquera/booking-component`: pass (dist imports only react, react-dom, hono, zod)
- `npm run test --workspace=@scheduleads-app/shared`: pass (203/203)
- `npm run test --workspace=backend`: pass (1055/1055, against local `scheduleads_dev`)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass
- `npm run lint --workspace=frontend`: pass
- `npm run format:check`: pass

## Evidence

- Pre-review state: HEAD 639a834 equals the target; `git merge-base main HEAD` is c217353; spec SHA-256 matches; only `blueprint/context/review.md` differed from the target.
- Spanish words (`words/spanish-words.ts`): every line is in "usted" ("Elija", "Escriba su", "Le enviamos", "presione"); weekday keys are unique; every form message the shared rules and `missingContact` can produce is mapped, and anything unmapped gets the general Spanish line, never English.
- English unchanged for existing sites: `language` defaults to "en" on the prop, both schemas and `formatBookingTime`; English free-times questions carry no `language`; English screens still show the API's own words; `capitalized()` is a no-op on English output. The one English difference is that the booking body now always carries `language: "en"` (spec amendment); `z.object` strips it on an older API.
- After booking: `BookedType` is built from id, service name, startsAt and zone only (booking-window.tsx:164-169), and the test asserts nothing of "jane" reaches `onBooked`. `onBooked` and the redirect are each wrapped in try/catch. The done screen is set before either runs, so no form is left to press. The retry after a lost answer reuses the form key, and `onBooked` fires only on the one 201 that settles it.
- `language` validation: `z.enum(["en","es"])`, optional, on the free-times query (400 "Use en or es." tested) and the booking body (refused through the shared schema, untested: F-460). The customer page's times route shares the query schema, so it validates and ignores `language` until 12i.2.
- English left in a Spanish window: a grep of the package's screens found none outside the word lists. The texts-consent words, service names, descriptions and question labels are the business's own data (out of scope).

## Findings

- F-457 [P3] open - Spanish month and day names keep their capital mid-sentence
- F-458 [P3] open - A thrown onBooked still redirects, unlike the spec's wording; untested
- F-459 [P3] open - The dialog carries no lang
- F-460 [P3] open - No test refuses a bad language on the booking route; some screens never drawn in Spanish
- F-461 [P3] unverified - Window jsdom tests missed their 1 s wait on one cold run

## Remaining risk

- The laptop part of the Done when (a Spanish test page end to end, landing on a thank-you page) was not observed by this review: Check was not required and no dev server was started.
- Spanish dates come from each visitor's browser ICU (day, month and zone names), which this review saw only through Node's ICU in jsdom.
- The booking component's test command failed once on timing before passing twice (F-461).
- No dashboard activity was written for this review: the reviewer was limited to `findings.md` and `review.md`.
