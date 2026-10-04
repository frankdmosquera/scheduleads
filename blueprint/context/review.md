# Independent Review

**Status:** passed
**Target commit:** 7a353a89f30eec769210ef52c88fd1cfe05a8f1f
**Base commit:** a55c8eebeabc63ef9f9fb7bd233d118a134309a3
**Base ref:** main
**Spec hash:** 17c19a1f090d74a2dd7977cb7f7151362149e158103e7f6757f3e99aa1f002a8
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-04T16:50:04Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-04T16:56:18Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `a55c8eebeabc63ef9f9fb7bd233d118a134309a3..7a353a89f30eec769210ef52c88fd1cfe05a8f1f` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`: pass (equals Target commit)
- `git merge-base main HEAD`: pass (equals Base commit)
- `sha256sum blueprint/context/current-feature.md`: pass (equals Spec hash)
- `git status --porcelain`: pass (only `blueprint/context/review.md` modified, plus the untracked `blueprint/ai-voice-proposal.md` named under Remaining risk)
- `npm run build --workspace=backend`: pass
- `npm run test --workspace=@scheduleads-app/shared`: pass (16 files, 111 tests)
- `npm run test --workspace=backend`: pass (58 files, 570 tests, against the local seeded `scheduleads_dev`)
- `npm run build --workspace=frontend`: pass (`/b/[token]` dynamic)
- `npm run lint --workspace=frontend`: pass
- `npm run format:check`: pass

## Evidence

- Whole delta read across all 57 files (17 commits, 548c727..7a353a8), the spec's decisions 1 to 13 and its contracts checked against the code.
- Move transaction (move-booking.ts:187-262): the booking row locked `for update` before deciding, old rows released before the new hold, each hold in a savepoint (hold-time.ts), every choice taken undoes the whole move; cancel-booking.ts locks the same row, so a move and a cancel make one outcome.
- Free times for a move (find-free-times.ts:60-73,114-143): own held rows left out by booking id, Google cross-off only for the booking's own person, a switched-off service read only when `ignoreBooking` is set (decision 13).
- Google follow (move-booking-event.ts) traced across the id rule (calendar-event-id-of.ts), the first write (write-booking-event.ts:214) and the cancel's removal by saved id (remove-booking-event.ts:140-143): same person patches, a person change writes the new event first and removes the old one by its saved id; each written id carries a sequence never reused in that calendar.
- Invite numbers end to end: confirmation 0 (send-booking-emails.ts), move N from its own timeline entry (send-move-emails.ts:43-72), cancel `sequence + 1` (send-cancellation-emails.ts); move emails keyed per sequence.
- Public boundary: token-only booking id, every other read and write inside the booking row's business, identical 404 for a bad link and a person who does not offer the service, `no-store` on all three routes, no customer details in answers, the timeline payload or log lines; the `bookings` slug refused at provisioning (F-137 already tracks the organization update path).
- Frontend: change-time-panel.tsx and booking-page.tsx read against the route contracts (states, 409 codes, lastDate, personId); public client only.
- No `.only`, `.skip` or `.todo` in the backend or shared tests.
- Verified and closed fixed findings F-141, F-148, F-154, F-155, F-157, F-158, F-159, F-160, F-162, F-163.

## Findings

- F-164 [P2] open: the panel's "call" link at the last bookable week strips every digit from the phone (`/[^d+]/g`), change-time-panel.tsx:392
- F-165 [P3] open: finding and step numbers in three new code comments
- Not blocking: no P0 or P1 is open or fixed in the ledger.

## Remaining risk

- `/check` was not required and not run; no dev server or browser was started, so the frontend fixes F-157, F-158 and F-162 were closed on reading the code, and F-161 (320px layout) stays `fixed` without a measurement in this pass.
- No real Google calendar or Resend account was exercised; F-149 and F-150 (orphaned events when a follow fails or races) and F-153 (unverified PATCH of a hand-deleted event) remain open for feature 8.
- No frontend test runner exists, which is how F-164 passed every check; the panel's date and week helpers are covered only by hand checks.
- No rate limit on the public move route (feature 9): each move sends two emails and Google calls.
- The untracked `blueprint/ai-voice-proposal.md` (the owner's note, outside the review scope) is present in the working tree; freshness requires no untracked path besides the ledger and this file, so it should be moved, ignored or committed before `/complete` checks this receipt.
