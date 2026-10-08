# Feature: The customer's texts

**From build-plan:** feature 8b

**Branch:** feature/08b-the-customer-s-texts

**Status:** verified. Steps 8b.1 to 8b.4 built, tested and reviewed step by step
(audit, independent review, re-reviews), 2026-10-07; plans amended with Frank
along the way (one-piece texts, the packed link, RCS as item 21b, text settings
in item 12). No P0 or P1 open or fixed. The checkpoint for the final review.

## Goal

Jane books with Summit Painting and her phone buzzes: a text from Summit's own
number saying what she booked, when, and the link to her booking page. Before
the appointment, at the time Summit chose, a reminder text with the same link.
If she moves the booking the reminder follows the new time; if she cancels, no
reminder goes. If she texts back, her message reaches Summit, where Summit
chose. Every text leaves the app through one place in the code, so moving
WhatsApp to Meta later changes that one place. Primo already gets all of this
from Calendly; shipping without it would be a downgrade (plan decision 13).

Every one of these behaviours is the business's own setting (plan decision 30,
restated in `AGENTS.md` under "The client decides everything"): whether the
confirmation text goes, when each reminder goes, where replies land. Nothing
is on by default; a business with no text settings sends no texts.

## In scope

- One agency Twilio account, one number per business, the business's text
  settings in their own table, set at client setup until Settings (feature 12).
- The one place every text is sent from: Twilio's REST API by plain `fetch`.
- The customer's phone turned into a textable number (+1, North America).
- The confirmation text when a booking is made, a job on the 8a runner.
- The reminder texts, as many as the business chose, each a job at its time,
  following a move and dropped by a cancel.
- Jane's replies passed on to the business: as a text to its phone, as an
  email to its inbox, or both, as it chose.
- Each text that went recorded on the contact's timeline (`sms_sent`).

## Out of scope

- The worker's text when a business runs on one email (8c).
- A text when a booking is moved or cancelled: the emails already tell her.
  Only a note for later: if a client wants one, it is one more switch in the
  same settings.
- The Settings screen for texts (feature 12); values are set at client setup.
- Replies on the lead's timeline, and answering Jane from inside the app
  (relayed worker messages, the idea parked for feature 19).
- Delivery receipts (Twilio's status callbacks) and a screen of failed texts
  (feature 11 can show them).
- WhatsApp (plan decision 9, Phase 8).
- Buying the numbers and putting the keys on Railway: done at deploy, on
  Frank's yes.

### Decisions made in the spec

1. **One agency Twilio account, a number per business** (Frank, 2026-10-07).
   Unlike Resend, a Twilio account would exist only for this app, the texts
   are notices the app writes, Frank pays from the $240 plan and can read
   every text in Twilio's logs. A number can later move to a client's own
   Twilio account through Twilio support, losing its settings, which are
   redone there. Rejected: each business its own Twilio account, which is
   setup work per client for no gain to them.
2. **Everything is the business's setting, nothing on by default** (plan
   decision 30; Frank, 2026-10-07, "flexibility to the max"). A
   `text_settings` row per business holds its number, whether the
   confirmation goes, the reminders (any number of them, each any number of
   minutes before: 30, 120, 1200), and where replies go (a phone, an email,
   or both). No row, no texts. At least one reply destination is required,
   so a reply is never lost. Rejected: one reminder rule for everyone (20
   hours, or the evening before), which fixes a business's choice for it.
3. **The texts carry Jane's booking page link** (Frank, 2026-10-07, option A).
   The same signed link as the email's button, so a phone-only booking can
   still cancel or move. Rejected: only the business's phone number, which
   leaves a phone-only customer having to call. Amended with Frank,
   2026-10-07, planning 8b.2: the link was about 110 characters, making every
   text two billed pieces; it is now packed to about half (decision 11).
4. **A text says only what is needed, in one piece** (Frank, 2026-10-07,
   planning 8b.2: "we want to update people, but we don't want to be stupid
   by sending a whole letter"). Every message costs money, and packages will
   count them, so a text carries the business's name, the time and the link,
   nothing else; the details are on Jane's booking page and in the email.
   Each text fits one billed piece: at most 160, counting the eight plain
   characters a text carries at double cost (`[ ] \ ^ { | } ~`) as two; a
   business name too long for that loses words from its end (F-204). The
   wording is fixed, like the emails, the product never named, plain ASCII
   (any other character, a curly apostrophe or a special space in a time,
   re-encodes the whole text at 70 characters a piece). Rejected: the
   service and a full sentence ("you're booked for Interior estimate,
   Tuesday, October 13 at 7:30 a.m. MDT"), about 220 characters with the
   link, two pieces, twice the cost.
5. **Plain `fetch` to Twilio, no SDK.** The conventional way is the official
   `twilio` package; this feature calls two Twilio endpoints (send, list) and
   checks one webhook signature (an HMAC in about ten lines), so the package
   would be a large dependency for three calls, and installing it would need
   Frank's yes. Said out loud per the workspace rule; nothing later pays for it
   unless WhatsApp templates (Phase 8) want the SDK, and then that one place
   changes.
6. **Each text is a job on the 8a runner and does what is still true when it
   runs** (8a decision 3). A confirmation for a booking cancelled before it
   went is not sent; a reminder carries the booking's move number and skips
   itself if a move replaced it, or if the booking was cancelled, or if the
   business no longer has that reminder. A move adds the new reminders. So no
   job is ever looked up or removed. A change to a business's reminders
   applies to bookings made or moved after it.
7. **Retried like the emails, except what retrying cannot fix.** A failed send
   is retried up to 10 times with growing waits (8a decision 4), never once
   the appointment has started. Twilio refusals about this customer or this
   text, which retrying cannot change (a number that cannot take texts, a
   customer who texted STOP, a landline, words too long), are logged and not
   retried. A refusal about the agency's own account (its keys, a country not
   switched on, a number not in it) is retried, so once it is fixed in
   Twilio's console the waiting texts still go (amended after 8b.1's review,
   F-198).
8. **A retry never sends a text twice.** Twilio takes no idempotency key, so
   a send whose answer was lost may have gone. Before a retry sends, it asks
   Twilio for a text with the same body from the business's number to Jane's
   since this text's first try; if one is there, that one is recorded and
   nothing is sent. The first try is the booking's creation for the
   confirmation, and the appointment minus its minutes for a reminder, so a
   booking's earlier reminder (the same words) is never taken for a later one.
   Twilio's clock may differ from ours by up to 10 seconds, well under the one
   minute that is the smallest gap between two reminders (amended after
   8b.1's review, F-195: "in the last day" would have taken the 20-hour
   reminder for the 1-hour one and skipped it).
9. **Replies go where the business chose, and only from customers.** Twilio
   posts each incoming text to a public API route, checked by Twilio's
   signature, which answers at once and adds a job to pass it on. A text from
   the business's own reply phone is never passed on (it would come straight
   back to the business). STOP, START and HELP are answered by Twilio itself
   and are passed on too, so the business sees that Jane opted out.
10. **A phone number is textable only as a North American number.** Ten
    digits, or eleven starting with 1, after dropping everything else, become
    `+1XXXXXXXXXX`. Anything else is logged as not textable; the booking and
    its emails are untouched. Every tenant is in Canada.
11. **The booking page link is packed to about half its length**
    (Frank, 2026-10-07, planning 8b.2). The same signed token (feature 7a,
    decision 10: signed, never stored), written tighter: the booking id as
    22 base64url characters instead of 36 hex, and the signature cut to its
    first 16 bytes (22 characters, 128 bits, still far past guessing)
    instead of 43. About 45 characters after `/b/` instead of 80. The emails
    use the same link, so there is one link everywhere; links made before
    stop opening, which costs nothing while no customer has one. Rejected:
    a short code stored per booking, which would undo 7a's "never stored".

## Build loop

Steps are built one at a time on `feature/08b-the-customer-s-texts`. Each
step's plan gets Frank's yes just before it is built. After that yes nothing
stops until the review: build, tests, tick the box, the build log entry,
commit with the step number and push to the feature branch, `/audit` scoped
to the step, then the independent review (`workflow.stepReview: "every"`,
`workflow.checkpointCommits: "enabled"`). Findings are talked through after
the review; P0/P1 are fixed before the next step. `/complete` makes the merge
commit, on Frank's yes.

No new package. Nothing touches Twilio's live account or Railway without
Frank's yes; every test fakes Twilio.

## Build steps

- [x] **8b.1 The text door and the settings.** The `text_settings` table and
  its migration; the seed gives Summit Painting (dev) a fake number, the
  confirmation on, reminders at 1200 and 60 minutes and replies to a phone,
  and leaves Riverbend Clinic (dev) without a row. `textablePhoneNumber`
  in `packages/shared`. `sendText` in `backend/lib/text/`: the one place a
  text goes out, Twilio's Messages API by `fetch` with the agency's keys,
  a 10 second limit, its refusals sorted into "retry" and "never retry",
  and in development without keys a log line instead of a send (production
  without keys throws, like `sendEmail`). The duplicate check of decision 8,
  `findSentText`. `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in
  `.env.example`.
  **Done when:** `db:migrate` and `db:seed` run on a fresh `scheduleads_dev`;
  the shared and backend tests pass, including: each phone shape textable or
  not; a send posts the right form to the right URL and returns Twilio's id;
  each refusal sorted; no keys in development sends nothing; the table refuses
  a row with no reply destination, a reminder of zero or fewer minutes and a
  number used by two businesses.

- [x] **8b.2 The confirmation text.** A `booking_text` job, added with the
  booking's emails in `book-time.ts`, owner-made bookings included like the
  confirmation email. It reads the booking afresh: not confirmed,
  appointment started, no settings, confirmation off, no time zone, no
  textable phone: logged and nothing sent. A booking moved before its text
  went is confirmed at its new time (changed while building: there is no move
  text, so skipping it would leave a phone-only customer with no text at all). Otherwise it renders the text (decision 4)
  with the booking page link, sends it, and records `sms_sent` (booking, kind,
  Twilio's id; never a number or the words). On a retry, decision 8 first,
  since the booking's creation. The booking page link is packed (decision
  11) in `booking-page-token.ts`, its reader and tests, so the emails carry
  the short link too. The text's time is short and in the business's zone,
  "Tue Oct 13, 7:30am", plain ASCII whatever the server's ICU prints. The
  runner wrapper (`job-task.ts`) hands a job its try number, so the check of
  decision 8 runs only on a retry. In development without Twilio keys
  nothing is sent and the timeline still gets its entry, as the emails do.
  **Done when:** booking through the public route with Summit's settings
  sends one fake Twilio request with the business's number, Jane's `+1`
  number and the link, and one `sms_sent` entry; each skip case sends nothing;
  a failure is retried; a retry after a send whose answer was lost sends
  nothing; with an app address of up to 30 characters, Summit's confirmation
  is plain ASCII and at most 160 characters; the packed link opens the
  booking page and a changed or cut link does not; the backend suite passes
  several runs in a row.

- [x] **8b.3 The reminders.** One `booking_text` reminder job per reminder in
  the business's settings, run at the appointment minus its minutes, added
  in `book-time.ts` and again in `move-booking.ts` with the move's number;
  none added for a time already past. It skips itself when the booking was
  cancelled, a later move replaced it, the business no longer has that
  reminder, or the appointment has started (decision 6). On a retry it
  checks Twilio first (decision 8) with `since` = the appointment minus its
  minutes, never the job's `created_at` (the booking's time) or `run_at`
  (which moves with each retry) (F-201).
  **Done when:** with the job clock pinned, a booking gets its reminders at
  the right instants in the business's time zone; after a move only the new
  ones send, at the new times; after a cancel none send; a reminder removed
  from the settings does not send; a booking made 30 minutes ahead gets no
  1200-minute reminder; a reminder still failing when the appointment starts
  is never sent; the 60-minute reminder's retry still sends after the
  1200-minute one went (same words, earlier); the reminder's wording goes
  through `fitBusinessName` and Summit's, The Latam Painters', Face and
  Body's and Primo's reminders each fit one piece with a 30-character app
  address (F-212); every case on the build log's Simulate page (cases a to f)
  is a saved test under the same name; the suite passes several runs in a row.

- [x] **8b.4 Jane's replies.** `POST /texts/incoming`, public, answering only
  a request carrying Twilio's valid signature for the API's own address
  (403 otherwise), finding the business by the number texted (an unknown
  number is answered and dropped, logged without the sender), then adding a
  `text_reply` job keyed by Twilio's message id (so Twilio posting the same
  text twice adds one job; `enqueueJob` gains a `jobKey` option) and
  answering Twilio an empty reply at once. The job passes the reply on to
  the reply email (through the business's own Resend, as feature 6 sends)
  and/or the reply phone (a text from the business's number: who sent it,
  their number, the words, where to answer). Both are tried on every run
  before a failure is thrown, so one that keeps failing never holds back the
  other (F-218, F-232). Each reply has a `text_reply` row keyed by Twilio's
  message id recording how far it got: a run claims the text for a minute
  before sending, so two runs never both send; the claim is let go only when
  Twilio refused the send itself, and only a run that follows an unclear
  answer asks Twilio first, counting from when the reply was recorded, so an
  identical reply passed on before this one was recorded is never taken for it
  (F-217, F-231, F-236; corrected by F-239: one passed on after it can be). Never from the reply
  phone itself (decision 9), and never to a reply phone that is any
  business's texting number (F-199: a setup mistake would hand Jane's words
  to another business, or two businesses would drop each other's replies);
  then it goes only to the reply email, or is logged as not passed on when
  there is none. The sender is named when their number matches a lead or
  contact of that business.
  **Done when:** route tests with signatures made from a test auth token: a
  valid one is accepted and passed on to each destination the settings name;
  a missing or wrong signature is refused 403 and adds no job; an unknown
  number adds no job; a text from the reply phone is not passed on; a reply
  phone that is another business's texting number gets nothing; the
  frontend build passes (the route reaches `AppType`).

## Files / areas

- `packages/shared/db/` new `text-tables/text-settings-table.ts`, exported from
  `db/index.ts`; a migration from `db:generate`.
- `packages/shared/helpers/textable-phone-number.ts` and its test, exported as
  `@scheduleads-app/shared/textable-phone-number`.
- `packages/shared/zod-validation/text-validation-schemas/text-settings-validation-schema.ts`
  and its test (added in 8b.1: the table cannot refuse a repeated reminder, so
  the schema does; the seed parses through it).
- `packages/shared/scripts/seed-dev.ts`: Summit's text settings.
- `backend/lib/text/`: `send-text.ts`, `send-text-error.ts`, `find-sent-text.ts`,
  `twilio-account.ts` and `twilio-error-code.ts` (added in 8b.1, one export per file),
  `text-settings-rules.test.ts`; in 8b.2 `format-text-time.ts`, `plain-text.ts`,
  `render-confirmation-text.ts` (one export per file, so the reminder's wording
  is its own file in 8b.3), `fit-business-name.ts` and `text-piece-length.ts`
  (the one-piece rule, both texts use them; added in 8b.2's review, F-204),
  `find-booking-text-context.ts`, `log-text-not-sent.ts`;
  `send-booking-text.ts` (8b.2's confirmation sender, made in 8b.3 the one
  sender for both texts, so their rules cannot drift apart) and
  `render-reminder-text.ts`;
  `find-text-settings.ts` (the wording is one render file per text, above),
  `verify-twilio-signature.ts`, `pass-on-reply.ts`, with tests; in 8b.4 also
  `find-texting-business.ts` (whose number it is, also the F-199 guard),
  `read-twilio-message.ts` (the job reads the words back from Twilio),
  `find-reply-sender-name.ts`, `readable-phone-number.ts`,
  `render-reply-text.ts`, and `backend/emails/text-reply-notification.tsx`
  (the reply by email, from the business's own sender).
- `backend/lib/jobs/job-task.ts` hands each job its try number (8b.2);
  `backend/vitest.setup.ts` blanks the Twilio keys so no test uses real ones.
- `backend/lib/booking/booking-page-token.ts`: the packed link (decision 11).
- `backend/lib/jobs/`: `booking-text-job.ts`, `enqueue-booking-texts.ts`,
  `text-reply-job.ts`; `job-names.ts` and `job-tasks.ts` gain both names.
- `backend/lib/booking/book-time.ts`, `move-booking.ts`: add the text jobs in
  the same transaction. `cancel-booking.ts` unchanged (decision 6).
- `backend/routes/public-text-routes.ts` mounted in `backend/app.ts` at
  `/texts`, so Twilio posts to `/texts/incoming`; no CORS, no browser calls it.
- `packages/shared/db/text-tables/text-reply-table.ts` and migration
  `0020_text_reply` (8b.4's review: one row per reply, how far its passing on got).
- `backend/lib/jobs/enqueue-job.ts` gains `jobKey`; `twilio-account.ts` also
  hands back the auth token, for the signature.
- `.env.example`: the two Twilio keys. `AGENTS.md`: the client-decides rule
  (written with this spec).

## Data / contracts

**`text_settings`**, one row per business:

| Column | Type | Rule |
|---|---|---|
| `organizationId` | text, PK | references `organization`, cascade |
| `fromNumber` | text, not null, unique | `+1` and 10 digits; the business's Twilio number |
| `confirmationOn` | boolean, not null | no default: set at setup |
| `reminderMinutesBefore` | integer[], not null | each > 0, no repeats; empty means no reminder |
| `replyPhone` | text, null | `+1` and 10 digits |
| `replyEmail` | text, null | an address |
| `updatedAt` | timestamptz | |

Check: `replyPhone` or `replyEmail` is set.

**`text_reply`**, one row per customer reply (added in 8b.4's review): `messageSid`
(PK, Twilio's id), `organizationId` (cascade), `textTriedAt` (a run's claim on the
text, held 60 seconds, let go only when Twilio refused the send), `textSentAt`, `emailSentAt`, `createdAt`. No number and no words.

**Job payloads**, ids only (8a rule):
`booking_text`: `{ organizationId, bookingId, kind: "confirmation" | "reminder", sequence, minutesBefore: number | null }`.
`text_reply`: `{ organizationId, messageSid }`, with the reply's sender and
words read back from Twilio by its id when the job runs, so no customer
detail sits in the jobs table.

**`sendText(input)`**: `{ from, to, body, kind }` to Twilio's id, or null in
development without keys. Throws `SendTextError` with `retry: boolean` and a
reason that never holds a number or the words.

**`sms_sent` payload**: `{ bookingId, kind, twilioSid }` (and `minutesBefore`
for a reminder). Never a phone number or the words.

**`POST /texts/incoming`**: Twilio's form post; 403 without a valid
`X-Twilio-Signature`; otherwise 200 `text/xml` `<Response/>`.

**Wording** (plain ASCII, one piece: at most 160 by `textPieceLength`, which
counts the eight double-cost characters as two; a name too long is cut by
`fitBusinessName`; `{when}` is "Tue Oct 13, 7:30am" in the business's zone):
- Confirmation: `{Business}: booked {when}. Details or changes: {link}`
- Reminder: `{Business} reminder: {when}. Details or changes: {link}`
- Passed-on reply (as built in 8b.4; F-220): `Reply from {name, }{number}: {words} (answer at {number}, not here)`,
  the number as 403-555-0148; their words untouched, `[picture not shown]` added
  when a picture came, cut with `...` only past Twilio's 1600 characters; it
  comes from the business's own number, so the business is not named. The
  email: subject `Text from {name or number}`, every word.

## Testing

Vitest, in the workspace of the code: `npm run test --workspace=@scheduleads-app/shared`
and `npm run test --workspace=backend` (local Postgres, migrated and seeded).
Twilio is never called: `fetch` to anything outside localhost is already
blocked in the backend tests, and the text tests fake Twilio's answers. The
job clock stays pinned as in 8a. The backend suite runs several times in a
row at each step, since 8a's flaky tests only showed over 7 to 10 runs. No
browser tests command exists, so none are added. A live text to a real phone
is a hand check at deploy, with Frank's Twilio keys, on his yes.

## Notes for the AI

- Read `AGENTS.md` "The client decides everything" before planning any step:
  no question to Frank about a fixed rule or a client's first value.
- Twilio's Messages API: `POST https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json`,
  form-encoded `From`, `To`, `Body`, basic auth sid:token. Refusals that never
  retry, checked against Twilio's error reference on 2026-10-07: 21211, 21610,
  21612, 21614, 21617 and 21266; everything else, 21408, 21606 and 20003
  among them, is retried (decision 7).
- Feature 12 (Settings): saving text settings refuses a reply phone that is
  any business's texting number (F-199), as the pass-on job already does.
- The signature is HMAC-SHA1 of the full URL plus the POST params sorted by
  name and concatenated, base64, compared in constant time. Behind Railway
  the URL is the public one; build it from the API's own origin, never the
  `Host` header.
- Canada: Twilio prices checked 2026-10-07: $0.0083 per part sent plus a
  carrier fee of about $0.007 to $0.009, $0.0083 per part received plus a
  carrier fee, a local number $1.15 a month (USD). A one-piece text is about
  1.6 cents, so Summit's confirmation and two reminders are about 5 cents a
  booking (decision 4).
- Only a note for later (Frank, 2026-10-07): how many messages each package
  includes. Raise it when packages and their limits come up; not 8b's scope.
  With it, a cap on replies passed on as texts (8b.4's review, F-229): anyone
  who knows a business's number makes the agency pay for a text in and one
  out per message; the email route costs nothing.
- CASL: these are messages about a booking Jane asked for. Twilio's own STOP
  handling stays on.
- Owner-made bookings get the texts, as they get the confirmation email.
- Deploy notes carried from 8a: F-176 (`RAILWAY_DEPLOYMENT_DRAINING_SECONDS=30`)
  and F-179, remind Frank at the deploy that ships 8a and 8b. At that deploy
  also: the Twilio keys on Railway, a number bought per business, and each
  number's incoming-message webhook set to exactly `${BETTER_AUTH_URL}/texts/incoming`
  (Twilio signs that address; any other, even a trailing slash, has every reply
  refused, logged as "not signed by Twilio for it"; F-223). The app's
  address (`APP_ORIGIN`) is in every text's link, so it must be short (the
  one-piece tests assume up to about 30 characters) and must not name the
  product (decision 4; noted by 8b.2's review).

## Implementation walkthrough

What was actually built, by area. The steps above are the plan; the build log
records how each step went against it. This is the shape of the code the
feature left behind, and the decisions in it that are not visible from the
code alone.

### shared: the settings, the replies, the phone (8b.1, 8b.4)

- `db/text-tables/text-settings-table.ts` (migration 0019): one row per
  business, no defaults. The number checks are written `^[+]1...` because
  drizzle-kit dropped the backslash of `\+` in the first generated migration.
  A check cannot count an array's distinct values, so repeated reminders are
  refused by `zod-validation/text-validation-schemas/text-settings-validation-schema.ts`,
  which the seed parses through. A reply phone equal to the row's own number is
  refused by the table; equal to another business's number, by the pass-on
  (F-199) and, later, by Settings (build-plan item 12).
- `db/text-tables/text-reply-table.ts` (migration 0020, added in 8b.4's review):
  one row per customer reply keyed by Twilio's message id, how far its passing
  on got. No number and no words.
- `helpers/textable-phone-number.ts`: "+1" and ten digits, area code and
  exchange starting 2 to 9, or null. Exported as
  `@scheduleads-app/shared/textable-phone-number`.
- The seed gives Summit Painting (dev) a made-up 555 number, the confirmation
  on, reminders at 1200 and 60, replies to its phone; Riverbend has no row.

### backend: the one door (8b.1)

- `lib/text/send-text.ts`: Twilio's Messages API by plain fetch (decision 5),
  10 seconds, Basic auth from `twilio-account.ts`. Refusals about the customer
  or the text (21211, 21610, 21612, 21614, 21617, 21266) are never retried;
  account problems (21408, 21606, 20003) and everything else are. An answer
  that is cut off or not JSON after a 2xx is `unreadable_answer`, retried,
  because the text may have gone. Nothing about a text reaches a log line.
  Without keys: a log line in development, a retried failure in production.
- `lib/text/find-sent-text.ts`: before a resend, the newest 20 texts from the
  business's number to that phone, matched by the same words since a given
  moment with 10 seconds of clock slack (under the one-minute smallest gap
  between two reminders).
- `vitest.setup.ts` blanks the Twilio keys, so a `.env` with real keys never
  reaches a test (a loaded `.env` never overrides a set value).

### backend: the customer's texts (8b.2, 8b.3)

- `lib/booking/booking-page-token.ts`: the link packed to 45 characters
  (decision 11), the booking id's 16 bytes and the first 16 of the HMAC, each
  in base64url, one spelling only. Emails and texts share it.
- `lib/text/format-text-time.ts` ("Tue Oct 13, 7:30am", built from Intl parts),
  `plain-text.ts` (accents dropped, letters NFKD cannot split spelled out,
  typographic marks made plain, the rest removed), `text-piece-length.ts`
  (eight characters cost two), `fit-business-name.ts` (a long name loses words
  from its end, never ending on a joining mark, until the text fits 160).
  `render-confirmation-text.ts` and `render-reminder-text.ts` hold the two
  wordings.
- `lib/jobs/enqueue-booking-texts.ts`: in the booking's or the move's own
  transaction, the confirmation (new bookings) and one reminder job per minutes
  in the business's settings at that moment, due at the appointment minus its
  minutes, none already past. Cancel adds nothing.
- `lib/text/send-booking-text.ts`: the one sender for both texts. It rereads
  the booking: cancelled, started, no settings, the confirmation off, a later
  move (reminders carry the move number), a reminder since removed, no time
  zone, no textable phone each log one line and send nothing. A booking moved
  before its confirmation went is confirmed at the new time (there is no move
  text). On a retry it asks Twilio first, from the booking's creation for the
  confirmation and from the reminder's own moment for a reminder. Each text
  that went is an `sms_sent` entry with no number and no words.
- `lib/jobs/job-task.ts` hands each job its try number; the text job's payload
  is a union, and anything that is neither text throws.

### backend: the customer's replies (8b.4)

- `routes/public-text-routes.ts` at `/texts/incoming`: only a post with
  Twilio's valid signature for `${BETTER_AUTH_URL}/texts/incoming` is taken
  (`verify-twilio-signature.ts`, proved against Twilio's own documented
  example); a refusal is logged with that address. The business comes from the
  number texted; a job keyed by the message id is added and Twilio is answered
  at once. `enqueueJob` gained `jobKey`.
- `lib/text/pass-on-reply.ts`: reads the text back from Twilio by id
  (`read-twilio-message.ts`), so posted fields can never inject words. Never a
  text from the reply phone itself, never to any business's texting number.
  The email (through the business's own Resend sender,
  `emails/text-reply-notification.tsx`) and the text are both tried on every
  run. The text is claimed for 60 seconds on its `text_reply` row before
  sending, so two runs never both send; the claim is let go only when Twilio
  refused the send itself, and only a run after an unclear answer asks Twilio
  first, counting from when the reply was recorded. Their words go untouched
  (an emoji costs more, the business can choose email instead), with
  "[picture not shown]" for a picture and a "..." cut only past 1600
  characters.

### Tests

- New: `send-text.test.ts`, `find-sent-text.test.ts`,
  `text-settings-rules.test.ts`, `render-confirmation-text.test.ts`,
  `render-reminder-text.test.ts`, `render-reply-text.test.ts`,
  `verify-twilio-signature.test.ts`, `booking-text-job.test.ts` (the
  confirmation, the six Simulate cases under their names, the retry cases),
  `public-text-routes.test.ts` (a fake Twilio that keeps the texts it took and
  lists them), the shared phone and schema tests.
- `booking-email-job.test.ts` no longer assumes the order of jobs saved in one
  transaction: graphile-worker orders by priority and run_at only, so the
  extra text jobs made three 8a tests fail about once in ten runs (F-230,
  F-234).
- Final count: 738 backend tests (10 runs in a row) and 142 shared, all
  passing.

## Findings

Resolved during this feature and archived with it. IDs carry the feature number;
the bare IDs inside each entry are the ones used while the work was live.
F-32, F-47, F-58, F-62, F-94, F-95, F-128, F-134, F-137, F-145, F-146, F-153, F-161, F-170, F-171, F-172, F-176, F-179, F-193, F-194, F-229, F-238, F-239 stay in the live ledger.

### 8b/F-195 [P2] closed - Decision 8 says the duplicate check looks back a day, which would take a booking's earlier reminder for the one being retried

**File:** blueprint/context/current-feature.md:98-101 (the code it governs: backend/lib/text/find-sent-text.ts:24, 56-62; the wording: current-feature.md:249)
**Found:** 2026-10-07 by /audit (scope: 8b.1, 3b47c1c..7582593; lenses: quality, security, performance, tests)
**Why it matters:** Every reminder of one booking has the same words: the
spec's reminder wording names the business, service, time and link, never
how far ahead it is (line 249). Decision 8 tells the caller to look for "the
same body ... in the last day". With Summit's seeded reminders at 1200 and 60
minutes, the 1200 one goes about 19 hours before the 60 one; if the 60 one's
first send loses its answer, a one-day look-back finds the 1200 one, records
it as sent, and Jane gets no last reminder. `findSentText` itself is right: it
takes `since` and matches only texts from then on (minus 60 s of clock slack),
but the spec 8b.2 and 8b.3 build from still describes the unsafe window and
does not say what `since` is. The obvious job field is also wrong for a
reminder: graphile-worker's `created_at` is when the booking was made, before
the earlier reminder went, and `run_at` moves on each retry. Residual even
with the right `since`: two reminders set within a minute of each other (the
schema allows 61 and 60) fall inside the 60 s slack.
**Suggested fix:** Amend decision 8 to "since this text's first try", and say
in 8b.2/8b.3 what that is: the job's creation for the confirmation, the
appointment minus `minutesBefore` for a reminder (never the job's
`created_at`). Optionally make each reminder's words differ (or refuse
reminders less than two minutes apart) so the slack cannot bridge two of them.
**Resolution:** Fixed 2026-10-07 in 8b.1's review fixes: decision 8 now says "since this text's first try", defined as the booking's creation for the confirmation and the appointment minus its minutes for a reminder; the clock slack in find-sent-text.ts is 10 s, under the one-minute smallest gap between two reminders (F-200's test bounds it). 8b.2 and 8b.3 pass that `since`. Closed 2026-10-07 by re-review of 8b.1's fixes: decision 8 (current-feature.md:102-112) no longer says "in the last day" and defines `since` per kind (the booking's creation, the appointment minus its minutes), so neither the job's `created_at` nor the moving `run_at` is left as the obvious reading; find-sent-text.ts:14 is 10 s, under the one-minute gap the schema leaves between two distinct whole-minute reminders. Setting it to 60_000 or 120_000 fails find-sent-text.test.ts:90 (run in this pass, file restored, `git status` clean). One gap remains outside this finding: 8b.3's own text does not cite decision 8 and its Done when has no reminder-retry case, recorded as F-201.

### 8b/F-196 [P3] closed - The text settings check's refusal of a blank reminder has no test, and it is the only thing refusing one

**File:** packages/shared/db/text-tables/text-settings-table.ts:49-52 (tests: backend/lib/text/text-settings-rules.test.ts:103-111)
**Found:** 2026-10-07 by /audit (scope: 8b.1, 3b47c1c..7582593; lenses: quality, security, performance, tests)
**Why it matters:** Against the local database, `0 < all(array[60,null]::int[])`
is null, which a check accepts, while `array_position(array[60,null]::int[], null)`
is 2 (read-only query run during this audit). So the `array_position` half
is the only guard against a reminder with no minutes, which 8b.3 would turn
into a job with no time. The rules test covers 0 and -30 but no null element,
so deleting that half would leave every test green.
**Suggested fix:** Add `["a blank", [60, null]]` to the reminder `test.each` in
text-settings-rules.test.ts, expecting `text_settings_reminder_minutes_check`.
**Resolution:** Fixed 2026-10-07 in 8b.1's review fixes: text-settings-rules.test.ts refuses a reminder "left blank", [60, null], by text_settings_reminder_minutes_check. Closed 2026-10-07 by re-review of 8b.1's fixes: text-settings-rules.test.ts:106 adds `[60, null]` to the reminder `test.each`, expecting `text_settings_reminder_minutes_check` (23514); with that array `0 < all(...)` is null, so only the `array_position` half refuses it, and dropping that half would fail this case. The backend suite passed three runs in a row with it.

### 8b/F-197 [P3] closed - Twilio's answer is read outside the error sorting, so a body that fails to arrive or parse escapes as a plain error

**File:** backend/lib/text/send-text.ts:70-72; backend/lib/text/find-sent-text.ts:55-57
**Found:** 2026-10-07 by /audit (scope: 8b.1, 3b47c1c..7582593; lenses: quality, security, performance, tests)
**Why it matters:** The contract (current-feature.md, `sendText`) is that a
failure throws `SendTextError` with `retry`. The `AbortSignal.timeout` also
covers reading the body, and `response.json()` sits outside both try blocks:
a 201 whose body stalls past the limit throws a bare `TimeoutError`
(DOMException), and a 200 list answer that is not JSON, or has no `messages`,
throws a `SyntaxError` or `TypeError` from `.find`. 8b.2's job will branch on
`SendTextError.retry`; these arrive as something else. The send's case is the
very one decision 8 is for (the text went, the answer was lost).
**Suggested fix:** Read the success body inside a try and map a failure to
`SendTextError("no_answer", status, true, ...)`; in findSentText also treat a
missing `messages` array as a retryable `SendTextError`. A test each.
**Resolution:** Fixed 2026-10-07 in 8b.1's review fixes: send-text.ts reads Twilio's answer inside its own handling, so a 2xx whose body is cut off, not JSON or has no id throws SendTextError unreadable_answer, retried (the retry checks first); find-sent-text.ts does the same for a list answer, and reports a timeout as "timeout". Tests: not JSON, JSON without an id, an answer that stops halfway (cut by the time limit), a list answer not JSON or without a list, a list timeout. Closed 2026-10-07 by re-review of 8b.1's fixes: send-text.ts:161-173 reads the 2xx body in a try, and a body that throws, is not JSON or has no string `sid` throws SendTextError("unreadable_answer", status, true); find-sent-text.ts:58-69 does the same for the list and checks `Array.isArray`; a fetch timeout there is now "timeout" (:39-42). The halfway test (send-text.test.ts:131-150) errors the body stream through the same `init.signal` the code passes, so it fails if the read moves back outside the try. No new defect, apart from the error class's code comment not naming the new code (F-203).

### 8b/F-198 [P3] closed - The never-retry list may miss Twilio refusals that no retry fixes, and the spec's "check the current list" left no record

**File:** backend/lib/text/send-text.ts:10-12
**Found:** 2026-10-07 by /audit (scope: 8b.1, 3b47c1c..7582593; lenses: quality, security, performance, tests)
**Why it matters:** The spec (Notes for the AI) asks for the five codes to be
checked against Twilio's current error reference at 8b.1; nothing in the spec,
code or commit records that it was. From memory, and not checked here because
the audit may not reach the network: 21606 (the From number cannot send to
this destination), 21617 (body over 1600 characters) and 21266 (To and From
the same) are refusals a retry cannot change, and each would be tried 10
times, each retry preceded by a `findSentText` call. Not a wrong text, only
wasted calls and a late log line, hence a lead.
**Suggested fix:** Check the codes against https://www.twilio.com/docs/api/errors
and either add the ones that cannot change on retry or record in the spec that
config refusals stay retried on purpose (fixed config, then the retry sends).
**Step review note (independent, 2026-10-07):** agreed, still unverified (no
network here either). One more thing to settle in the same pass: the list
already sorts config refusals both ways. 21408 (the region not enabled in the
account's geo permissions) is fixed in Twilio's console like 20003 (keys not
taken), yet 21408 is never retried (send-text.ts:12) and 20003 is
(send-text.test.ts:81). Whichever rule is chosen should cover both.
**Resolution:** Fixed 2026-10-07 in 8b.1's review fixes, codes checked against Twilio's error pages that day: never retried are the refusals about this customer or this text, 21211, 21610, 21612, 21614, 21617 (over 1600 characters) and 21266 (to the sending number itself); refusals about the agency's account, 21408, 21606 and 20003, are retried, so a fix in Twilio's console lets the waiting texts go. Spec decision 7 and its notes amended; send-text.test.ts covers each. Closed 2026-10-07 by re-review of 8b.1's fixes: the list now follows one rule, stated alike in decision 7, the spec's notes (current-feature.md:283-287) and send-text.ts:9-14 (refusals about this customer or this text never retry; refusals about the agency's account, 21408, 21606 and 20003, retry), which settles the step review's 21408/20003 split. The codes' meanings match this reviewer's knowledge of Twilio's reference (not re-fetched: no network in this pass). send-text.test.ts:64-89 sorts each code; putting 21408 back in NEVER_RETRY fails "a country not yet switched on in the account fails for now: retried" (run in this pass, file restored, `git status` clean).

### 8b/F-199 [P3] closed - A reply phone may be another business's texting number, which hands one business's customer replies to another, or loses them

**File:** packages/shared/db/text-tables/text-settings-table.ts:37-41; packages/shared/zod-validation/text-validation-schemas/text-settings-validation-schema.ts:42-45
**Found:** 2026-10-07 by independent step review (scope: 8b.1, 3b47c1c..7582593; lenses: quality, security, performance, tests)
**Why it matters:** The table and the schema refuse a reply phone equal to the
row's own `fromNumber`, but nothing refuses one equal to another row's
`fromNumber`, and a check cannot see other rows. Following 8b.4 as the spec
writes it (current-feature.md:174-185): if Summit's reply phone is set to
Riverbend's texting number, Summit's passed-on reply goes from Summit's number
to Riverbend's, Twilio posts it to `/texts/incoming`, the business is found by
the number texted (Riverbend), the sender is not Riverbend's reply phone, so it
is passed on to Riverbend's owner: Jane's number and words reach another
tenant. Set both ways, decision 9's own-reply-phone rule drops it instead, and
Jane's reply reaches no one, against decision 2's "a reply is never lost".
Reachable only through a setup mistake (the platform admin types the values),
hence P3; that Twilio delivers between two numbers of one account is assumed,
not tested here.
**Suggested fix:** In 8b.4's pass-on job, refuse (log, without the number) a
reply phone that is any business's `fromNumber`; and have client setup and
Settings (feature 12) refuse such a value when saving. A test for the job's
refusal.
**Resolution:** Carried to 8b.4, where the harm would happen: its spec now says the pass-on job never texts a reply phone that is any business's texting number (then the reply email only, or logged), with a test in its Done when; feature 12's Settings refuses it on save (spec notes). Stays open until 8b.4 builds and tests it. Re-review of 8b.1's fixes (2026-10-07): the carried text is coherent. 8b.4 (current-feature.md:185-206) refuses a reply phone that is any business's texting number when the job runs, so a value saved before or after the other business's number still cannot leak; it falls back to the reply email or a log line, and its Done when has the matching case (worth also asserting that the reply email still gets the text when one is set). The feature 12 half lives only in this spec's Notes for the AI (:288-289), which `/complete` archives with 8b; recorded as F-202 so it outlives this entry. Fixed 2026-10-07 in 8b.4: pass-on-reply.ts never texts a reply phone that is any business's texting number (findTextingBusiness), logs it and still sends the reply email when one is set. Test: "a reply phone that is a business's texting number gets nothing, and the email still goes"; proved: removing the guard fails it. Feature 12's Settings refuses it on save (build-plan item 12). Closed 2026-10-07 by the audit of 8b.4: pass-on-reply.ts:48-50 asks findTextingBusiness(settings.replyPhone) before any text and, when the reply phone is any business's texting number (its own included), logs "the reply phone is a texting number, so not as a text" and goes on to the email at :73-95; findTextingBusiness compares against text_settings.fromNumber (unique, so indexed), and both columns hold the same +1 shape by the table's checks, so an exact match is the right compare. public-text-routes.test.ts "a reply phone that is a business's texting number gets nothing, and the email still goes" asserts no text, one email and the log line; without the guard the fake Twilio takes the text and the first assertion fails (by reading; no source edited in this pass). The Settings half is in build-plan.md:303-307.

### 8b/F-200 [P3] closed - No test bounds the duplicate check's clock slack, so widening it to a day would keep every test green

**File:** backend/lib/text/find-sent-text.ts:12, 56 (tests: backend/lib/text/find-sent-text.test.ts:66-90)
**Found:** 2026-10-07 by independent step review (scope: 8b.1, 3b47c1c..7582593; lenses: quality, security, performance, tests)
**Why it matters:** The only match dated before `since` is 30 seconds before
(test line 84); the only earlier non-match is 31 hours before (line 71, Oct 6
09:00 against Oct 7 16:00). Any `CLOCK_SLACK_MS` from 30 s up to 31 h passes
the suite, so a change that widened the slack toward the one-day look-back the
spec's decision 8 still describes would take an earlier reminder with the same
words for the one being retried (the risk F-195 records) without a red test.
The slack's upper side is the part that keeps two reminders of one booking
apart.
**Suggested fix:** Add a case with the same words a few minutes before `since`
(for example 16:00 minus 2 minutes, outside the 60 s slack), expecting null.
**Resolution:** Fixed 2026-10-07 in 8b.1's review fixes: find-sent-text.test.ts finds the same words 5 s before the first try and refuses them a minute before, so a slack of a minute or more fails a test. Closed 2026-10-07 by re-review of 8b.1's fixes: find-sent-text.test.ts:82-96 bounds the slack on both sides (15:59:55 found, 15:59:00 not, against a 16:00:00 first try). Proved in this pass: CLOCK_SLACK_MS at 120_000 and at 60_000 each fail "the same words a minute or more before the first try are another text" (1 failed, 14 passed); the file was restored and `git status` showed it unchanged.

### 8b/F-201 [P3] closed - 8b.3 never says which `since` a reminder's retry passes, and its Done when has no case where an earlier reminder has gone

**File:** blueprint/context/current-feature.md:171-183 (rule: decision 8 at :102-112; the check: backend/lib/text/find-sent-text.ts:70-77)
**Found:** 2026-10-07 by re-review of 8b.1's fixes (scope: 7582593..9b8793a, with 3b47c1c..9b8793a as context; lenses: quality, security, performance, tests)
**Why it matters:** F-195's harm is decided by the job, not by `findSentText`:
the job picks `since`. The fix defined it in decision 8 only. 8b.2 points to
decision 8 ("On a retry, decision 8 first"), but 8b.3 names neither decision 8
nor the retry check, and F-195's suggested warning (never the job's
`created_at`, which for a reminder is when the booking was made) is written
nowhere. 8b.3's Done when lists cancels, moves, removed reminders and late
starts, but no "the 60-minute reminder's retry still sends after the
1200-minute one went", so a job that passes the booking's creation or the
job's `created_at` would keep every planned test green while Jane loses her
last reminder. find-sent-text.test.ts:90 bounds only the slack, given a
correct `since`.
**Suggested fix:** In 8b.3, add "on a retry, decision 8 first, with `since`
the appointment minus its minutes (never the job's `created_at`)" and a Done
when case: with Summit's 1200 and 60 reminders, the 1200 one sent, the 60
one's first send losing its answer, the retry still sends the 60 one.
**Resolution:** Fixed 2026-10-07 after the re-review: 8b.3's spec says a reminder's retry checks Twilio with since = the appointment minus its minutes, never the job's created_at or run_at, and its Done when adds "the 60-minute reminder's retry still sends after the 1200-minute one went". Closed 2026-10-07 by /audit of 8b.2 (bab087f..23ebb83): current-feature.md:207-211 says 8b.3's retry checks Twilio first (decision 8) with since = the appointment minus its minutes, never the job's created_at or run_at, and :217-218 has the 60-after-1200 retry case in the Done when. 8b.2's code does not pre-empt it: the only `since` passed today is the confirmation's, the booking's creation (send-confirmation-text.ts:66), and booking-text-job.ts leaves the reminder path to 8b.3.

### 8b/F-202 [P3] closed - The feature 12 half of F-199 lives only in this spec's notes, which are archived with 8b, and item 12 has no line for text settings at all

**File:** blueprint/context/current-feature.md:288-289 (plan: blueprint/build-plan.md:264-307)
**Found:** 2026-10-07 by re-review of 8b.1's fixes (scope: 7582593..9b8793a, with 3b47c1c..9b8793a as context; lenses: quality, security, performance, tests)
**Why it matters:** The fix commit records "Feature 12 (Settings): saving text
settings refuses a reply phone that is any business's texting number" in 8b's
Notes for the AI. `/complete` archives this spec with feature 8b, and feature
12's spec is drafted from build-plan.md, whose item 12 (264-307) names no
text settings at all, although the spec's Out of scope puts the Settings
screen for texts in feature 12. The earlier carried note of the same kind,
F-32, was written onto item 12 for that reason. Once 8b.4 closes F-199, the
save-time refusal survives only in an archive nobody specs from. The run-time
guard in 8b.4 still protects Jane, so the cost is a Settings screen that
accepts a value the job then silently ignores.
**Suggested fix:** With Frank's yes (the build plan is his), add to item 12 a
line for the text settings screen, including the F-199 refusal on save (and
the no-repeats rule the table cannot enforce).
**Resolution:** Fixed 2026-10-07 on Frank's yes: build-plan item 12 has a "Text settings" line (the number, the confirmation, any reminders, where replies go, nothing on by default; saving refuses a reply phone that is any business's texting number), and the overview's Settings line names text settings, its fingerprint refreshed. Closed 2026-10-07 by re-review of 8b.2's fixes: build-plan.md:303-307 has the Text settings line under item 12, saving refusing a reply phone that is any business's texting number (cited as "8b, F-199", the form item 12 already uses for F-50 and F-32); project-overview.md:87 names text settings; the source-hash recomputed by the overview rule from the working-copy bytes (project-plan.md, one zero byte, build-plan.md with completion marks normalized) is caf441cf8a70c963705f9e8b3acee89b7dd51c13037524915aee2f9760643bcb, matching project-overview.md:3.

### 8b/F-203 [P3] closed - SendTextError's list of codes leaves out the new "unreadable_answer" (and "http_NNN")

**File:** backend/lib/text/send-text-error.ts:7 (codes thrown: backend/lib/text/send-text.ts:168-173, backend/lib/text/find-sent-text.ts:63-68, backend/lib/text/twilio-error-code.ts:10)
**Found:** 2026-10-07 by re-review of 8b.1's fixes (scope: 7582593..9b8793a, with 3b47c1c..9b8793a as context; lenses: quality, security, performance, tests)
**Why it matters:** The field's comment reads "Twilio's error code, "timeout",
"no_connection" or "no_keys"". The fix commit adds a fourth code,
"unreadable_answer", thrown by both send-text.ts and find-sent-text.ts, and
`twilioErrorCode` already returns `http_<status>`. 8b.2 will log this code on
`sms` failures, so a reader of the class is told the set is closed when it is
not. Nothing branches on the code today (callers branch on `retry`), hence P3.
**Suggested fix:** Name every code in the comment ("Twilio's error code,
"http_502", "timeout", "no_connection", "no_keys" or "unreadable_answer"").
**Resolution:** Fixed 2026-10-07 after the re-review: the comment on SendTextError's code lists http_<status> and unreadable_answer too. Closed 2026-10-07 by /audit of 8b.2 (bab087f..23ebb83): send-text-error.ts:7-8 names "http_<status>", "unreadable_answer", "timeout", "no_connection" and "no_keys"; every `new SendTextError` in backend/lib (send-text.ts:33, 58, 65, 75, 89; find-sent-text.ts:41, 50, 63) throws one of those or Twilio's own code, and twilio-error-code.ts returns only Twilio's code or `http_<status>`. 8b.2 logs the code only for a never-retry refusal (send-confirmation-text.ts:77), whose codes are Twilio's fixed numbers.

### 8b/F-204 [P3] closed - The confirmation is one piece only for business names of up to 30 plain characters; nothing keeps a longer name, or one with | ~ { } [ ] ^ \, to one piece

**File:** backend/lib/text/render-confirmation-text.ts:15-20 (test: backend/lib/text/render-confirmation-text.test.ts:11, 75)
**Found:** 2026-10-07 by /audit (scope: 8b.2, bab087f..23ebb83; lenses: quality, security, performance, tests)
**Why it matters:** Decision 4 says each text fits one billed piece. With a
32-character app address the fixed parts take 130 characters, so the name
gets 30. Measured against the built renderer (scratch script, Wed Sep 30
11:45am, the test's link): a 30-character name gives 160, a 31-character name
161, "Face & Body Aesthetics Clinic Inc." 164, two pieces each. Business names
are allowed up to 80 characters (business-name-validation-schema.ts:11), so
the four tenants' current names pass only by luck of length. Separately, the
test counts every plain character as one, but `[ ] \ ^ { | } ~` are GSM-7
extension characters that cost two each: "Face | Body {Clinic} ~ Spa" renders
at 156 characters, 160 septets, and one more such character would split it
while `text.length <= 160` still passes. 8b.3's reminder wording
(" reminder: " is two characters longer than ": booked ") leaves 28.
**Suggested fix:** Decide with Frank what a too-long text does (a short
"text name" in text_settings, cutting the name, or a limit refused at client
setup / Settings), and record the budget in the spec; count extension
characters as two in the one-piece test (or strip them in `plainText`). Cover
the reminder's wording in 8b.3's length test.
**Resolution:** Fixed 2026-10-07 in 8b.2's review fixes: text-piece-length.ts counts the eight double-cost characters as two, and fit-business-name.ts cuts a business name a word at a time from its end until the text fits 160; render-confirmation-text.ts uses it (8b.3's reminder will too). Tests: a 70-character name keeps its start, the time and the link and fits; a name full of | { } ~ [ ] ^ fits by that count. Spec decision 4 says so; the deploy notes say APP_ORIGIN must stay short (about 30 characters) and must not name the product. Re-review of 8b.2's fixes (2026-10-07): left `fixed`. The code holds: probed against the built renderer, the 70-character Summit name is cut to "Summit Painting and Decorating" at 160, and the name full of | { } ~ [ ] ^ to "Face | Body {Clinic} ~ Spa" at 156 characters, 160 by the piece count. But the test does not pin the double count where the fitter uses it: with fit-business-name.ts:14 changed to `text.length > ONE_PIECE`, all 20 tests in render-confirmation-text.test.ts still pass (run in this pass; file restored, cmp identical, `git status` unchanged), because the next word, "[Calgary]", overshoots both counts. A name that splits the two counts would pin it: "Face | Body Aesthetics Clinics" makes a text of 160 characters but 161 by the piece count, which the fitter cuts to "Face | Body Aesthetics" (153) and a length count would send whole, in two pieces. The repair also brings F-210. Fixed again 2026-10-07 after the re-review: render-confirmation-text.test.ts has "a name whose text is 160 characters but more by the double count is cut to fit" (Face | Body Aesthetics Clinic AB, cut to Face | Body Aesthetics Clinic); proved: the fitter counting text.length fails it. Closed 2026-10-07 by the audit of 8b.3: probed against the built renderers (backend/dist, Wed Sep 30 11:45am, the tests' 30-character origin), "Face | Body Aesthetics Clinic AB" makes a confirmation of 160 characters but 161 by the piece count, so a length-counting fitter would send it whole, while fit-business-name.ts:18 cuts it to "Face | Body Aesthetics Clinic" (158 by the count; the reminder 160); render-confirmation-text.test.ts pins it. The reminder goes through the same fitter (render-reminder-text.ts:9-13), and render-reminder-text.test.ts covers the four tenants and a 70-character name at the longest time, each one piece by textPieceLength.

### 8b/F-205 [P3] closed - The email preview's sample link and the link helper's comment still describe the old link

**File:** backend/scripts/email-preview.ts:36-37; backend/lib/booking/booking-page-url.ts:1
**Found:** 2026-10-07 by /audit (scope: 8b.2, bab087f..23ebb83; lenses: quality, security, performance, tests)
**Why it matters:** Decision 11 changed the link to 22 + 22 base64url
characters. The preview script says "A link of the right shape" over
`/b/00000000-0000-4000-8000-000000000000.sample`, the old 36-hex form, so the
preview's email shows a link about twice the real length and the comment is
now false. booking-page-url.ts says the address is "as the customer's emails
link it"; since 8b.2 the confirmation text carries it too
(send-confirmation-text.ts:54).
**Suggested fix:** Make the sample a packed-shape link (for example 22 and 22
characters) and say emails and texts in booking-page-url.ts.
**Resolution:** Fixed 2026-10-07 in 8b.2's review fixes: the email preview's sample link has the packed shape (22.22 characters), and booking-page-url.ts says emails and texts carry it. Closed 2026-10-07 by re-review of 8b.2's fixes: email-preview.ts:37-38 samples `/b/AAAAAAAAQACAAAAAAAAAAA.sampleSignatureForPrev`, 22 + 22 characters (the first part is the sample uuid 00000000-0000-4000-8000-000000000000 packed), and booking-page-url.ts:1-3 says emails and texts link it.

### 8b/F-206 [P3] closed - 8b.2 brings the first step numbers and history into code comments

**File:** backend/lib/text/send-confirmation-text.ts:1-2; backend/lib/jobs/booking-text-job.ts:8-9; backend/lib/jobs/booking-text-job.test.ts:1; backend/lib/booking/booking-page-token.test.ts:25, 55
**Found:** 2026-10-07 by /audit (scope: 8b.2, bab087f..23ebb83; lenses: quality, security, performance, tests)
**Why it matters:** coding-standards.md:358-359: "No history in code comments
(step numbers, finding numbers, ...): that lives in the build log." `git grep`
for `// ... step N.M` finds no match at bab087f and three at 23ebb83
("step 8b.2", "step 8b.3", "step 8b.2"). The token test adds history too:
"Packed once, in 8b before any customer had one" and "as links once were".
Feature and decision pointers ("feature 8b, decision 11") are the codebase's
usual form and are not part of this.
**Suggested fix:** Drop the step numbers (keep "feature 8b"), and say what the
token test checks rather than when the link changed ("the booking id written
out in full opens nothing").
**Resolution:** Fixed 2026-10-07 in 8b.2's review fixes: the step numbers are out of send-confirmation-text.ts, booking-text-job.ts and booking-text-job.test.ts, and the history lines are out of booking-page-token.test.ts; `git grep -n "step 8b"` in backend finds none. Closed 2026-10-07 by re-review of 8b.2's fixes: `git grep -n -E "step [0-9]+[a-z]?\.[0-9]|F-[0-9]{2,}"` over backend, packages and frontend code finds only an old migration comment (F-06), and the token test's comments (booking-page-token.test.ts:24-25, :55) say what is checked, with no history. The fix's new files (fit-business-name.ts, text-piece-length.ts) carry none either.

### 8b/F-207 [P3] closed - plainText drops letters that do not decompose, so "Bjørn" becomes "Bjrn" and "Cœur" becomes "Cur"

**File:** backend/lib/text/plain-text.ts:9-15
**Found:** 2026-10-07 by /audit (scope: 8b.2, bab087f..23ebb83; lenses: quality, security, performance, tests)
**Why it matters:** NFKD splits é, è, ç and ô into a letter and a mark, but
ø, æ, œ, ß, ł and đ have no decomposition, so the last replace deletes them.
Measured with the built renderer: "Bjørn's Painting" is sent as "Bjrn's
Painting". Every tenant is in Canada, where œ appears in French names
("Cœur", "Sœurs"). Decision 4 asks for plain ASCII, not for dropped letters;
the business's own name is the one word the text must get right.
**Suggested fix:** Map the few letters NFKD leaves alone before the final
replace (ø→o, æ→ae, œ→oe, ß→ss, ł→l, đ→d, and their capitals), with a test
case in render-confirmation-text.test.ts.
**Resolution:** Fixed 2026-10-07 in 8b.2's review fixes: plainText spells out the letters NFKD does not split (o for ø, ae for æ, oe for œ, ss for ß, l for ł, d for đ, th for þ, and their capitals, plus ð and dotless i). Test: "Bjørn's Cœur Straße Łódź" becomes "Bjorn's Coeur Strasse Lodz". Closed 2026-10-07 by re-review of 8b.2's fixes: plain-text.ts:9-26 maps the 16 letters NFKD leaves whole, and the character class at :32 lists the same 16; render-confirmation-text.test.ts:40-44 passes. Proved in this pass: with the map's replacement changed to "", that test fails (received "Bjrn's Cur Strae odz"); the file was restored byte for byte (cmp) and `git status` showed it unchanged.

### 8b/F-208 [P3] closed - The "no time zone" skip has no test, the one skip case of 8b.2's Done when left uncovered

**File:** backend/lib/text/send-confirmation-text.ts:42 (tests: backend/lib/jobs/booking-text-job.test.ts)
**Found:** 2026-10-07 by /audit (scope: 8b.2, bab087f..23ebb83; lenses: quality, security, performance, tests)
**Why it matters:** 8b.2's Done when says "each skip case sends nothing", and
the step lists six: not confirmed, started, no settings, confirmation off, no
time zone, no textable phone. The job test covers five; nothing builds a
business without its own availability rule. Today `tsc` would refuse a null
zone reaching `renderConfirmationText`, but a change that defaults it (say to
the server's zone) keeps both the build and the suite green while the text
states a wrong time; without the guard and the types, `Intl.DateTimeFormat`
throws "Invalid time zone specified: null" (checked with node) and the job
retries ten times for nothing.
**Suggested fix:** A case in booking-text-job.test.ts: book, then delete the
business's own availability rule before working the job; expect no Twilio
call and the "the business has no time zone" log line.
**Step review note (independent, 2026-10-07):** agreed, P3. The guard is
reachable only that way: `availability_rule_row_kind_check`
(availability-rule-table.ts) refuses a business row without a timezone and
`availability_rule_business_unique` allows one per business, so the left join
in find-booking-text-context.ts yields null only when the business's own row
is gone, which is what the suggested test sets up.
**Resolution:** Fixed 2026-10-07 in 8b.2's review fixes: booking-text-job.test.ts has "a business with no time zone: nothing is sent" (its hours row removed after booking), which checks the logged reason. Closed 2026-10-07 by re-review of 8b.2's fixes: booking-text-job.test.ts "a business with no time zone: nothing is sent" removes the business's hours after booking and checks no Twilio call and the logged reason. Proved in this pass: with the guard removed and the zone defaulted to America/Edmonton, that test fails (1 failed, 13 passed); file restored (cmp), `git status` unchanged.

### 8b/F-209 [P3] closed - The lost-answer test does not pin which `since` the confirmation's retry passes; the booking's time or the retry's own time would keep it green

**File:** backend/lib/jobs/booking-text-job.test.ts:361-392 (code: backend/lib/text/send-confirmation-text.ts:66)
**Found:** 2026-10-07 by independent step review (scope: 8b.2, bab087f..23ebb83; lenses: quality, security, performance, tests)
**Why it matters:** Decision 8 and F-201 put the harm in the job's choice of
`since`: the booking's creation for the confirmation. The only job-level test
of the check lists Twilio's text with `date_created: new Date()` (test line
377), the real clock at list time, while the booking's time NINE is
2026-10-05 (line 47), already in the real past, and the job clock is pinned to
2026-10-02. So `since: context.startsAt` (earliest Oct 5 14:59:50, before the
listed Oct 7 date) and `since: new Date()` at the retry (earliest 10 s before
a date taken after it) both still find the text and pass, as `createdAt` does.
In production both are wrong: the confirmation goes days before `startsAt`, so
a `startsAt` cutoff never finds it and Jane gets the text twice; a retry-time
cutoff misses any text sent more than 10 s before the retry, which is every
timed-out send (10 s limit plus the e^1 s wait). 8b.3 adds the reminder's
`since` (the appointment minus its minutes) to the same job, the likeliest
moment for the confirmation's to be unified with it, and nothing would turn
red. find-sent-text.test.ts bounds only the slack, given a correct `since`.
**Suggested fix:** In that test, set the booking's `createdAt` to a fixed
moment before NINE (for example update it to 2026-10-02T13:59:00Z after
booking) and list the text dated a minute after it; add a twin case with the
same words dated a minute before that `createdAt`, expecting a POST.
**Resolution:** Fixed 2026-10-07 in 8b.2's review fixes: the lost-answer test pins the booking's creation to 2026-10-01 12:00 and runs twice, the same words dated a minute after (found, nothing sent again, SM7 recorded) and a minute before (another text, sent). Proved: since: context.startsAt fails the first case. Closed 2026-10-07 by re-review of 8b.2's fixes: booking-text-job.test.ts pins the booking's createdAt to 2026-10-01 12:00 and lists the same words a minute after (found, GET only, SM7 recorded) and a minute before (sent, SM1 recorded); send-confirmation-text.ts:66 passes context.createdAt. Proved in this pass: `since: jobClock.now()` fails the minute-after case and `since: new Date(0)` fails the minute-before case (1 failed, 13 passed each); file restored (cmp), `git status` unchanged.

### 8b/F-210 [P3] closed - A business name cut to fit can end on "&", a comma or a hyphen, so the text opens "Summit Painting, Decorating &: booked"

**File:** backend/lib/text/fit-business-name.ts:14-17
**Found:** 2026-10-07 by re-review of 8b.2's fixes (scope: 23ebb83..f5c4f6d, with bab087f..f5c4f6d as context; lenses: quality, security, performance, tests)
**Why it matters:** The fitter drops whole words from the end and stops at
the first fit, whatever the last word left is. Probed against the built
renderer (Wed Sep 30 11:45am, the test's 32-character origin):
"Summit Painting, Decorating & Renovations Ltd." is sent as "Summit
Painting, Decorating &: booked Wed Sep 30, 11:45am. ..." (159), and a name
cut after a lone "-" or a word ending in "," reads the same way. The
business's name is the part of the text the customer reads to know who it is
from (the reasoning F-207 was fixed on), and decision 4 says only that a long
name "loses words from its end", not that it may end mid-phrase. Reachable
only for names over about 30 characters, hence P3.
**Suggested fix:** After a cut, also drop trailing words that hold no letter
or digit ("&", "-", "|") and trailing commas, hyphens and colons from the
last word kept; a test with "Summit Painting, Decorating & Renovations Ltd."
expecting "Summit Painting, Decorating: booked". Whether to drop "and" and
"of" too is a wording call for Frank, not needed for the fix.
**Resolution:** Fixed 2026-10-07 after the re-review: fit-business-name.ts trims a joining mark (& + , ; : / ( - and spaces) from the end of a cut name. Test: "a cut name never ends on a joining mark"; proved: cutting without the trim fails it. Closed 2026-10-07 by the audit of 8b.3: fit-business-name.ts:12 trims & + , ; : / ( - and spaces from the end of a cut name, and the fit is measured on the trimmed name (:20); probed against the built renderers, "Summit Painting, Decorating & Renovations of Southern Alberta Ltd." opens "Summit Painting, Decorating: booked" (155) and "Summit Painting, Decorating reminder:" (157). The confirmation test pins it and the reminder uses the same function.

### 8b/F-211 [P3] closed - fit-business-name.ts exports an unused ONE_PIECE beside the function, and the test keeps its own copy of 160

**File:** backend/lib/text/fit-business-name.ts:8 (test: backend/lib/text/render-confirmation-text.test.ts:11)
**Found:** 2026-10-07 by re-review of 8b.2's fixes (scope: 23ebb83..f5c4f6d, with bab087f..f5c4f6d as context; lenses: quality, security, performance, tests)
**Why it matters:** coding-standards.md:113-114 puts backend files at one
file per export, and the spec repeats it for backend/lib/text (one export per
file, current-feature.md:257-260). The fix adds a second export,
`ONE_PIECE`, that nothing imports (`git grep ONE_PIECE` finds only its own
use at :14 and the test's separate `const ONE_PIECE = 160`). The piece size
now lives in two places that must change together, and text-piece-length.ts,
whose comment names "a text piece's 160", is where the measure belongs.
**Suggested fix:** Keep 160 private to the fitter (drop the `export`), or
move the fit check beside the measure (`fitsOnePiece(text)` in its own
file) and have both the fitter and the test use it rather than their own 160.
**Resolution:** Fixed 2026-10-07 after the re-review: ONE_PIECE is no longer exported from fit-business-name.ts; it is the file's own constant. Closed 2026-10-07 by the audit of 8b.3: `git grep ONE_PIECE` finds the fitter's private const (fit-business-name.ts:8, used at :18) and each test file's own copy (render-confirmation-text.test.ts:11, render-reminder-text.test.ts:9), the first option the suggested fix allowed; fit-business-name.ts exports only the function.

### 8b/F-212 [P3] closed - The spec's Wording and file list, and 8b.3, were not brought along with decision 4's new count and the fitter

**File:** blueprint/context/current-feature.md:307, 255-262, 205-219 (rule: decision 4 at :83-85; test: backend/lib/text/render-confirmation-text.test.ts:14-15)
**Found:** 2026-10-07 by re-review of 8b.2's fixes (scope: 23ebb83..f5c4f6d, with bab087f..f5c4f6d as context; lenses: quality, security, performance, tests)
**Why it matters:** The fix amended decision 4 (160 counting the eight
double-cost characters as two; a too-long name loses words), but the Wording
block that 8b.3 and 8b.4 are written from still says "at most 160
characters" (:307), the file list (:255-262) names neither
fit-business-name.ts nor text-piece-length.ts, and 8b.3's Done when
(:214-219) has no one-piece case for the reminder, whose " reminder: " is two
characters longer than ": booked " (F-204's own suggestion was to cover it
there). F-204's resolution says "8b.3's reminder will too" use the fitter;
only this ledger says so, and 8b.3 is built from the spec. Separately, the
test's "longest app address the texts are planned for" is
`https://app.scheduleads-mail.com` (32 characters, naming the product), while
the deploy note this fix added says the address must be about 30 characters
and must not name the product.
**Suggested fix:** Wording: "one piece by decision 4's count, a long name
fitted as decision 4 says"; list the two new files under 8b.2; add to 8b.3's
Done when "with the same app address and the longest time, the reminder is
plain and one piece by the piece count, a long name cut". Give the test's
sample origin a neutral name of the same length.
**Resolution:** Fixed 2026-10-07 after the re-review: the spec's Wording block counts by textPieceLength and names fitBusinessName, the file list names fit-business-name.ts and text-piece-length.ts, 8b.3's Done when has the reminder's one-piece cases through fitBusinessName, and the tests' sample app address is https://booking.example-app.ca (30 characters, not the product's name). Closed 2026-10-07 by the audit of 8b.3: current-feature.md's Wording block counts "at most 160 by `textPieceLength`" and cuts a long name "by `fitBusinessName`"; the file list names fit-business-name.ts, text-piece-length.ts and render-reminder-text.ts; 8b.3's Done when has the reminder through fitBusinessName and the four tenants' one-piece cases, built as render-reminder-text.test.ts; both render test files use https://booking.example-app.ca, and `git grep scheduleads-mail` in backend finds nothing.

### 8b/F-213 [P3] closed - The reminder retry's `since` is pinned only against the booking's creation; a `since` of the retry's own time or its run_at keeps every test green

**File:** backend/lib/text/send-booking-text.ts:94-101 (test: backend/lib/jobs/booking-text-job.test.ts:603)
**Found:** 2026-10-07 by /audit (scope: 8b.3, 0e863ac..6a646a9; lenses: quality, security, performance, tests)
**Why it matters:** 8b.3 says the reminder's retry checks Twilio with
`since` = the appointment minus its minutes, "never the job's `created_at`
(the booking's time) or `run_at` (which moves with each retry)" (F-201). The
one reminder retry test ("the 60-minute reminder's retry still sends after
the 1200-minute one went") lists a text dated at the 1200-minute moment
(2026-10-04 19:00Z) and fails only for a `since` at or before that, such as
the booking's creation or the pinned job clock. A `since` of `new Date()` or
the job's `run_at` (both the real day, 2026-10-07, in the tests, after
makeDue) also passes over that text and sends, so the test stays green. No
reminder test has the lost-answer case the confirmation has
(booking-text-job.test.ts:362-411): a reminder Twilio took at its own moment,
its answer lost, the retry finding it and sending nothing. With either wrong
`since` in production, every reminder whose answer was lost is sent twice,
which is what decision 8 exists to prevent. Same gap F-209 closed for the
confirmation.
**Suggested fix:** A reminder twin of the confirmation's lost-answer
`test.each`: the 60-minute reminder's first try taken with its answer lost,
Twilio listing the same words dated a minute after the reminder's moment
(found: POST then GET, nothing sent again, the listed sid recorded with
minutesBefore 60) and dated a minute before it, past the 10-second slack
(sent again).
**Resolution:** Fixed 2026-10-07 in 8b.3's review fixes: booking-text-job.test.ts has "a reminder's retry after its answer was lost" twice, the same words dated a minute after the reminder's moment (found, not sent again, SM7 recorded) and a minute before (sent). Proved: since = new Date() fails the first case. Closed 2026-10-07 by the audit of 8b.4: booking-text-job.test.ts:636-680 holds the reminder twin of the lost-answer case, the same words dated a minute after the reminder's moment (found, one send, SM7 recorded) and a minute before (sent again). A since of new Date() or the retry's run_at (the real day, after makeDue) passes over SM7 and fails the first case; the booking's creation or the job clock (the Friday) finds the earlier text and fails the second; the appointment itself (9:00) fails the first. send-booking-text.ts:97-100 uses the appointment minus its minutes.

### 8b/F-214 [P3] closed - A reminder job whose payload has no minutes is sent as the confirmation text

**File:** backend/lib/jobs/booking-text-job.ts:10-24
**Found:** 2026-10-07 by /audit (scope: 8b.3, 0e863ac..6a646a9; lenses: quality, security, performance, tests)
**Why it matters:** The payload type allows `{ kind: "reminder",
minutesBefore: null }`, and the job turns anything that is not a reminder
with minutes into `{ kind: "confirmation" }`. A malformed reminder payload,
or a later kind added to `booking_text` without this line, would send the
customer a "booked" text they never asked for, bill it, and record it as a
confirmation, instead of failing where it can be seen. Not reachable from the
only producer today, enqueue-booking-texts.ts:35-46, which always sets the
minutes for a reminder, hence P3.
**Suggested fix:** Make the payload a union (`{ kind: "confirmation";
minutesBefore: null } | { kind: "reminder"; minutesBefore: number }`) and
map each kind explicitly, throwing on anything else, so an impossible
payload never becomes a text.
**Resolution:** Fixed 2026-10-07 in 8b.3's review fixes: BookingTextJobPayloadType is a union (a confirmation's minutesBefore is null, a reminder's a number); the job sends a reminder only with its minutes, a confirmation only as one, and throws for anything else. Test: "a job that is neither text sends nothing and fails, so it is seen"; proved: falling back to the confirmation fails it. Closed 2026-10-07 by the audit of 8b.4: BookingTextJobPayloadType is a union (booking-text-job.ts:9-13); the job sends a reminder only with numeric minutes, a confirmation only for kind confirmation, and throws for anything else (:24-26) with only the booking id in the reason. booking-text-job.test.ts:704-722 enqueues a reminder with minutesBefore null and expects no Twilio call and one failed attempt; a fallback to the confirmation would post and fail it.

### 8b/F-215 [P3] closed - No test books with one reminder already past and another still ahead, so adding none once any is past keeps every test green

**File:** backend/lib/jobs/enqueue-booking-texts.ts:42 (test: backend/lib/jobs/booking-text-job.test.ts:557)
**Found:** 2026-10-07 by independent review of 8b.3 (scope: 0e863ac..6a646a9; lenses: quality, security, performance, tests)
**Why it matters:** 8b.3 says "none added for a time already past", which
means each reminder is judged on its own: a booking made 90 minutes ahead
with Summit's [1200, 60] gets the 60 and not the 1200. The only past-time
test ("a booking made 30 minutes ahead gets no 1200-minute reminder") books
at 8:30 for 9:00, where both reminders are past, and expects none. Every
other reminder test books on the Friday, where none is past. So changing
`continue` at :42 to `return` or `break` (stop at the first past one, with
the settings stored [1200, 60]) still passes all seven reminder tests, and
in production every booking made under 20 hours ahead would lose its
60-minute reminder too. Found by reading; not mutation-run, since this pass
edits no source.
**Suggested fix:** In that test, or a twin, book 90 minutes ahead (7:30 for
9:00) and expect exactly one job, `{ runAt: 2026-10-05T14:00Z, minutesBefore:
60, sequence: 0 }`, and the 60-minute reminder sent.
**Resolution:** Fixed 2026-10-07 in 8b.3's review fixes: "a booking made 90 minutes ahead gets its 60-minute reminder and not its 1200-minute one" expects exactly the 60-minute job; proved: continue changed to break fails it. Closed 2026-10-07 by the audit of 8b.4: booking-text-job.test.ts:682-702 books 7:30 for 9:00 with TWO_REMINDERS stored [1200, 60] (:482) and expects exactly the 60-minute job; `break` or `return` at enqueue-booking-texts.ts:44 stops at the 1200 before reaching the 60 and leaves no job, failing it.

### 8b/F-216 [P3] closed - The spec's file list still names a booking-texts.ts for the wording, and the text job test's header still says it covers the confirmation

**File:** blueprint/context/current-feature.md:269; backend/lib/jobs/booking-text-job.test.ts:1
**Found:** 2026-10-07 by independent review of 8b.3 (scope: 0e863ac..6a646a9; lenses: quality, security, performance, tests)
**Why it matters:** 8b.3 edited this list to add send-booking-text.ts and
render-reminder-text.ts, and the same list says the wording is one file per
text ("so the reminder's wording is its own file in 8b.3"), yet two lines
down it still names `booking-texts.ts` (the wording), which does not exist
(`ls backend/lib/text`). 8b.4 builds from this list, and the passed-on
reply's wording could land in a booking-texts.ts beside the one-per-file
render files. The test file now holds the reminders' seven cases, but its
first line reads "A booking's confirmation text as a job".
**Suggested fix:** Drop `booking-texts.ts` (the wording) from the list, or
name the reply's wording file 8b.4 will add (for example
render-reply-text.ts); say "A booking's texts as jobs" in the test's header.
**Resolution:** Fixed 2026-10-07 in 8b.3's review fixes: the spec's file list no longer names booking-texts.ts (the wording is one render file per text), and booking-text-job.test.ts's first lines say it holds the confirmation and the reminders. Closed 2026-10-07 by the audit of 8b.4: `grep booking-texts blueprint/context/current-feature.md` finds only enqueue-booking-texts.ts, the file list says the wording is one render file per text and names render-reply-text.ts for 8b.4, no booking-texts.ts exists in backend/lib/text, and booking-text-job.test.ts:1-2 reads "A booking's texts as jobs, the confirmation and the reminders".

### 8b/F-217 [P3] closed - A reply Twilio posts again after its job has tried once, or while it runs, is passed on twice

**File:** backend/lib/text/pass-on-reply.ts:57-58; backend/routes/public-text-routes.ts:56; backend/lib/jobs/enqueue-job.ts:17
**Found:** 2026-10-07 by /audit (scope: 8b.4, ad5e703..63da7b7; lenses: quality, security, performance, tests)
**Why it matters:** The route and the spec say the job key makes "Twilio
posting the same text twice" pass it on once. That holds only while the first
job is waiting untried. graphile-worker's add_jobs in replace mode (the
default; node_modules/graphile-worker/sql/000020.sql) sets `attempts = 0`
on a waiting job it replaces, and for a job that is running clears its key and
inserts a fresh job; once the first job has finished, a repost simply adds a
new one. Each of those runs as attempt 1, and the pass-on text is checked with
Twilio only when `attempt > 1`, so the business's phone gets the reply
twice. The email is safe (Resend's idempotency key). The one test posts twice
before any job runs. Twilio reposts only through a fallback URL or connection
overrides, hence P3.
**Suggested fix:** Check Twilio for the pass-on text on every attempt (drop
the `attempt > 1` condition; one GET per reply), and add a test that posts
the same text again after the job ran and expects one text. Note in the
comment that two identical replies within the clock slack then pass on once.
**Resolution:** Independent step review 2026-10-07: confirmed by reading graphile-worker 0.18.0 `sql/000020.sql`: add_jobs clears the key of a running job and inserts a fresh one (:120-131), and resets a waiting job, a once-failed one included, to `attempts = 0` (:186-189), so the repost runs as attempt 1 and skips findSentText (pass-on-reply.ts:57-58). Valid, P3 agreed. The same path is reached by a replay of a captured signed post, which Twilio's signature cannot refuse (it carries no time); the words are still read back from Twilio, so a replay can only repeat a pass-on, never change one. Fixed 2026-10-07 in 8b.4's review fixes: the pass-on text is checked with Twilio before every send, not only on a retry (a job Twilio's repost starts afresh is covered). Test: "Twilio posting the same text again after it was passed on sends nothing again"; proved: dropping the check fails it. Re-review 2026-10-07 of 8b.4's fixes: left `fixed`. The repost after a finished run is gone (the test stands). Two things remain, recorded as F-231: the "while it runs" half of the title is not closed, because the runner works 5 jobs at once (start-job-runner.ts:10) and add_jobs gives a locked job's key to a fresh, at-once-due job (graphile-worker sql/000020.sql:120-131), so both runs pass findSentText before either sends; and the repair adds a new loss, since the check now runs on every first try and matches by words: identical replies close together pass on as one text. The comment this finding's own suggested fix asked for (identical replies within the slack pass on once) was not added. Close with F-231. Fixed again 2026-10-07 after the re-review: each reply has a text_reply row (migration 0020) keyed by Twilio's id; a run claims the text for 60 seconds before sending (an atomic update under a row lock), so a repost's job running beside the first finds the claim held and tries later. Test: "a run that finds another run holding the text sends nothing and tries again later"; proved: ignoring the claim fails it. Independent review of feature 8b, 2026-10-07 (3b47c1c..5fc8ab0): left `fixed`. The repost defect itself is gone: a repost after a finished run finds textSentAt set (pass-on-reply.ts:124), and one beside a running job finds the claim held (:34-57, :138-140); both tests stand and the suite passed 6 runs in a row. But the repair that closes it (0c023a7) lets the claim go on any SendTextError carrying a status (:157-161), which includes a send Twilio took with its answer lost (send-text.ts:89-94, status 201), so the next run, a repost's included, sends without asking Twilio (F-236). Close with F-236. Closed 2026-10-07 by the independent review of feature 8b: the repost after a finished run finds textSentAt set and sends nothing (pass-on-reply.ts:42, :124), a repost's job beside a running one finds the claim held (:35-58, :138-140), and since 43d308e a lost answer (201, unreadable) keeps the claim (:165-172), so a repost's run after it asks Twilio first instead of sending unchecked. "Twilio posting the same text again after it was passed on sends nothing again", "a run that finds another run holding the text sends nothing and tries again later" and "a retry after the pass-on's answer was lost sends nothing again" pass; the backend suite passed 5 runs in a row (738 tests each).

### 8b/F-218 [P3] closed - A pass-on text that keeps failing holds back the reply email, and after the last try the reply reaches neither

**File:** backend/lib/text/pass-on-reply.ts:63-67, :73
**Found:** 2026-10-07 by /audit (scope: 8b.4, ad5e703..63da7b7; lenses: quality, security, performance, tests)
**Why it matters:** With both destinations set, a retryable SendTextError
for the reply phone is rethrown at :66 before the email at :73 is tried. A
refusal decision 7 retries on purpose (an account-level 21606, 21408 or
20003, or Twilio down for the send) therefore delays the email through every
retry, and once the attempts run out the reply has gone nowhere, against
decision 2's "so a reply is never lost". The email is the destination that
does not depend on Twilio's send at all.
**Suggested fix:** Send the email first (its idempotency key makes a retry
safe), or catch the text's error, send the email, then rethrow. A test where
the pass-on text keeps failing and the email still goes on the first try.
**Resolution:** Independent step review 2026-10-07: confirmed by reading pass-on-reply.ts:63-67, where a retryable SendTextError is rethrown before the email at :73 is tried. Valid, P3 kept (the reachable cases are an account-level refusal for the reply phone, such as 21408 for a reply phone outside an enabled country, or a long Twilio outage), but it is the one path where decision 2's "a reply is never lost" fails while a working destination exists, and the fix is a reorder; worth taking in this step's review fixes. Fixed 2026-10-07 in 8b.4's review fixes: the email is sent before the text, so a text that keeps failing never holds it back. Test: "a text to the reply phone that keeps failing never holds back the email" (21606, retried: the email went, the job waits). Re-review 2026-10-07 of 8b.4's fixes: left `fixed`. The original defect is gone (proved: putting the text back before the email fails that test and the lost-answer test). But the reorder moves the same defect to the other side: an email that keeps failing now holds back the text, and after the last try the reply reaches neither (F-232). The comment at pass-on-reply.ts:40-41 ("a reply is never lost while one way to the business works") is true only for a failing text. Close with F-232. Closed 2026-10-07 by the independent review of feature 8b: the email is tried first and its error is caught (pass-on-reply.ts:92-115), the text is then tried on the same run, and only after both is the first failure thrown (:171); "a text to the reply phone that keeps failing never holds back the email" passes (21606, email sent, job waiting), and the suite passed 6 runs in a row.

### 8b/F-219 [P3] closed - The reply job's retry and refusal paths have no test: dropping the pass-on text's Twilio check, or rethrowing a never-retry refusal, keeps every test green

**File:** backend/lib/text/pass-on-reply.ts:37-39, :57-68 (tests: backend/routes/public-text-routes.test.ts)
**Found:** 2026-10-07 by /audit (scope: 8b.4, ad5e703..63da7b7; lenses: quality, security, performance, tests)
**Why it matters:** The ten route tests all run the job once, successfully.
None retries after the pass-on text went (so neither the `attempt > 1`
check nor its `since: message.receivedAt` is pinned, the gap F-209 and
F-213 closed for the booking texts), none has Twilio refuse the reply phone
with a never-retry code and expect the email still sent, and none has
Twilio's `to` differ from the business's number (the job's own tenant
check). Always sending, `since: new Date()`, rethrowing every
SendTextError, or deleting the `message.to` check each passes the suite (by
reading; this pass edits no source).
**Suggested fix:** Three cases: the email fails once after the text went,
and the retry checks Twilio and sends no second text (plus the same words
dated before receivedAt, sent); Twilio answers 21610 for the reply phone and
the email still goes, one try; Twilio's message names another `to`, and
nothing is passed on.
**Resolution:** Independent step review 2026-10-07: agreed, by reading all eleven cases in public-text-routes.test.ts (every one runs the job once, successfully, with Twilio's `to` equal to the business's number). Also missing: a business with no reply phone (email only), the third shape decision 2 allows; worth adding beside the three suggested. Fixed 2026-10-07 in 8b.4's review fixes: tests for the retry after a lost answer (one text, the email under its key), a reply phone refused for good with the email still sent, a text Twilio says went to another number (never passed on; proved: dropping the check fails it), and a business with only a reply email. The fake Twilio now keeps the texts it took and lists them, so the duplicate check runs against real state. Re-review 2026-10-07 of 8b.4's fixes: left `fixed`. The title's two mutations are caught now (dropping the check fails the repost test; rethrowing a never-retry refusal fails "a reply phone refused for good", which expects no job left), and so is deleting the `message.to` check. The `since` half of this finding is still unpinned, and its suggested fix named the case ("the same words dated before receivedAt, sent"). Proved in this re-review: changing pass-on-reply.ts:84 to `since: new Date(0)` keeps all 19 route tests green (file restored, `git status` clean). With that mutation, a reply whose passed-on words match any of the last 20 texts to that reply phone (Jane's "Yes" last week, or a second picture) would never be passed on as a text. Suggested: one test where an identical pass-on text already sits in the fake outbox dated well before the reply arrived, and the new reply's text is still sent. Close with that test. Fixed again 2026-10-07 after the re-review: the retry's since is pinned: "a retry counts only from its own claim: the same words passed on for an earlier reply are not this one" (an identical pass-on an hour earlier is not taken for this one); proved: since: new Date(0) fails it. Independent review of feature 8b, 2026-10-07: left `fixed`. The refusal, other-number, email-only and since cases hold. But the retry-after-a-lost-answer test (public-text-routes.test.ts:344-357) passes only because lapseClaims (:336-342) writes a 2-minute-old textTriedAt onto every unsent row, including the one the lost send had just released to null (pass-on-reply.ts:159-161). Without it the retry has no earlier claim, skips findSentText and sends a second text: the real lost-answer path is untested (F-236). Close with F-236. Closed 2026-10-07 by the independent review of feature 8b: the since half is pinned twice now: "a retry counts only from its own claim: the same words passed on for an earlier reply are not this one" catches since: new Date(0), and "a check that fails after a lost answer keeps the claim" catches a since of the latest claim or now (text dated 4 minutes ago, record 5). lapseClaims touches only held claims (public-text-routes.test.ts:336-342), so the lost-answer test runs the real path: a release on the 201 would leave textTriedAt null, the retry would skip the check and send a second text. The refusal, other-number and email-only cases stand; suite green 5 runs in a row.

### 8b/F-220 [P3] closed - The spec's passed-on reply wording is not the one built, and the built one drops the business's name

**File:** blueprint/context/current-feature.md:326, :233; backend/lib/text/render-reply-text.ts:13
**Found:** 2026-10-07 by /audit (scope: 8b.4, ad5e703..63da7b7; lenses: quality, security, performance, tests)
**Why it matters:** Data / contracts says the passed-on reply reads
`Text to {Business} from {name or number} ({number}): {words} - reply to
them directly, not to this number.`, and 8b.4 says "reply to them
directly". The code sends `Reply from {who}: {words} (answer at {number},
not here)`, which the build log reports, but the spec was never amended.
The built wording also no longer names the business, so a phone that takes
the replies of two businesses (an owner with two, or the agency's own) cannot
tell which one Jane texted. /complete archives this spec as the record.
**Suggested fix:** Amend the Wording line and 8b.4 to the built wording, and
say whether leaving out the business's name was meant; if not, put it back.
**Resolution:** Independent step review 2026-10-07: agreed, current-feature.md:326 and :233 against render-reply-text.ts:13 and the route test's expected bodies. One mitigating fact for the business-name half: the passed-on text comes from that business's own number (pass-on-reply.ts:53), so a phone holding two businesses' replies sees two senders; it still cannot tell which business without that number saved as a contact. P3 kept. Fixed 2026-10-07 in 8b.4's review fixes: the spec's Contracts give the built wording, "Reply from {name, }{number}: {words} (answer at {number}, not here)", and why the business is not named (the text comes from its own number). Closed 2026-10-07 by re-review of 8b.4's fixes: current-feature.md's Wording line gives "Reply from {name, }{number}: {words} (answer at {number}, not here)" and why the business is not named; render-reply-text.ts:23 builds exactly that, and the route tests' expected bodies match it. (The 8b.4 step text around it is garbled by the same commit; recorded separately as F-235.)

### 8b/F-221 [P3] closed - A reply longer than about 1540 characters cannot be passed on as a text, and is lost when the phone is the only destination

**File:** backend/lib/text/render-reply-text.ts:13; backend/lib/text/send-text.ts:15; backend/lib/text/pass-on-reply.ts:65-67
**Found:** 2026-10-07 by /audit (scope: 8b.4, ad5e703..63da7b7; lenses: quality, security, performance, tests)
**Why it matters:** Twilio joins an incoming text of up to 1600 characters.
The pass-on wraps it in about 60 more (more with a name), and Twilio refuses
a text over 1600 with 21617, which is never retried: the job logs "Twilio
21617 for the reply phone" and, with no reply email, "nowhere it can go".
Decision 2 requires a destination "so a reply is never lost". Rare in
practice, hence P3.
**Suggested fix:** When the wrapped text would pass 1600, send the words in
two texts (the wrapper on the first), keeping them unchanged; or record in
the spec that such a reply reaches only the email.
**Resolution:** Independent step review 2026-10-07: agreed by arithmetic on render-reply-text.ts:13. The wrapper is 60 characters with no name ("Reply from " 11, the number 12, ": " 2, " (answer at 403-555-0148, not here)" 35) and up to 182 with a 120-character name (contact-validation-schema.ts:9), so words over 1540 (1418 with the longest name) pass 1600; 21617 is in NEVER_RETRY (send-text.ts:15). P3 kept. Fixed 2026-10-07 in 8b.4's review fixes: render-reply-text.ts cuts their words with "..." only past Twilio's 1600 characters, never inside a character; the email carries every word. Test: 1000 thumbs-up emoji fit 1600. Closed 2026-10-07 by re-review of 8b.4's fixes: render-reply-text.ts:27-37 returns at most 1600 UTF-16 units (room = 1600 minus the wrapper with "..."), iterating by code point so no surrogate pair is split; run against the build, 1560 words give a 1600-character text; render-reply-text.test.ts's 1000-emoji case pins the length and the whole-emoji cut. The cut's interaction with the picture note is recorded as F-233, against F-222.

### 8b/F-222 [P3] closed - A picture sent as a reply is passed on as empty words, with nothing saying a picture came

**File:** backend/lib/text/read-twilio-message.ts:53-68; backend/lib/text/pass-on-reply.ts:51-56, :78-83; backend/routes/public-text-routes.ts:20
**Found:** 2026-10-07 by /audit (scope: 8b.4, ad5e703..63da7b7; lenses: quality, security, performance, tests)
**Why it matters:** The route accepts MMS ids (`MM...`), but the job reads
only `body`. A customer sending a photo of the room with no words (likely
for a painter) reaches the business as "Reply from Jane Doe, 403-555-0148:
(answer at 403-555-0148, not here)" and an email with an empty line; the
business cannot tell anything was sent. Twilio's Canadian local numbers take
MMS (from this reviewer's knowledge; not re-checked, no network). The spec is
silent on pictures.
**Suggested fix:** Read `num_media` too and add "(sent a picture)" or
"(sent N pictures)" to both, so the business knows to look; whether the
picture itself is passed on is a scope question for Frank, only a note for
later.
**Resolution:** Independent step review 2026-10-07: agreed by reading read-twilio-message.ts:53-68 (only `body` is read) and public-text-routes.ts:20 (MM ids are taken). That Twilio's Canadian local numbers take MMS is from this reviewer's knowledge, not re-checked (no network). P3 kept. Fixed 2026-10-07 in 8b.4's review fixes: read-twilio-message.ts reads num_media; the text says "[picture not shown]" and the email "They also sent a picture, which is not passed on." Tests in render-reply-text.test.ts and the route tests. Passing the picture itself on stays out of scope. Re-review 2026-10-07 of 8b.4's fixes: left `fixed`. A short or empty reply with a picture now says so in both (proved: removing the note fails the render test and the route test, file restored). But the note goes on after the words and the 1600 cut runs after that, so a long reply with a picture loses the note in the text. Run against the build, 1560 words plus a picture give a 1600-character text with no "picture" in it (F-233). Close with F-233. Fixed again 2026-10-07 after the re-review: see F-233: the picture note survives a cut. Closed 2026-10-07 by the independent review of feature 8b: read-twilio-message.ts reads num_media into hasPicture; render-reply-text.ts adds "[picture not shown]" and keeps it through the 1600 cut (the room is measured with the note in, :30-37); the email says "They also sent a picture"; the render tests and the route test "a picture is said, not passed on" pin both.

### 8b/F-223 [P3] closed - A post refused for its signature leaves no log line, so a webhook address one character off loses every reply unseen

**File:** backend/routes/public-text-routes.ts:34-44; backend/lib/auth/auth-server.ts:47-49
**Found:** 2026-10-07 by /audit (scope: 8b.4, ad5e703..63da7b7; lenses: quality, security, performance, tests)
**Why it matters:** The signature covers the exact address Twilio was given.
If the number's webhook differs from `${BETTER_AUTH_URL}/texts/incoming`
at all (Railway's own domain against a custom one, a trailing slash, a
query), every reply is refused 403 and the API logs nothing; only Twilio's
console shows the 11200 errors. Failing closed is right; failing silently is
what makes it a deploy trap. apiOrigin's comment still lists only Better Auth
and Google as users of the address.
**Suggested fix:** One log line on a refusal, with no field values (for
example "[text] a post to /texts/incoming refused: no valid signature"),
and in the spec's deploy notes that the webhook must be exactly
BETTER_AUTH_URL plus /texts/incoming. Add Twilio's signature to apiOrigin's
comment.
**Resolution:** Independent step review 2026-10-07: agreed by reading public-text-routes.ts:34-44, where the 403 returns with no log line. P3 kept. Related but separate: F-226, a malformed message id logged under the unknown-number reason. Fixed 2026-10-07 in 8b.4's review fixes: a refused post is logged with the address it was checked against (no secret, no number); apiOrigin's comment names Twilio's signing; the spec's deploy notes say the webhook must be exactly ${BETTER_AUTH_URL}/texts/incoming. Test: "a refused post is logged with the address it was checked against". Closed 2026-10-07 by re-review of 8b.4's fixes: public-text-routes.ts:36 warns with the address only (apiOrigin, not a secret; no field value, no number, no signature), before the 403; auth-server.ts:47-48 names Twilio's signing; the spec's deploy notes say the webhook must be exactly `${BETTER_AUTH_URL}/texts/incoming`; the route test checks the line.

### 8b/F-224 [P2] closed - The refused-signature test names its three businesses from 1000 random numbers, so two can share a slug and the suite fails about one run in 330

**File:** backend/routes/public-text-routes.test.ts:219
**Found:** 2026-10-07 by independent step review (scope: 8b.4, ad5e703..63da7b7; lenses: quality, security, performance, tests)
**Why it matters:** The `test.each` makes each case's business with
``makeBusiness(`refused-${randomInt(1000)}`)``, and the slug
(`test-textreply-refused-N-<tag>-dev`) is unique. Three draws from 1000 share
a number with probability 1 - (999/1000)(998/1000), about 0.3%. It happened in
this review: run 2 of 7 failed "a post with a signature for another address is
refused and saves nothing" with `duplicate key value violates unique
constraint "organization_slug_unique"` on `test-textreply-refused-774-...`;
runs 1 and 3 to 7 passed. The step's Done when and this project's rule of
running the suite several times in a row exist because 8a's flakes only showed
over 7 to 10 runs; a known random failure erodes that signal.
**Suggested fix:** Name each case's business by something unique: the case's
own label, or `refused-${randomUUID().slice(0, 8)}`.
**Resolution:** Fixed 2026-10-07 in 8b.4's review fixes: the refused-signature cases name their businesses with randomUUID().slice(0, 8), so two never share a slug. Closed 2026-10-07 by re-review of 8b.4's fixes: public-text-routes.test.ts:252 uses randomUUID().slice(0, 8) (32 bits per case); the backend suite passed 10 runs in a row in this re-review.

### 8b/F-225 [P3] closed - A sender whose name has no Latin letters is passed on as "Reply from , 403-555-0148"

**File:** backend/lib/text/render-reply-text.ts:12
**Found:** 2026-10-07 by independent step review (scope: 8b.4, ad5e703..63da7b7; lenses: quality, security, performance, tests)
**Why it matters:** The name goes through `plainText`, which drops every
character outside printable ASCII that has no plain spelling. Run against the
built file: `renderReplyText("李明", "+14035550148", "hi")` and
`renderReplyText("Ольга", ...)` both give `"Reply from , 403-555-0148: hi
(answer at 403-555-0148, not here)"`. The `senderName ?` test runs before the
name is made plain, so an empty result still takes the named branch. A
Chinese, Russian, Arabic or Greek name is ordinary for a Canadian business's
customers. The reply email keeps the name as typed, so only the text is hit.
**Suggested fix:** Make the name plain first and treat an empty result as no
name (number only); a test with a name that has no Latin letters.
**Resolution:** Fixed 2026-10-07 in 8b.4's review fixes: a name that plainText empties ("李明", "Ольга") is shown by number. Test in render-reply-text.test.ts. Closed 2026-10-07 by re-review of 8b.4's fixes: render-reply-text.ts:20-21 makes the name plain and trimmed before choosing the named form, so an empty or blank result shows the number alone; the test.each over both names expects "Reply from 403-555-0148: Hello ...".

### 8b/F-226 [P3] closed - A post whose message id does not match the pattern is dropped under the unknown-number log line, and the pattern refuses capital hex digits

**File:** backend/routes/public-text-routes.ts:20, :50-51
**Found:** 2026-10-07 by independent step review (scope: 8b.4, ad5e703..63da7b7; lenses: quality, security, performance, tests)
**Why it matters:** One condition covers two reasons, and the log line names
only one: a signed post to a business's real number whose `MessageSid` fails
`/^(SM|MM)[0-9a-f]{32}$/` logs "a reply to a number no business texts from,
dropped", which sends whoever reads the log to the wrong place. Twilio's
published API schema, as this reviewer remembers it (not re-checked, no
network), gives message ids as `^(SM|MM)[0-9a-fA-F]{32}$`; ids seen in practice
are lower case, so this is a guard against a change rather than a live loss.
**Suggested fix:** Accept `[0-9a-fA-F]`, and log a malformed id as its own
reason (no field values).
**Resolution:** Fixed 2026-10-07 in 8b.4's review fixes: a malformed message id has its own log line, and the id pattern takes capital hex digits too. Closed 2026-10-07 by re-review of 8b.4's fixes: public-text-routes.ts:17 is `/^(SM|MM)[0-9a-fA-F]{32}$/`; :42-45 drops a malformed id under its own line (no field value) before the business is looked up; :47-49 logs the unknown number with the now-validated id only, so nothing a caller typed reaches the log unchecked.

### 8b/F-227 [P3] closed - pass-on-reply.ts opens with an eight-line block narrating the code below it, with a finding number in it

**File:** backend/lib/text/pass-on-reply.ts:1-8; backend/routes/public-text-routes.ts:1-5
**Found:** 2026-10-07 by independent step review (scope: 8b.4, ad5e703..63da7b7; lenses: quality, security, performance, tests)
**Why it matters:** coding-standards.md:326-331 asks for the explanation
beside the line it explains, not "a long block at the top of a file or
function that explains lines far below it", and :358-359 says "No history in
code comments (step numbers, finding numbers, ...)". The header of
pass-on-reply.ts describes the reply-phone guard (:40), the texting-number
guard (:48), the log rule and the retry rule (:57, :87) at the top, and line 5
carries "(F-199)", the only finding number in non-migration code
(`git grep -n "(F-[0-9]"` over backend, packages and frontend). The route's
header likewise narrates the signature check, the empty reply and the job key
that sit at :34-56. Frank's reviews target exactly this.
**Suggested fix:** Keep two lines at the top of each file on why it exists;
move each rule to the line it guards; drop "(F-199)".
**Resolution:** Fixed 2026-10-07 in 8b.4's review fixes: pass-on-reply.ts and public-text-routes.ts open with two lines each; every reason sits beside its line, and no finding number is in a comment. Closed 2026-10-07 by re-review of 8b.4's fixes: pass-on-reply.ts:1-3 and public-text-routes.ts:1-2 say only what the file is for; the reply-phone, texting-number, email-first and check-every-run reasons sit at :30, :33, :40, :67 and :83, the job key's at the route's :52; `git grep -n "(F-[0-9]"` over backend, packages and frontend (migrations aside) finds nothing.

### 8b/F-228 [P3] closed - Two different shapes are both called TwilioMessageType in backend/lib/text

**File:** backend/lib/text/read-twilio-message.ts:9; backend/lib/text/find-sent-text.ts:16
**Found:** 2026-10-07 by independent step review (scope: 8b.4, ad5e703..63da7b7; lenses: quality, security, performance, tests)
**Why it matters:** find-sent-text.ts keeps a private `TwilioMessageType`
for Twilio's raw list item (`sid`, `body`, `direction`, `status`,
`date_created`); 8b.4 exports another `TwilioMessageType` from
read-twilio-message.ts for the parsed reply (`from`, `to`, `body`,
`receivedAt`). Same name, same folder, different fields: an editor's
auto-import or a reader searching the name lands on the wrong one. The
naming rule is no vague names.
**Suggested fix:** Name them for what they hold, for example
`ReceivedTextType` for the exported one and `TwilioListedMessageType` for the
private one.
**Resolution:** Fixed 2026-10-07 in 8b.4's review fixes: read-twilio-message.ts exports IncomingTextType; find-sent-text.ts keeps TwilioListedTextType. Closed 2026-10-07 by re-review of 8b.4's fixes: `TwilioMessageType` no longer appears in backend; the two shapes are IncomingTextType (read-twilio-message.ts:9) and the private TwilioListedTextType (find-sent-text.ts:16); the backend build passes.

### 8b/F-230 [P2] closed - Three email-job tests assume the order of emails saved in one transaction, which the runner does not keep: the backend suite failed 3 of about 30 runs

**File:** backend/lib/jobs/booking-email-job.test.ts:200, :260, :279
**Found:** 2026-10-07 while verifying 8b.4's review fixes (scope: current; lens: tests)
**Why it matters:** graphile-worker picks due jobs by priority and run_at only (node_modules/graphile-worker/dist/sql/getJobs.js:179), with no tie-break; jobs added in one transaction share run_at, so a move's two emails can run in either order. The tests listed the Resend keys in saved order. Captured failure: ["booking-moved-notification/<id>/2", "booking-moved/<id>/2"] against the reverse. Latent since 8a; feature 8b's extra text jobs per booking made it show (2 of 7 runs, then 1 of 12). Nothing changes for customers: 8a decided emails need no order.
**Suggested fix:** compare which emails were asked for, not their order.
**Resolution:** Fixed 2026-10-07: sentKeys() and keysOf() compare the keys sorted, with a comment saying why. The backend suite then passed 10 runs in a row (732 tests). Re-review 2026-10-07 of 8b.4's fixes: left `fixed`. The three assertions named are order-free now (booking-email-job.test.ts:205, :267, :288), and the suite passed 10 runs in a row here too. But a fourth assertion in the same file makes the same assumption: "no email is sent after the appointment has started" expects the confirmation's warn line before the notification's (:315-318), and those two jobs are saved in one transaction too (F-234). Close with F-234. Fixed again 2026-10-07 after the re-review: see F-234: the fourth order-dependent assertion is order-free too. Closed 2026-10-07 by the independent review of feature 8b: every multi-email assertion in booking-email-job.test.ts compares sorted keys (sentKeys/keysOf) or sorted lines; the remaining ordered assertions (jobsOf, ordered by job id; :231, two keys of one job) do not depend on run order. The backend suite passed 6 runs in a row (737 tests each).

### 8b/F-231 [P3] closed - The Twilio check before every pass-on text matches by words, not by reply: identical replies close together pass on as one text, and two runs of one reply at once both send

**File:** backend/lib/text/pass-on-reply.ts:72-85; backend/lib/text/find-sent-text.ts:70-77; backend/lib/jobs/start-job-runner.ts:10
**Found:** 2026-10-07 by re-review of 8b.4's fixes (scope: 63da7b7..18c1f81, with ad5e703..18c1f81 as context; lenses: quality, security, performance, tests)
**Why it matters:** F-217's repair runs findSentText before the first send
too. The check looks for any outbound text from the business's number to
its reply phone with the same body, dated after this reply's receivedAt minus
10 seconds. Two different replies with the same words get the same body. Jane
sends three photos as three MMS a few seconds apart, each with no words (common
from a phone). Each becomes "Reply from Jane Doe, 403-555-0148: [picture not
shown] (answer ...)". The second and third jobs find the first one's text and
send nothing, so a phone-only business hears of one picture, not three. The
same goes for "Yes" sent twice. The email still carries each (its key is the
message id). The check is also not a lock. The runner works 5 jobs at once,
and a repost while the first job runs gives the key to a fresh job that is due
at once (graphile-worker sql/000020.sql:120-131). Both runs then ask Twilio
before either has sent, and both send. A replayed signed post (F-217's note)
reaches the same path. Only the count or a duplicate is at stake, never the
words, hence P3.
**Suggested fix:** Either record each pass-on in the database keyed by
the message id, claimed before sending (insert ... on conflict do nothing),
and keep the Twilio check for a retry after a lost answer only. Or keep the
current check, say in pass-on-reply.ts:83 and the spec that identical replies
within seconds pass on as one text, and ask Frank whether that is acceptable.
**Resolution:** Independent review of feature 8b, 2026-10-07: left `fixed`. Both halves of the original defect are gone: the Twilio check runs only after an earlier claim and counts from it, so identical replies pass on separately ("two replies in the same words are both passed on", and the since test), and the claim under a row lock keeps two runs from sending together. But the claim's release (pass-on-reply.ts:157-161) also fires for a send Twilio took with its answer lost, and for a failed Twilio check, so the very retry this finding's suggested fix kept the check for sends again unchecked (F-236). Close with F-236. Closed 2026-10-07 by the independent review of feature 8b: identical replies pass on separately on the normal path, because the Twilio check runs only after an earlier claim (pass-on-reply.ts:147-149) ("two replies in the same words are both passed on"); two runs at once are kept apart by the claim under a row lock (:35-58); and the lost-answer retry the suggested fix kept the check for now keeps its claim and is checked (F-236's repair). The one narrow residue, a lost answer with an identical reply passed on before the retry, is recorded as F-239 (wording only).

### 8b/F-232 [P3] closed - An email that keeps failing now holds back the reply text, and after the last try the reply reaches neither

**File:** backend/lib/text/pass-on-reply.ts:40-64, :66; backend/lib/email/send-email.ts:68-75
**Found:** 2026-10-07 by re-review of 8b.4's fixes (scope: 63da7b7..18c1f81; lenses: quality, security, performance, tests)
**Why it matters:** F-218's repair moved the email first. sendEmail throws a
SendEmailError for every Resend error (send-email.ts:68-75), including ones a
retry cannot fix: a revoked key, a sending domain no longer verified, a
refused address. It has no never-retry set, unlike sendText. Nothing at
pass-on-reply.ts:54 catches it, so the text block at :66 is never reached.
After 10 tries the reply has reached neither destination, while the reply
phone worked all along. Before the repair a failing email could not block the
text, which went first. This is F-218's defect on the other side, and the
comment at :40-41 claims the opposite. No test has the email fail with a
reply phone set.
**Suggested fix:** Try both on every run: catch the email's error, do the
text, then rethrow the email's error, or the text's if only it failed. Both
are already safe to repeat (the email's key, the Twilio check). Add a test
where Resend keeps refusing and the text still goes on the first try.
**Resolution:** Closed 2026-10-07 by the independent review of feature 8b: the email's error is caught (pass-on-reply.ts:113-115), the text is still tried on the same run, and the email's error is thrown after (:171); a later run skips the text once textSentAt is set (:124). "an email that keeps failing never holds back the text" passes.

### 8b/F-233 [P3] closed - A long reply with a picture loses "[picture not shown]" when the text is cut to 1600

**File:** backend/lib/text/render-reply-text.ts:26-37
**Found:** 2026-10-07 by re-review of 8b.4's fixes (scope: 63da7b7..18c1f81; lenses: quality, security, performance, tests)
**Why it matters:** The note is added after the words (:26), and the cut
then trims from the end (:31-37), so the note goes first. Run against the
build, `renderReplyText({ senderName: "Jane Doe", number: "+14035550148",
words: "a".repeat(1560), hasPicture: true })` gives 1600 characters that end
"aaa... (answer at 403-555-0148, not here)", with no word of the picture. The
email says it, so only a phone-only business misses it. Rare, hence P3.
**Suggested fix:** Cut the words alone, with room left for the note, then
add the note. One render test with long words and a picture.
**Resolution:** Closed 2026-10-07 by the independent review of feature 8b: render-reply-text.ts:30-37 measures the room with the note in (withNote("...")) and adds the note after the cut words; "a long reply with a picture keeps the picture note when its words are cut" pins it with 1560 words.

### 8b/F-234 [P2] closed - "no email is sent after the appointment has started" still assumes the order of two emails saved in one transaction

**File:** backend/lib/jobs/booking-email-job.test.ts:315-318
**Found:** 2026-10-07 by re-review of 8b.4's fixes (scope: 63da7b7..18c1f81; lens: tests)
**Why it matters:** This is F-230's flake in an assertion its repair missed.
The test expects the warn lines in saved order: booking_confirmation's, then
booking_notification's. book() saves both jobs in one transaction, so they
share run_at, and graphile-worker 0.18.0 picks due jobs ordered only by
priority and run_at (node_modules/graphile-worker/dist/sql/getJobs.js:179).
The two can run in either order. It passed 10 runs in a row here, as did the
other three for about 30 runs before they failed. The mechanism is the
captured one from F-230.
**Suggested fix:** Compare the lines sorted, as sentKeys() does, or use
`expect.arrayContaining` plus a length check.
**Resolution:** Closed 2026-10-07 by the independent review of feature 8b: "no email is sent after the appointment has started" sorts both the warn lines and the expected lines (booking-email-job.test.ts:311-320); the suite passed 6 runs in a row.

### 8b/F-235 [P3] closed - The 8b.4 step text in the spec is garbled by the fix: "the reply email" twice, and the email clause reads as "never from the reply phone itself"

**File:** blueprint/context/current-feature.md:232-240
**Found:** 2026-10-07 by re-review of 8b.4's fixes (scope: 63da7b7..18c1f81; lens: quality)
**Why it matters:** The amended sentence reads "passes the text on to the
reply email first (...) and/or the reply phone (...), checked with Twilio
before every send (F-217), the reply email (through the business's own
Resend, as feature 6 sends), never from the reply phone itself". The email
appears twice, and the old phone clause is now attached to it. /complete
archives this spec as the record of what was built.
**Suggested fix:** One clause per destination: the email first, through the
business's own Resend; then the text, from the business's number, checked
with Twilio first, never for a text from the reply phone itself, and never
to any business's texting number. Bring it in line with F-232's fix when
that lands.
**Resolution:** Closed 2026-10-07 by the independent review of feature 8b: current-feature.md's 8b.4 text has one clause per destination (the email through the business's own Resend, the text from the business's number), says both are tried every run, and keeps the reply-phone and texting-number rules as their own sentence.

### 8b/F-236 [P2] closed - A pass-on text whose send was taken with its answer lost lets its claim go, so the retry sends it again unchecked

**File:** backend/lib/text/pass-on-reply.ts:157-161; backend/lib/text/send-text.ts:89-94; backend/lib/text/find-sent-text.ts:47-55, :62-67; backend/routes/public-text-routes.test.ts:336-357
**Found:** 2026-10-07 by the independent review of feature 8b (scope: current, 3b47c1c..5fc8ab0; lenses: quality, security, performance, tests)
**Why it matters:** The spec's 8b.4 says "only a run that follows a lost
answer asks Twilio first, counting from that claim". The catch at
pass-on-reply.ts:159-161 lets the claim go (textTriedAt = null) for every
SendTextError whose status is not null, on the comment's belief that such an
error is a refusal. Two such errors are not: sendText's "unreadable_answer"
carries Twilio's success status (send-text.ts:89-94, 201: Twilio took the
text), and findSentText's refusal or unreadable list (find-sent-text.ts:47-55,
:62-67) means the earlier send's fate is still unknown. In both cases the next
run reads triedAt null, gets `earlier: null` (:56), skips findSentText
(:145-147) and sends the reply to the business's phone a second time. The
second path is the likelier: a send that timed out (claim kept), then a
check a minute later that Twilio answers 5xx or 429 during the same incident.
The test meant to prove the lost-answer case, "a retry after the pass-on's
answer was lost sends nothing again" (public-text-routes.test.ts:344-357),
uses exactly the 201-with-HTML answer, but its lapseClaims (:336-342) sets
textTriedAt on every unsent row, writing a claim onto the one the catch had
just cleared; the real path is never run. Found by reading; no file outside
the ledger and the receipt was changed to prove it. Only a duplicate of a
notification to the business's own phone is at stake, never a customer text
or the words, hence P2, not P1; but it is the one case the claim's earlier
time exists for, and its test gives false assurance.
**Suggested fix:** Let the claim go only when sendText itself was refused
(a SendTextError from the send, status 400 or more), never for
"unreadable_answer" and never for an error from findSentText. In the test,
lapse only claims that are held (`and "textTriedAt" is not null`), which
fails against the current code, and add the check-fails-after-a-timeout case.
**Resolution:** Fixed 2026-10-07 after the final review: the claim is let go only when sendText itself was refused (status 400 or more); an unreadable answer (201) or a failed check keeps it. lapseClaims touches only held claims. Tests: "a retry after the pass-on's answer was lost sends nothing again" and "a check that fails after a lost answer keeps the claim: the next run still finds the text and sends nothing"; proved: letting go on any status fails both. Closed 2026-10-07 by the independent review of feature 8b: pass-on-reply.ts:165-172 lets the claim go only when `sending` and the SendTextError carries status 400 or more, so an unreadable 201 answer, a timeout or a failed findSentText keep it; both tests named in the repair pass and fail against the old release (by reading: the old rule nulls textTriedAt on the 201, lapseClaims no longer re-sets it, the retry skips the check and sends twice). Release on a 5xx send is a separate, unverified lead (F-238).

### 8b/F-237 [P2] closed - A retry's check counted from the latest claim, so a check that failed once let the next run miss the text the first run sent

**File:** backend/lib/text/pass-on-reply.ts (the check before a resend)
**Found:** 2026-10-07 by the builder while fixing F-236 (scope: current; lens: quality)
**Why it matters:** each run re-claims the text with now(), and the check used the previous claim's time. Run 1 sends (answer lost) at T1; run 2 claims at T2 and its check fails (503); run 3 checks since T2, after the text Twilio took at T1, finds nothing and sends it again.
**Suggested fix:** count from when the reply was recorded, before any try.
**Resolution:** Fixed 2026-10-07: the check counts from text_reply.createdAt; claimText returns only whether an earlier try exists. Test: the check-fails case records the reply five minutes ago and its text four minutes ago; proved: since: new Date() fails it. Closed 2026-10-07 by the independent review of feature 8b: the check passes since: record.createdAt (pass-on-reply.ts:148), the reply's own row made before any try, and claimText returns only triedBefore (:56); "a check that fails after a lost answer keeps the claim" dates the record 5 minutes back and the text 4, so a since of the latest claim (2 minutes back after lapseClaims) or of now would send a second text and fail it.

## Independent review

**Status:** passed
**Target commit:** 43d308e7245e1e41c1d63d4f2a69b8409465ec42
**Base commit:** 3b47c1cfa2a6949d90ebd1a8b8fceca0a0949db6
**Base ref:** main
**Spec hash:** ae6338f1b68147f8ce4f21bf0993ad263632c6b00690d155a244ccaf042f6288
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** runtime default (exact model not known until reviewer starts)
**Requested execution:** automatic
**Requested at:** 2026-10-07T22:36:58.929Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-07T22:42:20.000Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `3b47c1cfa2a6949d90ebd1a8b8fceca0a0949db6..43d308e7245e1e41c1d63d4f2a69b8409465ec42` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

The untracked `blueprint/ai-voice-proposal.md` is the owner's own file, never committed and
outside this work item; it is not part of the target and does not make the review stale.
The previous receipt (target 5fc8ab0, passed) went stale with the F-236 and F-237 fix; this
request covers the whole feature again.

## Commands

- `npm run test --workspace=backend` (5 runs in a row, local Postgres migrated and seeded): pass, 69 files, 738 tests each run
- `npm run test --workspace=@scheduleads-app/shared`: pass, 19 files, 142 tests
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass (the route reaches `AppType`)
- `npm run format:check`: pass

## Evidence

- Request confirmed: HEAD 43d308e equals Target commit; `git merge-base main HEAD` is 3b47c1c; sha256 of the working-copy current-feature.md is ae6338f1...6288; only review.md (and later findings.md) differ from the target, plus the owner's untracked ai-voice-proposal.md named in the Handoff.
- Whole delta 3b47c1c..43d308e (73 files, 15 commits) read fresh against the spec, AGENTS.md and coding-standards.md: the Twilio door (send-text, find-sent-text, read-twilio-message, the error sorting), the settings table, schema and migration 0019, the confirmation and reminder jobs (enqueue-booking-texts, send-booking-text, the move and cancel paths), the packed booking link, the incoming route and its signature check, the pass-on job with text_reply and migration 0020, and their tests.
- F-236 repair holds: pass-on-reply.ts:165-172 lets the claim go only for a send that Twilio answered with status 400 or more. An unreadable 201, a timeout or a failed check keep the claim. lapseClaims now touches only held claims, so "a retry after the pass-on's answer was lost sends nothing again" goes through the real path.
- F-237 repair holds: the check counts from the reply's own record (pass-on-reply.ts:148). "a check that fails after a lost answer keeps the claim" dates the record 5 minutes back and the text 4, which rules out counting from the latest claim or from now.
- Security: the route parses at most 64 KB, then refuses with 403 any post without a valid HMAC-SHA1 over `${BETTER_AUTH_URL}/texts/incoming` (constant-time compare). The job reads the words back from Twilio and checks `to` against the business's number. Logs and SendTextError carry ids and codes only, never a number or the words. The email body is escaped by React. The packed link keeps a 128-bit HMAC and accepts only one spelling.
- Tests: no `.only`, `.skip` or `.todo` in the delta's tests. Twilio and Resend are faked, and outside fetch is blocked.

## Findings

- New: F-238 [P3] unverified (a 5xx on the pass-on send lets the claim go, so the retry sends unchecked if Twilio took it anyway); F-239 [P3] open (the spec, the text_reply table comment and one test name overstate what the lost-answer check promises).
- Closed by this review: F-217, F-219, F-231, F-236, F-237.
- Left as found: F-146 and F-161 stay `fixed` (outside this delta's files); no P0 or P1 finding is open or fixed.

## Remaining risk

- No live Twilio: real sends, the list endpoint's paging and timing, and Twilio's webhook signing against the deployed address are checked only against fakes and Twilio's documented example, until the deploy hand check on Frank's yes.
- F-238 depends on whether Twilio can create a message and still answer 5xx, which is not verified.
- findSentText reads only the newest 20 texts from the business's number to the reply phone. A business getting more than 20 replies passed on between a lost answer and its retry could get a duplicate (not observed, untested).
- F-229 (no cap on replies passed on as texts) stays a cost question for later.
- Check was not required and was not run. No browser tests command exists.
