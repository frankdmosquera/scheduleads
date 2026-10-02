# Feature: The booking

**From build-plan:** feature 5d

**Branch:** feature/05d-the-booking

## Goal

A customer picks one of 5c's free times and books it: the time is checked
again, the person (and the room, when the service needs one) is held, and the
contact, the lead in the first stage, the booking with the customer's address
and the timeline entry are written together, all or nothing. Then the event
goes into the booked person's Google calendar. The public route the widget
(feature 9) will call does this for strangers; the same function makes a
booking the owner enters (a phone estimate, a walk-in), whose route arrives
with its screen.

The last of feature 5's four parts. Nothing shows on screen yet.

## In scope

- The `lead` and `booking` tables, and `commitment.bookingId` pointing at its
  booking.
- Writing a booking as one unit: `holdTime`, `releaseTime`,
  `findOrCreateContact` and `recordActivity` can join a caller's transaction,
  and a refused hold leaves that transaction usable (F-52).
- One room rule, `isRoomFree`, shared by the free times and the booking
  (F-64).
- `bookTime`: check again, choose who gets "any available", hold, write
  everything, then the Google event.
- Writing the event into the booked person's Google calendar, and one helper
  that hands out a fresh access token to both the busy-time read and the
  event write.
- `POST /public/:slug/bookings`, and the times route answering "try again
  shortly" when nobody's calendar could be read (F-74).

### Decisions

Made in this spec as the simplest safe option (reversible, recorded; each
gets a line in the build log's Decisions drawer with why the other option
lost):

1. **An owner-made booking is a function now, a route with its screen**
   (overview: CRM routes arrive with their screens). `bookTime` takes
   `source: "manual"` and the owner's login; that login must be a member of
   the business, checked inside `bookTime`, never trusted.
2. **A booking's `startsAt` and `endsAt` are the appointment itself.** The
   buffers live only in its commitments, which span `startsAt -
   bufferBefore` to `endsAt + bufferAfter`, as 5c reads them.
3. **The cancel token waits for feature 7.** Nothing reads it before then, and
   a token is only useful in the email that carries it (feature 6). The plan's
   `cancelToken` column arrives with them.
4. **Every booking makes a new lead**, in the business's first stage, even for
   a known contact: a returning customer is a new job.
5. **A refused hold tries the next choice, never a stale one.** With "any
   available", the free people are tried in decision 2's order (fewest
   bookings that day, then name, then id), each with the free rooms by name,
   inside the same transaction, until one holds. A picked person who was taken
   meanwhile answers `time_taken`.
6. **Google is written after the booking is saved, and a failure keeps the
   booking.** A customer's booking is never lost because Google hiccuped: the
   booking stays without `calendarEventId`, one warning line is logged, and
   writing the event again is feature 8's background job. The event never has
   attendees, so Google never emails the customer from a worker's account
   (feature 6: customers only hear from the business).
7. **The same form sent twice gets one booking** (Frank, 2026-10-02, after
   review F-75). The widget makes a one-time `requestKey` when the booking form
   opens and sends it with Book; `booking` stores it, unique per business, so
   the database lets only one booking in for a key, even when two copies arrive
   at the same instant (a double tap, or a press repeated after a lost answer).
   A request whose key is already booked answers that booking, when it asks
   for the same service and start (and the same person, if one was picked);
   a key already used for a different booking is refused, `request_key_used`
   (review F-81). A different key
   is a new booking: a parent booking two children at 9:00 is two forms, two
   keys, two bookings. Owner-made bookings carry no key. The widget also locks
   its Book button after one press (feature 9); the key covers what a button
   cannot, since the server never trusts the front end. Rejected: refusing a
   second booking for the same email, service and start, which would refuse
   the second child.
8. **The timeline entry links the lead and the booking in its payload**
   (`{ leadId, bookingId, bookingLinkId, startsAt }`), not new columns;
   feature 11 reads them.
9. **"Any available" with every calendar unreadable is "try again shortly"**
   (F-74): the times route answers 503 `unavailable` when every offered person
   was left out because their calendar could not be read, instead of an empty
   week that reads as fully booked. One readable person is enough for 200.
10. **A public booking request is at most 16 KB**, checked with Hono's own
    `bodyLimit` before it is parsed (no new package).
11. **The owner books any time someone is not busy** (Frank, 2026-10-02,
    open question 2, option B; already the plan's word in feature 12b:
    bookable hours only limit customers). An owner-made booking ignores
    bookable hours, notice, the horizon and standby, but never goes over a
    booking, time off or the person's own Google busy time: Google wins (a
    dinner in Pedro's business calendar blocks his bookable evening, for
    customers and for the owner). The room, when needed, must be free by the
    same room rule, standby ignored. People often book themselves this way
    rather than change their settings.
12. **"Time taken" says it happened while they were booking** (Frank,
    2026-10-02). The time can stop being free between seeing it and pressing
    Book: another customer booked it, the owner booked or gave time off, the
    person added something to their Google, or the page stayed open until the
    notice passed. The server cannot always tell which, so the message is
    true for all of them and says it is not the customer's fault: "Sorry,
    that time was taken while you were booking. Please pick another one."
    The widget (feature 9) shows it with the times still free. Rejected:
    "someone booked that time a moment before you", true only for the first.

## Open questions

Each blocks only the step named; Frank answers it when that step's plan is
gone through, before it is built.

1. **Does an online booking require an email?** (blocks 5d.5) Recommended:
   yes, with the phone optional. Feature 6 sends the confirmation and feature
   7 the cancel link by email; without one the customer hears nothing. An
   owner-made booking keeps both optional, as `contact` allows.
2. Answered 2026-10-02: decision 11.
3. **What goes into the Google event?** (blocks 5d.4) Recommended: the title
   is the service and the customer's name, the location is their address, and
   the description holds their phone, email and what they wrote. The
   alternative is the service and first name only, everything else in the
   dashboard; it keeps less customer data in a worker's own Google account,
   but a painter on site would have no address or phone.

## Out of scope

- Confirmation emails and texts (6); cancel and reschedule, and the cancel
  token (7); retrying a Google event that failed (8).
- The widget (9) and the owner's booking screen (11 or 12b); the owner-made
  booking's route arrives with that screen.
- Rate limiting public routes (noted for 9, the first public traffic; F-62).
- Taking deposits or payment.

## Build loop

Steps are built one at a time on `feature/05d-the-booking`. Each step's plan
gets Frank's yes just before it is built. After that yes nothing stops until
the review: build, tests, tick the box, the build log entry, commit with the
step number and push to the feature branch, `/audit` scoped to the step, then
the independent review (`workflow.stepReview: "every"`,
`workflow.checkpointCommits: "enabled"`). Findings are talked through after
the review; P0/P1 are fixed before the next step. `/complete` makes the merge
commit, on Frank's yes.

## Build steps

- [x] **5d.1 The lead and booking tables.**
  - `packages/shared/db/crm-tables/lead-table.ts`: `id`, `organizationId`,
    `contactId` (same business, cascade), `stageId` (same business, no
    action: a stage with leads cannot be deleted), `source` (`widget`,
    `hosted`, `manual`, check `lead_source_check`), `details` (text,
    nullable: what the customer wrote), timestamps; unique
    `(organizationId, id)`; index `(organizationId, stageId)`.
  - `packages/shared/db/booking-tables/booking-table.ts`: `id`,
    `organizationId`, `leadId`, `bookingLinkId`, `personId`, `placeId`
    (nullable), each a same-business foreign key with no action; `startsAt`,
    `endsAt` (the appointment, `booking_time_order_check`); `status`
    (`confirmed` | `cancelled`, default `confirmed`,
    `booking_status_check`); `location` (text, not empty after trimming,
    `booking_location_check`); `calendarEventId` (nullable); timestamps;
    unique `(organizationId, id)`; index `(organizationId, startsAt)`.
  - `commitment.bookingId` gains `commitment_booking_fk` to
    `(organizationId, id)` on `booking`, no action.
  - Migration `0013_lead_and_booking.sql`, generated from `packages/shared`.
    If `drizzle-kit` writes a foreign key before the unique it needs (the
    0010 trap, `42830`), the statement is moved by hand and a later
    `db:generate` must find no change.
  - **Done when** `db:migrate` builds a fresh `scheduleads_dev`, `db:seed`
    runs twice, `db:generate` finds no change, and database tests prove: a
    lead in another business's stage or for another business's contact is
    refused; an unknown source is refused; a booking with an empty location,
    an end before its start, an unknown status, or another business's lead,
    service, person or place is refused; a commitment pointing at another
    business's booking is refused; the backend and frontend builds pass.
  - Review fix (F-75, decision 7): `booking.requestKey` (text, nullable) and
    `booking_request_key_unique` on `(organizationId, requestKey)` where it is
    not null, in migration `0014_booking_request_key.sql` (0013 had already
    run on the dev database, which holds a real Google connection). **Done
    when** a test proves a second booking with the same key in the same
    business is refused, the same key in another business and two bookings
    without a key are both allowed.

- [x] **5d.2 Writing as one: transactions and the room rule.**
  - `holdTime`, `releaseTime`, `findOrCreateContact` and `recordActivity`
    take an optional last argument, the executor (`db` or a transaction),
    default `db`. `holdTime` runs each attempt in a nested transaction
    (a savepoint inside the caller's), so `{ held: false }` and a deadlock
    retry leave the caller's transaction usable (F-52).
  - `backend/lib/scheduling/is-room-free.ts`: `isRoomFree(room, date, spanStart,
    spanEnd)`, the room rule pulled out of `applyFreeTimesRules` (not on
    standby that date, no busy block over the span, half-open). It takes any
    room with its taken time and standby dates; a caller keeps its own ids
    (5d.3 filters its rooms with it). The span itself comes from one helper,
    `appointmentSpan` (the buffer before, the appointment, the buffer after;
    review F-76). `applyFreeTimesRules` uses both, behaviour unchanged (F-64).
  - **Done when** saved tests prove: inside a transaction, a taken hold
    answers `{ held: false }` and the transaction still commits its other
    rows; a rolled-back transaction leaves no commitment, contact or
    activity; each of the four functions writes nothing outside the
    transaction it was given; `isRoomFree` covers standby, an overlapping
    block, a touching block and the buffers; every existing test passes
    unchanged.

- [x] **5d.3 Booking a time.**
  - `backend/lib/booking/book-time.ts`: `bookTime({ organizationId,
    bookingLinkId, personId, startsAt, customer, location, details, source,
    actorUserId, now })`, `personId` null for "any available". Answers
    `{ booked: true, booking, alreadyBooked }` or `{ booked: false, reason }`
    with `reason` one of `not_found`, `time_taken`, `unavailable`.
  - Check again with 5c's own reads: the start must be one `findFreeTimes`
    offers for that person on that date. Owner-made (decision 11): instead,
    the span (`appointmentSpan`) must touch none of the person's bookings,
    time off or Google busy time, and a needed room must pass `isRoomFree`
    with standby ignored. With
    "any available", each offered person is checked; their order comes from
    `chooseAnyAvailable` with `countBookingsThatDay`, the rooms from
    `isRoomFree`. A picked person whose calendar cannot be read answers
    `unavailable`.
  - Decision 7 runs first, before the check: a request whose `requestKey` is
    already booked answers that booking (the customer's own first booking
    would otherwise make the time look taken). Inside the transaction the
    booking's insert carries the key; refused by `booking_request_key_unique`
    (two copies at the same instant), the transaction is rolled back and the
    booking that won is the answer. Then the check, then one transaction:
    `findOrCreateContact`, `findFirstPipelineStage`, the lead, the booking,
    `holdTime` (person, and room when needed, buffers inside, `bookingId`
    set; decision 5 on a refusal), and `recordActivity` (`booking_created`,
    decision 8, the owner's login as actor when owner-made). Nothing is left
    behind when it answers `time_taken`.
  - **Done when** database tests on small clinics of their own prove: a
    picked practitioner's booking writes the contact, a lead in the first
    stage with its source, the booking with the address, the commitments
    (person and room, buffers inside, `bookingId` set) and the timeline
    entry; a known email reuses its contact; "any available" goes to the
    fewest bookings that day; a time that stopped being free answers
    `time_taken` and writes nothing; two bookings of the same person at the
    same instant give one booked and one `time_taken`, the loser leaving no
    contact, lead or booking; "any available" whose first choice is taken
    meanwhile goes to the next; the same form sent twice, one after the other
    and at the same instant, gets one booking and both answer it; two forms
    with different keys for the same email and time book twice; an unreadable
    picked calendar answers `unavailable`; a room taken only during the buffer
    after is not chosen, and the held span is `appointmentSpan`'s (F-76);
    another
    business's service or person answers `not_found`; an owner-made booking
    by someone outside the business is refused; an owner-made booking outside
    bookable hours, on a standby date or within the notice is booked, and one
    over the person's Google busy time, a booking or time off answers
    `time_taken` (decision 11).

- [ ] **5d.4 The event in the booked person's Google.**
  - The seam gains `createEvent(accessToken, event)`, answering the
    provider's event id; the Google plug inserts into the primary calendar
    with a timeout, no attendees, times in the business's zone.
  - `backend/lib/calendar/get-fresh-access-token.ts`: the refresh that
    `getBusyTimes` does today (the same race rules, the same
    `needs_reconnect` marking), pulled out so both use one copy.
  - `backend/lib/calendar/write-booking-event.ts`: writes the event for one
    booking and saves `calendarEventId`; no connection writes nothing.
    `bookTime` calls it after the transaction commits; any failure keeps the
    booking and logs one warning line with a safe reason (decision 6).
  - **Done when** saved tests with Google faked prove: the event's title,
    location, description (open question 3), start and end (the
    appointment, not the buffers) and zone; its id saved on the booking; no
    connection makes no call; a connection needing reconnection, a Google
    error and a timeout each keep the booking, leave `calendarEventId` empty
    and log one line; an expired token is refreshed through the shared
    helper; every `getBusyTimes` test passes unchanged.

- [ ] **5d.5 The public route.**
  - `POST /public/:slug/bookings` in a new
    `backend/routes/public-bookings-routes.ts`, mounted under `/public`. The
    body is checked by a shared Zod schema
    (`create-booking-validation-schema.ts` in
    `booking-links-validation-schemas/`, exported through `index.ts`) through
    Hono's own `validator("json")`, after `bodyLimit` (decision 10). The
    business comes only from the slug, as on the other public routes.
  - `publicCorsMiddleware` allows `POST` too, still without credentials.
  - `RefusalCodeType` gains `time_taken`.
  - The times route answers 503 `unavailable` per decision 9.
  - **Done when** route tests on `clinic-dev` prove: 201 with the booking's
    id, times, zone, service and person, and never the customer's name,
    email, phone or address, or `organizationId`; 400 for a malformed body,
    a start that is not an instant, an empty address, and open question 1's
    rule; 413 for a body over 16 KB; the one identical 404 for an unknown
    business, an inactive service and a person not offered; 409
    `time_taken` with decision 12's message for a time no longer free; 503 `unavailable` for an
    unreadable picked calendar, and on the times route when every calendar
    is unreadable; a preflight allows `POST` without credentials;
    `npm run build --workspace=frontend` passes and the typed client sees the
    route (checked with a throwaway file, as in 5c.5).

## Files / areas

- `packages/shared/db/crm-tables/lead-table.ts`,
  `packages/shared/db/booking-tables/booking-table.ts`,
  `packages/shared/db/scheduling-tables/commitment-table.ts`,
  `packages/shared/db/index.ts`, `packages/shared/migrations/0013_*` and
  `0014_*`.
- `packages/shared/zod-validation/booking-links-validation-schemas/`
  (the booking body schema, exported through `index.ts`).
- `backend/lib/scheduling/`: `hold-time.ts`, `release-time.ts`,
  `is-room-free.ts`, `apply-free-times-rules.ts`, `find-free-times.ts`.
- `backend/lib/crm/`: `find-or-create-contact.ts`, `record-activity.ts`.
- `backend/lib/booking/book-time.ts` (new area), tests beside it.
- `backend/lib/calendar/`: `calendar-provider.ts`,
  `google-calendar-provider.ts`, `get-fresh-access-token.ts`,
  `get-busy-times.ts`, `write-booking-event.ts`.
- `backend/lib/errors/refuse.ts`,
  `backend/middleware/public-middleware/public-cors-middleware.ts`,
  `backend/routes/public-bookings-routes.ts`,
  `backend/routes/public-booking-links-routes.ts`, `backend/app.ts`, and their
  tests.

## Data / contracts

**lead**: `id` text, `organizationId`, `contactId`, `stageId`, `source`
(`widget` | `hosted` | `manual`), `details` text null, `createdAt`,
`updatedAt`. Online bookings use `widget` (the hosted page, `hosted`, is
feature 24).

**booking**: `id` text, `organizationId`, `leadId`, `bookingLinkId`,
`personId`, `placeId` null, `startsAt`, `endsAt` (timestamptz, the
appointment), `status` (`confirmed` | `cancelled`), `location` text not empty,
`calendarEventId` text null, `requestKey` text null (unique per business when
set, decision 7), `createdAt`, `updatedAt`. Its commitments find it through
`commitment.bookingId`.

**The booking body** (`POST /public/:slug/bookings`):

```ts
{
  bookingLinkId: string; // the same rule as the id in the times route
  startsAt: string; // an ISO 8601 instant with Z or an offset, one 5c offered
  personId?: string; // left out = any available
  requestKey?: string; // one per form, made when it opens (decision 7); the same id rule
  customer: {
    name: string; // contactValidationSchema's rule
    email?: string; // open question 1
    phone?: string; // optional; a form sends nothing rather than ""
  };
  location: string; // the customer's address, trimmed, 1 to 300 characters
  details?: string; // what they wrote, trimmed, at most 2000 characters
}
```

| Status | Body |
|---|---|
| 201 | `{ booking: { id, startsAt, endsAt, timezone, service: { id, name }, person: { id, name } } }` (also when decision 7 answers an existing booking) |
| 400 | `bad_request` with the first reason |
| 404 | `not_found`, one identical answer for every "not here" |
| 409 | `time_taken`: "Sorry, that time was taken while you were booking. Please pick another one." (decision 12) |
| 409 | `request_key_used`: "This booking form was already used. Please reload the page and book again." (review F-81) |
| 413 | the request is over 16 KB |
| 503 | `unavailable`: "Times cannot be read right now. Try again shortly." |

**bookTime** answers `{ booked: true; booking: BookedType; alreadyBooked:
boolean }` or `{ booked: false; reason: "not_found" | "time_taken" |
"unavailable" | "request_key_used" }`. "Any available" with nobody free and a
calendar that could not be read answers `unavailable`, never `time_taken`
(review F-80). Nothing in its answer or its logs carries the customer's
name, email, phone, address or words.

**The Google event**: no attendees; `start` and `end` the appointment with
the business's `timeZone`; title, location and description per open question
3; `calendarEventId` is Google's event id.

## Testing

Backend Vitest with the local `scheduleads_dev` migrated and seeded. 5d.2's
`isRoomFree` is pure. Every other test uses a small business of its own,
removed after, or the seeded clinic for the route, and refuses any database
that is not local and `*_dev`. Google is never called: `fetch` is stubbed in
every file that could reach it; a person with no connection has no busy time,
and the unreadable case is a connection marked `needs_reconnect`.

Each case on the feature's Simulate page ("What happens when you press
Book?") is also a saved test under the same name, in the step that builds its
rule.

## Notes for the AI

- `commitment` refuses overlaps itself (`commitment_no_overlap`, migration
  0009, compares the business too); never check-then-insert without it.
- 5c's reads are reused as they are: `findFreeTimes`, `findServiceResources`,
  `findStandbyDates`, `findCommitments`, `resolveBookableHours`,
  `chooseAnyAvailable`, `countBookingsThatDay`. Do not write a second copy of
  any rule.
- Inside a transaction a refused insert aborts it; only a savepoint keeps it
  usable (F-52). Drizzle's nested `tx.transaction()` is a savepoint.
- Public routes take the business only from the slug, give one identical 404
  for every "not here", and never echo a contact's name, email, phone or
  address. Log lines carry ids and safe reasons only.
- The Google scopes already granted (`calendar.events.owned`) allow writing
  an event to the person's own calendar; no reconnect is needed.
- At deploy: confirm `btree_gist` on Railway and apply 0005 to 0014; the
  server needs tzdata 2026c or newer (carried from 5c).
