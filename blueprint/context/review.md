# Independent Review

**Status:** passed
**Target commit:** f396e3244046d7048b60386d0f29e71e786f2478
**Base commit:** d46b7bff43c7afad9b94b7e70ecb01d32d31e00f
**Base ref:** main
**Spec hash:** 8196bb5bdea8182017c411141783ca5b6f2079649737b20d15518d0b5bee9f4a
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-25T15:55:25Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-25T16:01:35Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `d46b7bff43c7afad9b94b7e70ecb01d32d31e00f..f396e3244046d7048b60386d0f29e71e786f2478` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `npm run test --workspace=@scheduleads-app/shared`: pass (32 files, 214 tests)
- `npm run test --workspace=backend`: pass (95 files, 1098 tests)
- `npm run test --workspace=@frankdmosquera/booking-component`: pass (18 files, 98 tests)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass
- `npm run lint --workspace=frontend`: pass
- `npm run format:check`: pass

## Evidence

- Freshness: HEAD = f396e32 (target), `git merge-base main HEAD` = d46b7bf (base), SHA-256 of current-feature.md = 8196bb5b... (matches), only `blueprint/context/review.md` differed from the target before this review.
- Read the whole delta (15 files): services-screen.tsx, service-form.tsx, own-hours-part.tsx (renamed from person-hours-part.tsx), own-hours-fields.tsx, people-screen.tsx, change-resource-form.tsx, add-resource-form.tsx, use-report-saving.ts, services-words.ts, hours-words.ts, the two deleted hours cards, and the spec and ledger changes.
- Spec: one box per service with the hours line in the closed row; one Save running check, service, ticks, hours in order with `hoursNow` taken before the first await; a new service gets no hours part; members see a read-only card with "See"/"Close"; new words present in English and Spanish; no references left to the deleted cards or removed words (`git grep`).
- Security and performance: no new routes, inputs or queries; the frontend calls the existing typed clients (saveService, saveServiceResources, saveServiceHours, savePersonHours); nothing new is unbounded.
- Tests: no frontend test runner exists (AGENTS.md); the delta adds no shared or backend logic, and every existing suite passes.
- F-511 and F-514 re-examined against use-report-saving.ts, people-screen.tsx, change-resource-form.tsx, services-screen.tsx and service-form.tsx: reopened, because Cancel stays enabled while a card saves and the unmount cleanup re-enables every Change, so both races remain reachable through Cancel.

## Findings

- F-511 [P3] reopened (open)
- F-514 [P3] reopened (open)
- F-515 [P2] open (new)

## Remaining risk

- No dashboard login for this reviewer: the UI paths (one card per service, the read-only member card, the race and focus behaviour behind F-511, F-514 and F-515) were judged from the code, not run in a browser.
- `/check` was not required and not run.
- The frontend has no unit tests, so the Save chain's order and the Cancel outcomes are covered only by the builder's manual checks.
