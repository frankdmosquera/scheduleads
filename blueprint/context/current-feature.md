# Feature: The customer's texts

**From build-plan:** feature 8b

**Branch:** feature/08b-the-customer-s-texts

**Status:** 8b.1 built 2026-10-07 (whole feature seen and 8b.1's plan approved
by Frank the same day); its audit and independent review next.

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
   still cancel or move. Cost: the link is about 110 characters, so each text
   is two billed parts instead of one. Rejected: only the business's phone
   number, which leaves a phone-only customer having to call.
4. **The wording is fixed, under the business's name**, like the emails:
   business name first, the product never named, plain ASCII so a text is
   never re-encoded into the pricier character set by a curly apostrophe.
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
   the appointment has started. Twilio refusals that retrying cannot change
   (a number that cannot take texts, a customer who texted STOP, a landline)
   are logged and not retried.
8. **A retry never sends a text twice.** Twilio takes no idempotency key, so
   a send whose answer was lost may have gone. Before a retry sends, it asks
   Twilio for a text with the same body from the business's number to Jane's
   in the last day; if one is there, that one is recorded and nothing is sent.
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

- [ ] **8b.2 The confirmation text.** A `booking_text` job, added with the
  booking's emails in `book-time.ts`, owner-made bookings included like the
  confirmation email. It reads the booking afresh: not confirmed, moved
  already, appointment started, no settings, confirmation off, no textable
  phone: logged and nothing sent. Otherwise it renders the text (decision 4)
  with the booking page link, sends it, and records `sms_sent` (booking, kind,
  Twilio's id; never a number or the words). On a retry, decision 8 first.
  **Done when:** booking through the public route with Summit's settings
  sends one fake Twilio request with the business's number, Jane's `+1`
  number and the link, and one `sms_sent` entry; each skip case sends nothing;
  a failure is retried; a retry after a send whose answer was lost sends
  nothing; the backend suite passes several runs in a row.

- [ ] **8b.3 The reminders.** One `booking_text` reminder job per reminder in
  the business's settings, run at the appointment minus its minutes, added
  in `book-time.ts` and again in `move-booking.ts` with the move's number;
  none added for a time already past. It skips itself when the booking was
  cancelled, a later move replaced it, the business no longer has that
  reminder, or the appointment has started (decision 6).
  **Done when:** with the job clock pinned, a booking gets its reminders at
  the right instants in the business's time zone; after a move only the new
  ones send, at the new times; after a cancel none send; a reminder removed
  from the settings does not send; a booking made 30 minutes ahead gets no
  1200-minute reminder; a reminder still failing when the appointment starts
  is never sent; every case on the build log's Simulate page (cases a to f)
  is a saved test under the same name; the suite passes several runs in a row.

- [ ] **8b.4 Jane's replies.** `POST /texts/incoming`, public, answering only
  a request carrying Twilio's valid signature for the API's own address
  (403 otherwise), finding the business by the number texted (an unknown
  number is answered and dropped, logged without the sender), then adding a
  `text_reply` job keyed by Twilio's message id (so Twilio posting the same
  text twice adds one job; `enqueueJob` gains a `jobKey` option) and
  answering Twilio an empty reply at once. The job
  passes the text on to the reply phone (a text from the business's number:
  who sent it, their number, the words, "reply to them directly") and/or the
  reply email (through the business's own Resend, as feature 6 sends), never
  from the reply phone itself (decision 9). The sender is named when their
  number matches a contact of that business.
  **Done when:** route tests with signatures made from a test auth token: a
  valid one is accepted and passed on to each destination the settings name;
  a missing or wrong signature is refused 403 and adds no job; an unknown
  number adds no job; a text from the reply phone is not passed on; the
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
  `text-settings-rules.test.ts`,
  `find-text-settings.ts`, `booking-texts.ts` (the wording),
  `verify-twilio-signature.ts`, `pass-on-reply.ts`, with tests.
- `backend/lib/jobs/`: `booking-text-job.ts`, `enqueue-booking-texts.ts`,
  `text-reply-job.ts`; `job-names.ts` and `job-tasks.ts` gain both names.
- `backend/lib/booking/book-time.ts`, `move-booking.ts`: add the text jobs in
  the same transaction. `cancel-booking.ts` unchanged (decision 6).
- `backend/routes/public-text-routes.ts` mounted in `backend/app.ts`.
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

**Wording** (ASCII, the link in full):
- Confirmation: `{Business}: you're booked for {service}, {when}. To change or cancel: {link}`
- Reminder: `{Business}: a reminder of your {service}, {when}. To change or cancel: {link}`
- Passed-on reply: `Text to {Business} from {name or number} ({number}): {words} - reply to them directly, not to this number.`

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
  retry include 21211, 21408, 21610, 21612 and 21614; check the current list
  against Twilio's error reference when building 8b.1.
- The signature is HMAC-SHA1 of the full URL plus the POST params sorted by
  name and concatenated, base64, compared in constant time. Behind Railway
  the URL is the public one; build it from the API's own origin, never the
  `Host` header.
- Canada: Twilio prices checked 2026-10-07: $0.0083 per part sent plus a
  carrier fee of about $0.007 to $0.009, $0.0083 per part received plus a
  carrier fee, a local number $1.15 a month (USD). A confirmation with the
  link is about two parts.
- CASL: these are messages about a booking Jane asked for. Twilio's own STOP
  handling stays on.
- Owner-made bookings get the texts, as they get the confirmation email.
- Deploy notes carried from 8a: F-176 (`RAILWAY_DEPLOYMENT_DRAINING_SECONDS=30`)
  and F-179, remind Frank at the deploy that ships 8a and 8b. At that deploy
  also: the Twilio keys on Railway, a number bought per business, and each
  number's incoming-message webhook pointed at `/texts/incoming`.
