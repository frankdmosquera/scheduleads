# Fix: Check spam line on the booked screen

**Type:** Fix
**Size:** light - one line of copy in two languages, no logic.
**Status:** verified
**Branch:** fix/check-spam-line-on-the-booked-screen

## The problem

A new client's domain has no sending history, so Gmail often files a first-time
customer's booking confirmation under Spam. Measured on 2026-10-27 with
mail-tester.com on Face and Body's live booking: 7.9/10, SPF, DKIM and DMARC all
pass; the only loss is Resend's shared server on the SpamCop list. Nothing in
the setup is wrong, yet the customer may never see the email. Once a customer
marks it "Not spam", Gmail learns (Frank and his sister, Oct 26).

The booking window's "You're booked" screen says only "A confirmation is on its
way to <email>." (`packages/booking-component/booking-window/screens/month-layout/month-done-screen.tsx`).

## The fix

One more line right under that sentence, shown only when the customer gave an
email (same condition as the line above it):

- English: "Not there in a few minutes? Check your spam folder."
- Spanish: "¿No le llega en unos minutos? Revise la carpeta de spam."

A new `checkSpamFolder` entry in the words type and both word files, so every
language has it (the words test checks completeness). Same `sa-fine` style.
Nothing else changes: no sender address in the line (the window does not know
it), no change to the emails themselves.

The text or WhatsApp confirmation backup (Canada texts, Colombia WhatsApp) is
the after-handover item 1, not this fix.

Release: the package goes to 0.2.1. Publishing it, and installing it on Face
and Body's site (and IA a la Orden's when it moves to 0.2.x), are Frank's yes
each, after the merge.

## Build steps

- [x] 1. Add `checkSpamFolder` to `booking-words-type.ts`, `english-words.ts`
  and `spanish-words.ts`; show it in `month-done-screen.tsx` under the
  confirmation line; extend the booked-screen test in `booking-window.test.ts`
  to expect it; bump `package.json` to 0.2.1.
  **Done when:** the booking component tests and build pass, and the booked
  screen on the local frontend shows both lines (English and Spanish).

## Verify

- `npm run test --workspace=@frankdmosquera/booking-component`
- `npm run build --workspace=@frankdmosquera/booking-component`
- Book a time on a local site with an email: the "You're booked" screen shows
  the confirmation line and the spam line under it; booking without an email
  shows neither.

## Implementation walkthrough

**Words (packages/booking-component/words/).** A new entry, `checkSpamFolder`, sits right after `confirmationOnItsWay` in the words type and in both language files: "Not there in a few minutes? Check your spam folder." and "¿No le llega en unos minutos? Revise la carpeta de spam." (usted, like the rest of the Spanish window). Adding it to the type makes every language supply it, and the existing words test fails if a Spanish entry equals its English one.

**The booked screen (month-done-screen.tsx).** The line is a second `sa-fine` paragraph inside the same `email &&` condition as the confirmation line, so a customer who booked with only a phone sees neither. `MonthDoneScreen` is the only done screen, so no other path misses it. The sender address is left out on purpose: the window does not know it.

**Test and version.** The booked-screen test in `booking-window.test.ts` now expects the English line. The package goes to 0.2.1; publishing it and installing it on Face and Body site wait for Frank yes after the merge.

**Why this and not more.** Measured on Face and Body live booking with mail-tester (7.9/10, SPF, DKIM and DMARC pass, the only loss Resend shared server on SpamCop): the setup is right, the domain is just new to Gmail. The line gets the customer to find the email and mark it Not spam, which teaches Gmail. The text or WhatsApp backup (Canada texts, Colombia WhatsApp) is the after-handover item 1.

**Proved.** 98 booking component tests and its build pass; on the local booking preview (clinic-dev) both languages show the line under the confirmation.

## Findings

- None resolved in this fix. F-530 [P3] open (the root lockfile still records the booking component at 0.2.0) stays in the ledger, carried.

## Independent review

**Status:** passed
**Target commit:** 20d0bec888fa63df04a38c12326cb4fb18c40bff
**Base commit:** 62e87d7f383fe398d129c9f1a34a7b0adb837a0d
**Base ref:** main
**Spec hash:** 525ebff234ba4cfb5de7d3c2c2b25d8f0bda2b5f542cbaa93b930e2cfafec0f7
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-27T02:06:36Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-27T02:08:20Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `npm run test --workspace=@frankdmosquera/booking-component`: pass (build first through `pretest`, then 18 files, 98 tests)
- `npm run build --workspace=@frankdmosquera/booking-component`: pass (tsc, tsdown, `dist/` imports only react, react-dom, hono, zod)
- `npm ci --offline` in a scratch two-workspace repo with a workspace version ahead of its lockfile: pass, lock left at the old version (evidence for F-530)

### Evidence

- Preflight: HEAD equals the target, `git merge-base main HEAD` equals the base, the spec's SHA-256 matches, and only `blueprint/context/review.md` differed from the target before this review.
- Delta 62e87d7..20d0bec is two commits, 7 files: `checkSpamFolder` added to `booking-words-type.ts`, `english-words.ts` and `spanish-words.ts` with the spec's exact wording; `month-done-screen.tsx` shows it under the confirmation line inside the same `email &&` condition with the same `sa-fine` class; `booking-window.test.ts` expects the English line on the booked screen; `package.json` 0.2.0 to 0.2.1; the spec filled in and verified.
- `MonthDoneScreen` is the only done screen (`done-screen.tsx` routes both layouts to it), so no other confirmation path misses the line.
- `booking-words.test.ts` iterates every English key and fails if a Spanish word equals its English one, so the new key is covered in both languages.
- Security: a static string rendered as React text, no new input, route or data. Performance: one extra paragraph on the last screen. No skipped or focused tests in the package.
- Build output contains the new line once; the build and test runs left no tracked file changed.

### Findings

- F-530 [P3] open: the lockfile still records the booking component at 0.2.0

### Remaining risk

- Check was not required and not run: the spec's own manual step (the booked screen on the local frontend in English and Spanish, and no lines without an email) was not seen in a browser by this review.
- No test asserts the spam line stays hidden when no email was given; it shares the existing confirmation line's condition, which was untested before this fix too.
- The Spanish booked screen test (`booking-window-language.test.ts`) does not assert the Spanish spam line; only the words test covers its wording.
