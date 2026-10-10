# Independent Review

**Status:** passed
**Target commit:** 012c2000e2f1e6d15b7b9a871bf86b78a4f87289
**Base commit:** ece1aa2b995f5395f9f35fdd568a985659a3495f
**Base ref:** main
**Spec hash:** f24901865565ed52eaa3463678280f41266c06badbfee83e51d1ed3cf0f30005
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** runtime default (exact model not known until reviewer starts)
**Requested execution:** automatic
**Requested at:** 2026-10-10T00:23:42.000Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-10T00:34:00.000Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `ece1aa2b995f5395f9f35fdd568a985659a3495f..012c2000e2f1e6d15b7b9a871bf86b78a4f87289` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

The untracked `blueprint/ai-voice-proposal.md` is the owner's own file, never committed and
outside this work item; it is not part of the target and does not make the review stale.

## Commands

- `npm run test --workspace=@scheduleads-app/shared`: pass, 167 of 167 (22 files)
- `npm run test --workspace=backend`: pass, 887 of 887 (78 files), against the local seeded `scheduleads_dev`
- `npm run test --workspace=@scheduleads-app/booking-component`: pass, 75 of 75 (16 files)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=@scheduleads-app/booking-component`: pass
- `npm run build --workspace=frontend`: pass (Next 16.3.5; `/admin/booking-preview/[businessSlug]`, `/admin/client-setup`, `/customer-booking/[bookingPageToken]` built)
- `npm run format:check`: pass
- `npm run lint --workspace=frontend`: pass

## Evidence

- Freshness checked before reviewing: HEAD is the target, `git merge-base main HEAD` is the base, the spec's SHA-256 matches, and the only paths differing from the target are this file and the owner's untracked `blueprint/ai-voice-proposal.md` (excluded by the request). The commands left the tree as it was.
- Whole delta read (53 commits, 204 files): the public routes and their new rules (business face, questions, layout, person choice, `localStartTimes` and `when`), `book-time.ts` (answers, person refusal, contact limit, later-texts yes), `check-answers.ts`, the move times and move changes, the rate limiter, its middleware, `visitorAddress` and `oneCopyOfAFormAtATime`, the notification email, migrations 0022 to 0024 and the seed, the shared schemas, the whole `packages/booking-component` package and its CSS, the frontend renames, the `/b/` rewrite, the booking preview page, and every new or changed test. Migration snapshots and the lockfile were checked for scope only.
- Security: every public query stays scoped to the slug's business; the new business face carries name, logo and phone only; people listed only for `customer_picks`; a person refused on the times, booking, move times and move routes for `business_assigns`; the package sends no credentials, encodes path values and never renders user text as HTML (no `dangerouslySetInnerHTML`); the CSS reads only `--sa-*` tokens under `sa-` classes; nothing on screen names the product. X-Real-IP is read only in production (deploy note records the spoofing check).
- F-293 traced by reading: Back is drawn whenever `unsure` is false (month-details-screen.tsx:60), and `unsure` changes only after an answer (booking-form-view.tsx:132-133), so during the send Back can unmount the form; the window keeps the key (booking-window.tsx:41), and a different start with a saved key answers request_key_used (book-time.ts `isSameRequest`, public-bookings-routes.ts:137-142).
- Standards checked: naming (`Type` suffix, one export per file, middleware names), no em dashes in the delta, comments without history (F-295), the two api clients, Zod at both ends, the public-route conditions.

## Findings

- F-293 [P2] open - Back to the times stays live while Book is sending, so a lost answer after Back loses the freeze and "already used" books her twice
- F-294 [P3] open - The coding standards still say browser or proxy is an open question, which decision 1 answered
- F-295 [P3] open - History is back in comments: who agreed the problem words and when, and finding numbers in eight test lines
- F-296 [P3] open - The seed sets painting-dev to ask for a yes only when it first makes its text settings, so a database seeded before 0024 never shows the box
- No P0 or P1 is open or fixed, so the receipt passes. F-293 is a P2 of the same harm as F-282 (a second booking after a lost answer) and, as a P2, is worth fixing before the feature closes; the four findings are left for the builder and Frank to decide.

## Remaining risk

- F-293 is traced by reading, not driven by a test: this reviewer may write only the ledger and this file, so no temporary test was run.
- No browser evidence was gathered by this review (Check not required); the screens' behaviour rests on the jsdom tests and the builder's recorded live checks.
- The `blueprint/.state/run.json` activity record was not written: the caller limited this reviewer to the two review files.
- Production-only behaviour not provable locally: whether Railway's proxy replaces a visitor-sent X-Real-IP (deploy note, with F-176 and F-179), and that the API runs with `NODE_ENV=production`, without which every visitor shares one limit.
- The package's emitted declarations import types from `backend/app-type` (a dev dependency); a host site in another repo (feature 10) will need that resolved or the types bundled.
