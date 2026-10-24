# Fix: Sign-in errors in the page's language

**Type:** Fix

**Size:** light - one small piece of logic in three screens: which of the page's own sentences a
refusal from Better Auth shows.

**Status:** verified

**Branch:** fix/sign-in-errors-in-the-page-s-language

**Fixes:** F-485

## The problem

The two sign-in steps and the business picker call Better Auth's own client
(`authClient`), which does not go through the dashboard's translating fetch, and they show
Better Auth's `error.message` before their own words. Better Auth always sends one, in English
and in its own terms: a mistyped code on the Spanish sign-in page reads "Invalid OTP", an old one
"OTP expired", a code tried too often "Too many attempts". English owners read the same jargon.

- `frontend/components/sign-in/sign-in-code-step.tsx:41`
- `frontend/components/sign-in/sign-in-email-step.tsx:44`
- `frontend/components/dashboard/business-picker-screen.tsx:36, 66`

## The fix

The screens stop showing Better Auth's message and always show one of their own sentences, in
the page's language, picked by Better Auth's error `code` and `status`:

| Screen | Refusal | Sentence |
|---|---|---|
| Code step | `OTP_EXPIRED` | That code has expired. Request a new one. |
| Code step | `TOO_MANY_ATTEMPTS` | That code was tried too many times. Request a new one. |
| Code step, email step | status 429 (rate limit) | Too many tries. Wait a minute and try again. |
| Code step | anything else | That code is not right. Request a new one. (today's words) |
| Email step | anything else | That code could not be sent. Try again. (today's words) |
| Business picker | any | its existing two sentences |

It must not break: a wrong code and an unknown account still get the same answer (the code
step's comment says why); the email step still says nothing about whether an address has an
account. The new sentences go in both word lists, so a missing one is a type error.

## Build steps

- [x] 1. The three screens show their own sentences, from `DashboardWordsType`'s sign-in words,
  for every Better Auth refusal. **Done when:** on http://localhost:3400/sign-in in Español, a
  wrong code shows "Ese código no es correcto. Pida uno nuevo." and in English "That code is not
  right. Request a new one.", never "Invalid OTP"; frontend build and lint pass.

## Verify

Sign out, switch the sign-in page to Español, request a code, type a wrong one: the card says
"Ese código no es correcto. Pida uno nuevo." The expired and too-many-tries sentences are read in
the code (Better Auth's codes are the package's own constants, `error-codes.mjs`); no frontend
test runner exists, so no saved test.
