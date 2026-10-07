# Independent Review

**Status:** passed
**Target commit:** 5fc8ab0b6e12b3d383c0b4d2fab47faa48345209
**Base commit:** 3b47c1cfa2a6949d90ebd1a8b8fceca0a0949db6
**Base ref:** main
**Spec hash:** 3e32ab519e33a11e0bb3fdc274263eca3e9d9ec3e4043e313a84c6ed2b48578e
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** runtime default (exact model not known until reviewer starts)
**Requested execution:** automatic
**Requested at:** 2026-10-07T22:23:54.261Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-07T22:29:39Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `3b47c1cfa2a6949d90ebd1a8b8fceca0a0949db6..5fc8ab0b6e12b3d383c0b4d2fab47faa48345209` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

The untracked `blueprint/ai-voice-proposal.md` is the owner's own file, never committed and
outside this work item; it is not part of the target and does not make the review stale.

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain`: pass (HEAD = target, merge base = base, spec hash matches, only review.md modified plus the owner's untracked ai-voice-proposal.md)
- `npm run test --workspace=backend`, six runs in a row: pass (69 files, 737 tests, every run)
- `npm run test --workspace=@scheduleads-app/shared`: pass (19 files, 142 tests)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass (the /texts route reaches AppType)
- `npm run format:check`: pass

## Evidence

- Whole delta read against the spec: the text door (send-text.ts, find-sent-text.ts, twilio-account.ts, twilio-error-code.ts), the settings table and migrations 0019/0020 with their checks, the zod schema and seed, textablePhoneNumber, the confirmation and reminder senders (send-booking-text.ts, booking-text-job.ts, enqueue-booking-texts.ts, book-time.ts and move-booking.ts in the same transaction), the wording (plain-text.ts, fit-business-name.ts, text-piece-length.ts, format-text-time.ts, render-*-text.ts), the packed booking link (booking-page-token.ts, one canonical spelling, 128-bit truncated HMAC compared in constant time), the reply route (bodyLimit, signature over apiOrigin, never Host, message id pattern, job key) and the pass-on job (pass-on-reply.ts, text_reply claim, email first with both tried every run), and every new test file.
- Security: the incoming route takes only a post signed with the auth token for the configured origin; the job reads words back from Twilio and checks Twilio's `to` against the business's number and the text_reply row against the organization, so a forged or replayed post cannot change words or cross tenants; logs carry ids and reasons only; payloads hold ids only; no secret in the delta.
- Performance: reply and booking texts are one job each with a bounded number of queries and at most one Twilio list call of 20; no unbounded loop found. findReplySenderName scans one business's leads with regexp_replace, acceptable at tenant size.
- Fixed findings re-examined against the target code: F-218, F-222, F-230, F-232, F-233, F-234, F-235 closed with evidence in the ledger; F-217, F-219, F-231 left `fixed` because their shared repair (0c023a7) introduced F-236.
- F-236 found by reading pass-on-reply.ts:157-161 against send-text.ts:89-94 and find-sent-text.ts:47-55, and the route test's lapseClaims (:336-342), which writes a claim onto the row the lost send had released; no product or test file was changed.

## Findings

- F-236 [P2] open: a pass-on text whose send was taken with its answer lost (or whose Twilio check failed with a status) lets its claim go, so the retry sends it again unchecked; the lost-answer route test masks it.
- F-217, F-219, F-231 [P3] left `fixed`, to close with F-236.
- F-218, F-222, F-230, F-232, F-233, F-234, F-235 closed.
- No P0 or P1 open or fixed.

## Remaining risk

- No live Twilio: sending, the message list, Twilio's real signature over a real webhook address, MMS fields and STOP handling are proved only against fakes; a live text to a real phone stays a hand check at deploy, on Frank's yes.
- No live Resend for the reply email; it is faked in the route tests.
- No browser check and no /check run (not required); the booking page opening from the packed link is proved by the backend route tests only.
- F-236 (P2) can send a duplicate pass-on text to a business's phone after a lost Twilio answer until it is fixed.
- F-229 (unverified): no cap on replies passed on as texts; a cost question carried to the packages note.
- Deploy items carried from the spec: the Twilio keys on Railway, a number per business, each webhook set to exactly `${BETTER_AUTH_URL}/texts/incoming`, a short APP_ORIGIN, and F-176/F-179 from 8a.
