# Independent Review

**Status:** passed
**Target commit:** 6c1fa5d390c04f39b72c20cc6f80cad9e2368238
**Base commit:** a55c8eebeabc63ef9f9fb7bd233d118a134309a3
**Base ref:** main
**Spec hash:** 17c19a1f090d74a2dd7977cb7f7151362149e158103e7f6757f3e99aa1f002a8
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-04T17:16:02Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-04T17:21:58Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `a55c8eebeabc63ef9f9fb7bd233d118a134309a3..6c1fa5d390c04f39b72c20cc6f80cad9e2368238` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `npm run build --workspace=backend`: pass
- `npm run test --workspace=@scheduleads-app/shared`: pass (17 files, 112 tests)
- `npm run test --workspace=backend`: pass (58 files, 573 tests, local Postgres 18, seeded scheduleads_dev)
- `npm run build --workspace=frontend`: pass
- `npm run lint --workspace=frontend`: pass
- `npm run format:check`: pass

## Evidence

- Preflight: HEAD equals the target, `git merge-base main HEAD` equals the base, the spec's SHA-256 matches, and the only tracked change is this file (plus the owner's untracked personal note, outside the review scope).
- Whole delta read (66 files): move-booking.ts (pre-check, locked transaction, release before hold, rollback through EveryChoiceTakenError, follow and emails started only on a real move), find-booking-move-times.ts, find-free-times.ts (`ignoreBooking`, own rows left out, crossOffSpan only for the booking's own person, switched-off service kept), cross-off-span.ts, the move and times routes (token first read from the signed link, identical 404s, 409s, 503, bodyLimit 1 KB, JSON refusal shape, no-store), move-booking-event.ts and the provider's updateEventTime, calendar-event-id-of.ts, the cancel's removal by saved id, send-move-emails.ts (facts from the move's own entry, keys per sequence, cancel at sequence + 1), both move templates, booking-ics.ts, migration 0018, the slug refusal, telHref, change-time-panel.tsx, booking-page.tsx, api-client.ts (public client only), and the Blueprint skill edits.
- Security: no customer details in any answer, log line or timeline payload of the new code; no token logged; every query after the token read filters on the booking row's own business; the person and query ids are schema-checked before any query.
- Tests lens: no skipped, focused or placeholder tests in the delta's test files; F-168 to F-171 recorded from reading the code paths and the test fixtures.
- Ledger: F-166 and F-167 closed after re-reading the repaired files; F-146 and F-161 left `fixed` with notes (unchanged test name; 320px still unmeasured).

## Findings

- F-168 [P2] open: "Any available", the panel's default, can move the booking to another person while her own is free, and the confirm question never names the person.
- F-169 [P3] open: a failed write into the new person's calendar skips the removal from the first person's.
- F-170 [P3] open: the move-times privacy test reads a 503 refusal, not the times, when its file runs in order.
- F-171 [P3] open: AGENTS.md's branch example lacks the build-plan number the skills now require.
- Closed this pass: F-166, F-167. No P0 or P1 is open or fixed.

## Remaining risk

- No browser run in this review (Check not required, no dev server started): focus, announcements and the 320px week bar (F-161, still `fixed`) were read in code only.
- No Verify command, no browser test harness and no frontend test runner exist in this project, so the page's behaviour rests on the builder's manual browser checks.
- Real Google behaviour is faked in every test; F-153 (a PATCH of a hand-deleted event) remains unverified.
- Carried to feature 8 and still open: F-149, F-150 (orphan events when a follow fails or two moves overlap), F-156 (six background trackers), F-145 (the move's copy of bookTime's check).
- `blueprint/ai-voice-proposal.md` is an untracked personal note outside the review scope; it is not part of the target.
