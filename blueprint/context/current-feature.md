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
