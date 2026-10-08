# Feature: The worker's text

**From build-plan:** feature 8c

**Branch:** feature/08c-the-worker-s-text

## Goal

Pedro paints for Summit. He has no Google calendar connected and no email of
his own at the business, so today nothing tells him that Jane booked an
estimate with him for Tuesday at 7:30. With this feature he gets a text from
the business's own number: what landed on his day, when, who and where. And
because a day changes, he also hears when that booking moves or comes off
his day, so he never drives to an empty house.

This is the last resort feature 6 promised (decision 8: one email per
business now; decision 11: the booked worker is told by text with feature 8).
It reuses 8b's text door, settings and job rules; nothing new reaches Twilio.

Everything is the business's own setting (plan decision 30, `AGENTS.md` "The
client decides everything"): which people get texts, on which phone, and for
which of the three changes. Nothing is on by default; a person with no
settings gets no texts.

## In scope

- Each person's worker-text settings in their own table: their phone and
  three switches (added to their day, moved, taken off their day), set at
  client setup until Settings (feature 12).
- The text when a booking lands on a person's day: a new booking, from the
  form or made by the owner, and a move onto them from another person.
- The text when their booking moves to another time, staying theirs.
- The text when a booking comes off their day: cancelled, or moved to
  another person.
- Each one a job on the 8a runner, doing what is still true when it runs,
  retried like 8b's texts and never sent twice.
- Each worker text that went recorded on the contact's timeline (`sms_sent`).

## Out of scope

- The Settings screen for these switches (feature 12); values are set at
  client setup. Step 8c.1 adds them to item 12's text settings line.
- A person's own work email and its booking notification (feature 12,
  feature 6 decision 8).
- Naming the worker when they reply to the business's number: their reply is
  passed on like any reply (8b decision 9), showing their number, not their
  name. Only a note for later, feature 12 can teach `findReplySenderName`
  people's phones.
- The customer's phone in the worker's text, and the worker messaging the
  customer: relayed worker messages are the idea parked for feature 19.
- Reminders to the worker before the appointment: only a note for later, one
  more switch beside these three if a client wants it.
- Delivery receipts and a screen of failed texts (feature 11 can show them).
- Buying numbers and putting keys on Railway: nothing new here, 8b's deploy
  notes cover it.

### Decisions made in the spec

1. **Per person, nothing on by default** (plan decision 30). A
   `worker_text_settings` row per person holds their phone and three
   switches. No row, no texts. "When a business runs on one email" is the
   reason the text exists, not a condition the code checks: the business
   turns a person's texts on, and when feature 12 adds work emails it picks
   email, text or both for each person. Rejected: one switch for the whole
   business (Pedro without Google wants texts, Maria with Google wants none);
   texting only people without a Google connection, which fixes a rule for
   every business.
2. **The worker hears about every change to their day, not only a new
   booking** (the one place the critique widened the plan's line). The build
   plan says "a text with the booking", and feature 8 says the text "keeps
   them in the loop". A worker told about Tuesday 7:30 and never told it
   moved to Wednesday, or to Maria, or was cancelled, drives to an empty
   house: the customer's emails tell Jane and the business inbox, never him.
   So three texts, each its own switch: **added** (a new booking, or a move
   onto them from another person), **moved** (their booking, a new time),
   **taken off** (cancelled, or moved to another person). Rejected: the
   new-booking text only, which leaves the worker with a wrong day after any
   change.
3. **Any booking, the owner's too.** A booking the owner makes sends the
   business no notification (feature 6 decision 10: the owner already
   knows), but the worker did not make it, so their text goes the same as
   for a booking from the form.
4. **The text says what a worker needs to show up, in one piece, and never
   the customer's phone or link.** The business's name, what happened, the
   time in the business's zone, the customer's name, the service, the room
   when there is one, and the address:
   - added: `Summit Painting: new booking Tue Oct 13, 7:30am. Jane Doe,
     Interior estimate, 1234 Long St NW Calgary`
   - moved: `Summit Painting: moved to Wed Oct 14, 9:00am. Jane Doe, Interior
     estimate, 1234 Long St NW Calgary`
   - taken off: `Summit Painting: off your day, Tue Oct 13, 7:30am. Jane Doe,
     Interior estimate`
   One billed piece, like 8b (decision 4: at most 160, the eight
   double-cost characters counted as two, plain ASCII through `plainText`).
   Too long, it is cut in this order: the business name loses words from its
   end (`fitBusinessName`), then the address from its end, then the service;
   the time and the customer's name are never cut. The customer's phone is
   left out on purpose (Frank, 2026-10-03: a worker never sees the customer's
   number; messages go through the business). The booking page link is left
   out too: it is Jane's private link, and it cancels. The customer's name,
   service, room and address are typed by people, so they go through
   `plainText` and nothing else interprets them.
5. **Each text is a job that does what is still true when it runs** (8b
   decision 6). The job carries ids, the person, the booking's move number
   and, for taken off, the start that person had (a time, nothing personal).
   When it runs:
   - added goes only if the booking is confirmed, not started, and still
     this person's; it says the booking's time now.
   - moved goes only if the same, and no later move replaced it (that move
     sends its own).
   - taken off goes only if this person is not on the booking now (cancelled
     or another person's), the start they had has not passed, and they knew
     of it: an added or moved text to them for this booking is on the
     timeline, or their added switch is off (they learn of bookings
     elsewhere, their Google or the owner). So nobody is told a booking left
     their day that they never heard was on it: Pedro to Maria and straight
     back before the jobs run tells Maria nothing, and a booking cancelled
     before its added text went sends no taken off either (found while
     building the Simulate page). A booking moved away and back to them
     sends no taken off; the move back sends added.
     Amended after 8c.3's review (Frank, 2026-10-07): "knew of it" means
     they believe it is on their day: their latest text about it was an
     added or moved one, newer than any taken off they got (F-243: no second
     "off your day" for a booking they already think is gone), or an added
     or moved text to them was tried and still waits for a retry, so it may
     have reached them (F-245: a lost answer never leaves them driving to
     an empty house; read from the runner's waiting job). Accepted as is: a
     taken off says the time they had when it came off, which a skipped
     moved text may never have told them; the customer's name still tells
     them which booking it is.
   - Every kind needs: the person active, their row with that switch on, the
     business's text settings (its number) and its time zone. Anything
     missing is one log line, nothing sent. (A phone a text cannot reach
     cannot be stored: 8c.1's database check refuses it, so 8c.2 has no such
     case.)
   - added and moved are both skipped when the person was already told
     after this change: an added or moved text to them for this booking
     described the booking at or past this change's move number (the same
     entries "knew of it" reads; each records the move number its text
     described, built in 8c.3 instead of comparing times, which would rest
     on the database's clock and the change's agreeing). So Marco to Pedro and straight back before the jobs run
     texts Marco "new booking" once, not twice, and a moved text never
     repeats an added text that ran late and already said the new time
     (F-242, Frank, 2026-10-07; this replaces the repeat this decision first
     tolerated).
6. **From the business's own texting number, and never to a texting
   number.** A business without `text_settings` sends no worker texts. A
   worker's phone that is any business's texting number is never texted
   (it would arrive as a customer's reply in that business, the F-199
   leak): checked when the job runs with `findTextingBusiness`, logged
   without the number. Feature 12 refuses it on save.
7. **Retried like 8b's texts, never sent twice** (8b decisions 7 and 8). Up
   to 10 tries; refusals no retry can change are logged. Before a retry
   sends, `findSentText` looks for the same words from the business's number
   to the worker's since the change was saved (its time is in the job), and
   records that one instead.
8. **Recorded on the contact's timeline.** Each worker text that went is an
   `sms_sent` entry with `kind` `worker_added`, `worker_moved` or
   `worker_removed`, the booking id, the person's id and Twilio's id; never
   the number or the words. Feature 11 can then show "Pedro was texted".
   Rejected: no record, which leaves the owner only Twilio's logs.

## Build loop

Steps are built one at a time on `feature/08c-the-worker-s-text`. Each step's
plan gets Frank's yes just before it is built. After that yes nothing stops
until the review: build, tests, tick the box, the build log entry, commit
with the step number and push to the feature branch, `/audit` scoped to the
step, then the independent review (`workflow.stepReview: "every"`,
`workflow.checkpointCommits: "enabled"`). Findings are talked through after
the review; P0/P1 are fixed before the next step. `/complete` makes the merge
commit, on Frank's yes.

No new package. Nothing touches Twilio's live account or Railway; every test
fakes Twilio.

## Build steps

- [x] **8c.1 Who gets the worker's texts.** The `worker_text_settings`
  table and its migration (0021, generated from the schema): one row per
  person, their phone and the three switches, no defaults. Its validation
  schema in `packages/shared` (the phone made textable, each switch
  required). The seed gives one Summit Painting (dev) person a made-up 555
  phone with all three on, and Riverbend Clinic (dev) no rows. Build-plan
  item 12's text settings line gains each person's phone and switches,
  refused on save when the phone is any business's texting number.
  **Done when:** `db:migrate` and `db:seed` run on a fresh `scheduleads_dev`
  and the seed's second run changes nothing; the shared tests pass,
  including: a phone in each shape 8b accepts is saved as `+1` and ten
  digits, a phone outside North America is refused, a missing switch is
  refused; the database refuses a phone not in the `+1` shape and a row
  pointing at another business's person; the backend tests still pass.

- [x] **8c.2 The text when a booking lands on a worker's day.** The added
  text's wording (`renderWorkerText`, decision 4) and the one function that
  sends any worker text (`sendWorkerText`, decisions 5 to 8), the
  `worker_text` job, and `book-time.ts` adding it in the booking's own
  transaction, for the form and the owner alike.
  **Done when:** the shared and backend tests pass, including: a booking from
  the form texts its person from the business's number, and an owner's
  booking does too; the text fits one piece and is cut in decision 4's order,
  the time and the name never; a person with no row, the switch off,
  inactive, or a phone that is a texting number gets nothing
  and one log line; so does a business without text settings or a time zone;
  a booking cancelled, started, or moved to another person before the job
  ran sends nothing; one moved to another time before it ran says the new
  time; a resent form adds no job; a retry that finds the text already went
  records it and sends nothing; a refusal no retry can change is not retried;
  each text that went is one `sms_sent` entry with `worker_added` and no
  number or words.

- [x] **8c.3 Moved, and taken off the worker's day.** The two other
  wordings, and `move-booking.ts` and `cancel-booking.ts` adding the jobs in
  their own transactions: a move that keeps the person adds moved; a move to
  another person adds taken off for the first and added for the second; a
  cancel adds taken off.
  **Done when:** the backend tests pass, including: a move that keeps the
  person texts them the new time; a later move replaces an earlier moved
  text, which then sends nothing; a move to another person texts the first
  "off your day" with the time they had and the second "new booking"; a
  booking moved away and back sends the first no taken off, and one moved
  away and straight back before the jobs ran texts the first "new booking"
  once, not twice; a moved text that a late "new booking" already covered
  sends nothing; one moved to a
  second person and straight back before the jobs ran texts the second
  nothing; a cancel texts the person "off your day"; a booking cancelled
  before its added text went sends no taken off, unless the person's added
  switch is off; a second cancel press adds nothing; taken off for a start
  already passed sends nothing; each switch off stops only its
  own text; each text that went is one `sms_sent` entry of its kind.

## Files / areas

- `packages/shared/db/text-tables/worker-text-settings-table.ts`, exported
  through `packages/shared/db/index.ts`.
- `packages/shared/migrations/0021_*.sql`, from `db:generate`.
- `packages/shared/zod-validation/text-validation-schemas/worker-text-settings-validation-schema.ts`
  and its test, beside `text-settings-validation-schema.ts`.
- `packages/shared/scripts/seed-dev.ts`.
- `backend/lib/text/`: `find-worker-text-context.ts` (the booking, its
  person, the customer's name, the service, the room, the address, the
  business's name and zone, read inside the business), `render-worker-text.ts`
  and its test, `send-worker-text.ts`. Reused unchanged: `sendText`,
  `findSentText`, `findTextSettings`, `findTextingBusiness`, `plainText`,
  `fitBusinessName`, `textPieceLength`, `formatTextTime`,
  `textablePhoneNumber`, `logTextNotSent`.
- `backend/lib/jobs/`: `worker-text-job.ts`, `enqueue-worker-text.ts`,
  `job-names.ts` (`workerText`), `job-tasks.ts`, and the job's test.
- `backend/lib/booking/book-time.ts` (8c.2), `move-booking.ts` and
  `cancel-booking.ts` (8c.3), and their route tests.
- `blueprint/build-plan.md`, item 12's text settings line (8c.1).

## Data / contracts

**Table `worker_text_settings`** (8c.1):

| Column | Type | Rule |
|---|---|---|
| `personId` | text, primary key | one row per person |
| `organizationId` | text, not null | with `personId`, a foreign key to `resource (organizationId, id)`, cascade: only a person of the same business |
| `phone` | text, not null | `+1` and ten digits, area code and exchange starting 2 to 9 (the same check as `text_settings`) |
| `addedOn` | boolean, not null | no default |
| `movedOn` | boolean, not null | no default |
| `removedOn` | boolean, not null | no default |
| `updatedAt` | timestamptz, not null | now, and on every update |

A place never gets a row: the validation schema's callers (the seed now,
Settings later) only offer people, and the job reads only a booking's
`personId`. The phone is not unique: two people may share one.

**Job `worker_text`** payload, ids and times only:

```ts
type WorkerTextJobPayloadType = {
  organizationId: string;
  bookingId: string;
  personId: string;          // who is told
  sequence: number;          // the booking's move number when the job was added
  changedAt: string;         // ISO, when the change was saved: the retry check's "since"
} & (
  | { kind: "added"; startsAt: null }
  | { kind: "moved"; startsAt: null }
  | { kind: "removed"; startsAt: string } // ISO, the start this person had
);
```

No job key: each change adds its own jobs; a resent form and a second cancel
press change nothing, so they add none. Unknown kinds throw, as in
`booking-text-job.ts`. Each booking's worker texts run in one lane,
`worker-text-` and the last two characters of its id, as its calendar jobs
do (8a, decision 5): one at a time, in the order added, so decision 5's
rules read every text an earlier change sent (added in 8c.3: the runner
works five jobs at once). A failed try waits behind later jobs of its lane.

**Timeline:** `sms_sent`, payload
`{ bookingId, kind, personId, sequence, twilioSid }`, `sequence` the
booking's move number the text described (added in 8c.3, for decision 5),
`kind` one of `worker_added`, `worker_moved`, `worker_removed`. No number, no
words.

**Log lines** through `logTextNotSent(bookingId, kind, reason)`: the reason
in plain words, never a phone number, a name or an address.

## Testing

- Shared: `npm run test --workspace=@scheduleads-app/shared` (the validation
  schema, 8c.1).
- Backend: `npm run test --workspace=backend`, local Postgres migrated and
  seeded. The job tests use 8b's fake Twilio and the pinned `jobClock`; the
  booking, move and cancel route tests make their own people and rows and
  remove them. Run the full backend suite several times per step (flaky jobs
  only showed over 7 to 10 runs in 8a and 8b).
- Each case the Simulate page lets Frank play becomes a test of the same
  name in the step that builds its rule.
- No frontend change, so no frontend test and no browser test.

## Notes for the AI

- Follow `send-booking-text.ts` for the shape of `sendWorkerText`: read
  afresh, the reasons as plain words through `logTextNotSent`, `findSentText`
  only when `attempt > 1`, `SendTextError` without `retry` logged and not
  thrown, anything else thrown so the runner retries.
- The phone shown in logs and timeline is never the worker's number.
- Check `record-activity` for how `sms_sent` payloads are typed before adding
  the three worker kinds.
- `move-booking.ts` already knows `personChanged` and the row's old
  `personId` and `startsAt`; add the worker jobs beside `enqueueBookingTexts`.
- `cancel-booking.ts` adds its jobs only when the cancel changed something;
  the taken off job goes in that same branch.
- Feature 12 must refuse a worker phone that is any business's texting
  number on save (decision 6); 8c.1 writes that into build-plan item 12.
