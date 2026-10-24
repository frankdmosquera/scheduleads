# Independent Review

**Status:** passed
**Target commit:** 0acd574ef14f1d90e6b5e3fb974040ba8e50ca8f
**Base commit:** 576bdaf322eb1e4934a701ccfb7db81b5b96536a
**Base ref:** main
**Spec hash:** 5a919b6778b3388412ee6f702adc309d01e459f7ff735733d049eca2866f6efb
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-24T15:16:04Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-24T15:22:19Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `npm run test --workspace=@scheduleads-app/shared`: pass (31 files, 209 tests)
- `npm run test --workspace=backend`: pass (92 files, 1075 tests, against the local seeded `scheduleads_dev`)
- `npm run test --workspace=@frankdmosquera/booking-component`: pass (18 files, 98 tests)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass (compiled and type-checked)
- `npm run lint --workspace=frontend`: pass
- `npm run format:check`: pass

## Evidence

- Freshness: `HEAD` is 0acd574ef14f1d90e6b5e3fb974040ba8e50ca8f, `git merge-base main HEAD` is 576bdaf322eb1e4934a701ccfb7db81b5b96536a, the spec's SHA-256 matches, and only `blueprint/context/review.md` differed from the target before this receipt.
- 12j.2 (4bcce66..0acd574, 57 files) read in full: every screen's moved sentence compared with its word in `frontend/lib/dashboard-words/`; English words match the removed literals, including plurals (`lengthIn`, `reminderBefore`), the one-off date labels, the week's short day names and the closed-day bookings question. No changed condition, lost prop or broken key found.
- Every word list is typed by its area's type and joined into `DashboardWordsType`, so a word missing from a Spanish object fails `next build`; the open-ended maps (`emailLines`, `textLines`, `otherLines`) fall back to a Spanish or raw line, never blank.
- Dates and times go through `words.intlLocale` (`format-lead-time.ts`, `calendar-day-words.ts`, the schedule's clock and items, time off, closed days, holidays, email key date, relative "last read"), or through `language` into the shared `formatBookingTime`, whose map gives the same `en-CA` / `es-419`. Checked in Node: `es-419` writes "vie, 23 oct, 2:00 p.m." and "lun, 16 nov".
- Hooks: `useDashboardWords` is called at the top of components only; helpers (`lineOf`, `rowState`, `reminderWords`, `calendarNoticeOf`, `lastCheckedWords`) take the words as an argument; lint's hook rules pass. Every word is rendered as React text; the one JSX notice (calendar `not_confirmed`) composes words as text around a fixed link.
- Behaviour kept or improved on purpose: the calendar notice is now stored as its outcome, so it follows a language switch; the email key's date moved from the browser's locale to `intlLocale`; `savedTestSent` gets `""` instead of a printed `null`.
- Security: no new route, input or trust boundary in 12j.2; no HTML injection path; no secret in the diff.
- Performance: one formatter per call on lists bounded by the API (200 timeline lines, a week, a year of closed days); nothing new per keystroke.
- F-469 and F-470 re-examined against the repair in 4bcce66 and closed (see the ledger).

## Findings

- F-471 [P2] open: the Booking form's ready-made question sets stay English on a Spanish screen.
- F-472 [P3] open: "Tiempo libre" for time off reads as available time.
- F-473 [P3] open: the off state has several Spanish names across Settings.
- F-474 [P3] open: default lead stages are stored and shown in English.
- F-475 [P3] open: the sign-in email placeholder stays English.
- F-469 [P2] closed, F-470 [P3] closed.

## Remaining risk

- Check was not required and was not run: no screen was opened in a browser in this pass, so the Spanish layout (longer sentences in buttons and rows) and the "fails when a Spanish word is removed" proof rest on the builder's run and on reading the types.
- The frontend has no test runner, so the word lists and screens are covered only by the type check and by hand.
- 12j.3 is not built: API refusals, zod form errors, holiday, country and province names and `apiNotRespondingMessage` still show in English on Spanish screens, as the spec plans.
