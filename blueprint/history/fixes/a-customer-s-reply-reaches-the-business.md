# Fix: A customer's Reply reaches the business

**Type:** Fix
**Size:** light - one rule for one email header, in three emails.
**Status:** verified
**Branch:** fix/a-customer-s-reply-reaches-the-business

## The problem

Since 25a a business's emails can come from an address nobody reads:
`bookings@booking-crm.com`, or `bookings@<its domain>` (usually no mailbox). The
customer's confirmation sets Reply to the booked person's work email, but only
when there is one (`find-booking-email-recipients.ts`, `customerReplyTo`);
otherwise Reply goes to the sending address. The customer's move and
cancellation emails set no Reply at all. So most customers who press Reply
reach nobody, and the business never sees it. Feature 25a's plan line said
replies go to the owner's email; the build kept the old rule.

## The fix

One rule for every email a customer gets about their booking (confirmation,
move, cancellation): Reply goes to the booked person's work email when they
have one, else the business's notification address (its saved one, else its
owner's login email, as 25a set). Never the sending address.

- `find-booking-email-recipients.ts`: `customerReplyTo` becomes
  `workEmail ?? notifyEmail`, never null.
- `send-move-emails.ts` and `send-cancellation-emails.ts`: the customer's
  email carries the same Reply (work email, else notification address).
- Unchanged: the business's and the person's notices keep Reply to the
  customer; who receives what is unchanged.

## Build steps

- [x] 1. The rule in the recipients helper and in the move and cancellation
  emails, with the tests: the recipients unit test, and the confirmation, move
  and cancellation tests asserting the customer's Reply (work email when
  there is one, else the notification address).
  **Done when:** backend tests pass, the new assertions included; backend build
  passes.

## Verify

- `npm run test --workspace=backend`
- Live, after the merge: book on a client site with your own email, press
  Reply on the confirmation, and see it addressed to the business's
  notification address.
## Implementation walkthrough

**The rule (backend/lib/email/find-booking-email-recipients.ts).** `customerReplyTo` is now the booked person's work email, else the business's notification address, never null. Since 25a the notification address is the saved one, else the owner's login email, so a customer's Reply always reaches someone who reads it.

**The three customer emails.** The confirmation (`send-booking-emails.ts`) uses that rule. The move (`send-move-emails.ts`) and cancellation (`send-cancellation-emails.ts`) customer emails set no Reply before; they now carry the same rule inline (work email, else notification address). The business's and the person's notices still reply to the customer, and who receives what is unchanged.

**Why it was needed.** 25a's plan line said replies go to the owner, but its build kept the old rule, under which Reply fell to the sending address (`bookings@booking-crm.com` or `bookings@<domain>`), which nobody reads. Frank's question about what a new client's customers see brought it up.

**Tests.** The recipients unit test now says Reply is never the sender; the confirmation, move and cancellation tests assert the customer's Reply, and a new move test asserts it reaches the booked person's work email.

**Carried (P3).** F-541: the rule is written in three places. F-542: a move's email reads Reply when it goes out, so a later change (a second move, a new work email) can change it under the same idempotency key. F-543: no test for the work-email case on a cancellation, or for the owner's login email as Reply. Noted by the review: with no notification address saved, the owner's login email is what customers see in Reply.

## Findings



## Independent review

**Status:** passed
**Target commit:** 2fb28ee655e8db337009aaa05c8e7dd7ee96f71c
**Base commit:** b54d3a709b513abed6152383d0e6d9769e63d119
**Base ref:** main
**Spec hash:** 2766f17fee428052a5bc403ef339d94ed7701d56a667cafb698d9ba4257935c4
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-27T15:41:27Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-27T15:45:22Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (HEAD, merge base and spec hash match the request; only review.md differed)
- `npm run test --workspace=backend`: pass (96 files, 1098 tests)
- `npm run build --workspace=backend`: pass
- `npx tsc --noEmit -p backend`: pass (exit 0)

### Evidence

- Delta is 9 files: the rule `workEmail ?? notifyEmail` in find-booking-email-recipients.ts:29 (type now `string`, never null), the confirmation passes it through (send-booking-emails.ts:55), and the move and cancellation customer emails gain `replyTo: context.personWorkEmail ?? setup.notifyEmail` (send-move-emails.ts:88, send-cancellation-emails.ts:69). Notices to the business and person still reply to the customer; recipients unchanged, as the spec says.
- `setup.notifyEmail` is the saved notification address, else the owner's login email (find-booking-email-context.ts:100), and emails are sent only when it exists, so the Reply is never empty or the sending address.
- Work emails are normalised to null when blank by the shared schema and limited to the business's own domain on save, so `??` never yields an empty Reply.
- Resend is called through its JSON API with `replyTo` as a field, so no header injection; no new address reaches a log line.
- Tests: recipients unit test (both branches), confirmation (216, 282), move (227, new 360-373) and cancellation (222) assert the customer's Reply.

### Findings

- F-541 [P3] open: the Reply rule is written in three places; the helper still says "decided in this one place"
- F-542 [P3] open: a move's email takes its Reply from the booking's current person, not the move's own saved person, unlike the rest of that email
- F-543 [P3] open: the cancellation test covers only the notification-address Reply; no test shows the owner's login email as the fallback Reply

### Remaining risk

- When no notification address is saved, every customer now sees the owner's login email in Reply-To. The spec chooses this (25a's fallback); it is a sign-in identifier shown to the public.
- A retry that reaches Resend after the notification address or a work email changed sends a different `reply_to` under the same idempotency key and is refused for 24 hours (same class as the existing notices' `to`, see F-542).
- The spec's live Verify step (press Reply on a real confirmation after the merge) was not run; it is post-merge and Check was not required.
