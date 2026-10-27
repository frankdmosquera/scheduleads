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
