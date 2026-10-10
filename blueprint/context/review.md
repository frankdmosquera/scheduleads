# Independent Review

**Status:** passed
**Target commit:** 28a2f1cfe8f0fd6fcfd1fcd2e1ca71fd754f8183
**Base commit:** ece1aa2b995f5395f9f35fdd568a985659a3495f
**Base ref:** main
**Spec hash:** f24901865565ed52eaa3463678280f41266c06badbfee83e51d1ed3cf0f30005
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** runtime default (exact model not known until reviewer starts)
**Requested execution:** automatic
**Requested at:** 2026-10-10T00:38:29.000Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-10T00:42:42.000Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `ece1aa2b995f5395f9f35fdd568a985659a3495f..28a2f1cfe8f0fd6fcfd1fcd2e1ca71fd754f8183` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

The untracked `blueprint/ai-voice-proposal.md` is the owner's own file, never committed and
outside this work item; it is not part of the target and does not make the review stale.

## Commands

- `npm run test --workspace=@scheduleads-app/shared`: pass, 167 of 167 (22 files)
- `npm run test --workspace=backend`: pass, 887 of 887 (78 files), against the local seeded `scheduleads_dev`
- `npm run test --workspace=@scheduleads-app/booking-component`: pass, 76 of 76 (16 files)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=@scheduleads-app/booking-component`: pass
- `npm run build --workspace=frontend`: pass
- `npm run lint --workspace=frontend`: pass, no output
- `npm run format:check`: pass

## Evidence

- Preconditions: `HEAD` is the target; `git merge-base main HEAD` is the base; the spec's sha256 matches; the only paths differing from the target are `blueprint/context/review.md` (this file) and the untracked owner file named above.
- Whole delta read across 205 files: the migrations 0022 to 0024 and their tables (booking_link layout and personChoice, booking_question, lead.answers, later_texts_yes with its tenant-scoped foreign key, text_settings.askLaterTextsYes); the shared create-booking schema; bookTime (the form's own look-up before the contact limit, person_not_taken, answers checked and snapshotted, the yes upserted per number inside the transaction); the public routes (business face and questions, personChoice on the times, move times and move routes, localStartTimes and `when`); the rate limiter, its middleware after CORS, the contact keys and one-copy-of-a-form; PublicAppType; the package (client with credentials omitted and a 10-second limit, provider, trigger, window, both month screens, the form view, the done screen, CSS); the frontend preview page (platform admin only), the customer-booking move to a rewrite of /b/, and the api-client split; the seed.
- The last commit (28a2f1c) read line by line: booking-form-view.tsx freezes the form from the press (`frozen = sending || unsure`, `onFrozenChange(true)` before the send), month-details-screen.tsx hides Back while frozen, the status line holds the focus while sending, and `sendBooking` cannot reject, so every send reaches the unfreeze; seed-dev.ts upgrades `askLaterTextsYes` only on an untouched row.
- Security: every new query is scoped by organizationId; the people list shows id and name only; answers and labels are rendered as React text and in the email as text; `X-Real-IP` is read only in production (its spoofing check stays a deploy note); no secrets in the delta.
- Tests lens: no `.only`, `.skip` or `.todo` added; the new window test holds the first send and asserts Back hidden and fields disabled before and after a lost answer.
- No em dashes in the added lines; no finding numbers left in backend, frontend or packages code.

## Findings

- F-293 [P2]: closed (repair re-reviewed)
- F-294 [P3]: closed
- F-295 [P3]: closed
- F-296 [P3]: closed
- F-297 [P3] open, new: two comments still carry history (a step number in booking-component.css, and a body-limit comment pointing at the wrong feature's decision 10). Not blocking.
- No P0 or P1 is open or fixed.

## Remaining risk

- No mutation runs: this reviewer may not edit product code, so the claim that the new window test fails on the earlier code is confirmed by reading, not by a broken copy.
- `db:seed` was not run, to leave the shared dev database as it is; F-296's upgrade path is confirmed by reading and by the builder's recorded live run.
- No browser test harness exists; the screens were not driven in a real browser in this review (Check not required).
- The package has no lint script, so only the frontend is linted.
- Deploy notes stand: whether Railway's proxy overwrites a visitor's own `X-Real-IP` is unconfirmed until the first deploy, and the in-memory counts hold only with one API replica.
