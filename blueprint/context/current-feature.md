# Fix: Sign-in errors in the page's language

**Type:** Fix

**Size:** light - one small piece of logic in three screens: which of the page's own sentences a
refusal from Better Auth shows; step 2 adds one small API rule.

**Status:** verified

**Branch:** fix/sign-in-errors-in-the-page-s-language

**Fixes:** F-485, F-487, F-488, F-489

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

**Amended 2026-10-24, after the review (F-487):** the expired and too-many-tries sentences told a
customer's address from an unknown one, because only a customer has a code to expire or lock.
The API now answers all three the same (400 `INVALID_OTP`), so those two sentences are gone and
the code step shows "That code is not right" for any refused code. The refusal is kept as a word
key, so it follows a language switch (F-488). The second review showed the rewritten answer's key order
still differed from Better Auth's own, and that Better Auth's other email code routes answered the
same question untouched (F-489): those seven routes, none called by the dashboard, are turned off.

## Build steps

- [x] 1. The three screens show their own sentences, from `DashboardWordsType`'s sign-in words,
  for every Better Auth refusal. **Done when:** on http://localhost:3400/sign-in in Español, a
  wrong code shows "Ese código no es correcto. Pida uno nuevo." and in English "That code is not
  right. Request a new one.", never "Invalid OTP"; frontend build and lint pass.
- [x] 2. A refused sign-in code gets one answer from the API, whoever the address belongs to: the
  route rewrites Better Auth's `OTP_EXPIRED` and 403 `TOO_MANY_ATTEMPTS` to 400 `INVALID_OTP`
  (`backend/lib/auth/one-answer-for-a-wrong-code.ts`, mounted in `backend/app.ts`); the sign-in
  steps keep a word key. **Done when:** `one-answer-for-a-wrong-code.test.ts` shows a customer's
  fourth wrong try and expired code answering exactly as an unknown address; on the sign-in page
  five wrong tries all read "That code is not right", and a switch to Español changes it.
- [x] 3. The answer is byte for byte Better Auth's own, and the email code routes the dashboard
  never calls are off (`disabledPaths` in `auth-server.ts`). **Done when:** the test compares the
  whole answer (status, body, headers) with an unknown address's, and each of the seven routes
  answers 404 while a customer holds a code; breaking either fix fails the test.

## Verify

Sign out, switch the sign-in page to Español, request a code, type a wrong one: the card says
"Ese código no es correcto. Pida uno nuevo." The API rule has its saved test; the screens have none, because the frontend has no test
runner.
