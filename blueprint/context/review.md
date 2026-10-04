# Independent Review

**Status:** passed
**Target commit:** 5db122e0d21e14071a11e9d4858c6c6299d58df1
**Base commit:** a55c8eebeabc63ef9f9fb7bd233d118a134309a3
**Base ref:** main
**Spec hash:** 17c19a1f090d74a2dd7977cb7f7151362149e158103e7f6757f3e99aa1f002a8
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-04T17:00:36Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-04T17:05:16Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `a55c8eebeabc63ef9f9fb7bd233d118a134309a3..5db122e0d21e14071a11e9d4858c6c6299d58df1` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `npm run build --workspace=backend`: pass
- `npm run test --workspace=@scheduleads-app/shared`: pass (17 files, 112 tests)
- `npm run test --workspace=backend`: pass (58 files, 570 tests, against the local scheduleads_dev)
- `npm run build --workspace=frontend`: pass
- `npm run lint --workspace=frontend`: pass
- `npm run format:check`: pass

## Evidence

- Preconditions held: HEAD 5db122e, merge-base of main and HEAD a55c8ee, spec SHA-256 matches, only review.md modified plus the owner's untracked note blueprint/ai-voice-proposal.md (outside scope, left alone).
- Whole delta read (66 files): move-booking.ts, find-booking-move-times.ts, find-free-times.ts (ignoreBooking, crossOffSpan), move-booking-event.ts and the Google provider's PATCH, calendar-event-id-of.ts, write and remove event, send-move-emails.ts, booking-ics.ts, both move templates, the public booking page routes, migration 0018, the shared tel-href and zod schemas, change-time-panel.tsx, booking-page.tsx, api-client.ts, and every new or changed test.
- Security: the booking is found by id only from a verified signed token; every later read and write filters on the booking row's own business (commitments, resource names, holds, timeline, lead join); a body person id is regex-checked and must be in the service's own people; answers carry no customer details and are no-store; body limit 1 KB and non-JSON give the same refusal shape.
- Correctness: the booking row is locked for update before deciding; old held rows released before the new hold, with the overlap rule as the race guard; a same-start press answers unchanged with no writes; the Google event follows by PATCH for the same person and write-then-delete for another, under a sequence-suffixed id; invites carry the move's sequence and the cancel's sequence + 1.
- No route collision: the slug routes need a `booking-links` or `bookings` segment after the slug, and the slug `bookings` is refused when a business is made.
- No skipped, focused or placeholder tests in the delta.

## Findings

- F-166 [P3] open - step numbers in two new test file headers
- F-167 [P2] open - no test makes a calendar unreadable during a move, so the move's 503 `unavailable` answers are unpinned
- F-164, F-165 closed this pass
- F-146, F-161 left `fixed` with notes (not closed this pass)
- No P0 or P1 finding is open or fixed

## Remaining risk

- Check not required and not run; no dev server started, so the change-time panel was not seen in a browser by this review (F-161's 320px layout for a week across two months is unmeasured).
- No frontend test runner and no browser test harness: the panel's states and focus rest on the builder's manual browser checks.
- Known carried risks stay with feature 8: an orphaned Google event when the follow cannot remove the first person's event or two moves overlap one follow (F-149, F-150), a PATCH of a hand-deleted event may answer 200 (F-153, unverified), and the move's free check is a copy of bookTime's (F-145).
- Unverified, not recorded as a finding: a move pressed within the moment before the booking's first Google write lands could leave the first event at the old time beside the new one; the same class as F-150.
- Local manifest only; no dependency vulnerability scan was run.
