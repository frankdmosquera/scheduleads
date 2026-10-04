# Feature: Reschedule

**From build-plan:** feature 7b

**Branch:** feature/07b-reschedule

## Goal

On the page Jane's private link opens (feature 7a), she can move her booking
to another time. She sees the free times for the same service, and the
booking's own old time never stands in the way: neither the time it holds nor
its own event in the booked person's Google. She picks one, confirms, and the
same booking moves: its held time, its Google event and her calendar invite
move with it, she and the business are told by email, and her timeline shows
it. Nobody signs in: the link is still the key. This finishes feature 7.

## In scope

- Free times for moving one booking: the same service, read as for a new
  booking, with the booking's own held time and its own Google event left out.
- Move: one public route, one transaction (the old held time released, the
  new one held, the booking's times changed, a `booking_moved` timeline
  entry), safe to press twice.
- After the move, without Jane's answer waiting: the booked person's Google
  event updated in place, an email to Jane with her invite updated, and one
  to the business.
- Jane's page: "Change the time", the free times a week at a time, a confirm
  step, and every state (no free times that week, a time taken meanwhile,
  already started, cancelled, failure).
- The slug `bookings` reserved, so no business can sit where these routes do.

### Decisions made in the spec

1. **The same booking moves; nothing is cancelled and rebooked.** Its id, its
   link, its lead and its timeline stay; only its times (and its room, when a
   room is needed) change. A cancelled-and-rebooked booking would send Jane a
   cancellation she did not ask for and break her link.
2. **The old time never stands in the way.** The free times for a move leave
   out the booking's own held rows (person and room) and its own Google
   event, so moving 30 minutes later is offered even when the new time
   overlaps the old one. Everyone else's time counts as usual: bookable hours,
   notice, horizon, other bookings, time off, Google.
3. **A move is checked again when it lands.** The chosen start must still be
   one of the free times for this booking at that moment; the database's
   overlap rule is the last word (5a). Taken meanwhile: 409 `time_taken`,
   nothing changes, the page offers the times again.
4. **Moving twice to the same time is one move.** A press whose start equals
   the booking's current start answers the booking as it is: no new timeline
   entry, no Google call, no email.
5. **A move never waits for Google or Resend**, as the booking and the cancel
   (feature 6's decision 1, 7a's decision 5). A failed update or email logs
   one line; feature 8 retries.
6. **Every change carries a higher invite number.** The booking gains
   `sequence` (0 when made). Each move adds one, and its invite carries it; a
   cancel's invite carries `sequence + 1`. Calendars ignore an update whose
   number is not higher than the last one they saw (7a.4's note).
7. **Google's event is updated in place, never deleted and written again**
   (7a.3's review): Google keeps a deleted event's id and refuses a new event
   with it. An event that was never written (404) is written then.
8. **Both are told.** Jane: "Your booking has moved", the new time and the
   old one, her invite updated. The business: "Moved: <service>, <new time>",
   with the old time and who moved it, Reply to the customer. One email each
   per move (keys carry the move's number).
9. **The page still names the business, never the product** (7a's decision
   9), and never shows the customer's details (7a's decision 3).
10. **Changing the time is booking again** (Frank, 2026-10-03, open question
    1). Jane gets the same choices as her first booking form, for the same
    service: any available, or a named person who offers it, and only the
    times that are really free, with the person who has the skill, a free
    room and the time matching again. Her booking stays hers while she looks;
    the moment she confirms, the new time is held and the old one released
    together, and a time taken meanwhile leaves her booking as it was.
    Rejected: only her current person's times, which no new customer is
    limited to either.
11. **Her own Google event is crossed off Google's busy answer** (Frank,
    2026-10-03, open question 2). Free times are still read from Google's
    free/busy, as for every booking; for her current person, the booking's
    own start to end is taken out of the busy blocks Google answers. One rare
    slip is accepted: another event the person put on top of her booking is
    hidden for that overlap. Rejected: reading the person's events one by one
    and skipping hers, exact but rebuilding Google's own rules (all-day
    events, events marked free, declined invitations), with more to get
    wrong on every move.
12. **Jane may move until the appointment starts** (Frank, 2026-10-03, open
    question 3), the same rule as cancel (7a's decision 11). From its start
    the page shows the business's phone instead. A business's own cutoff
    comes with Settings, feature 12. Rejected: a fixed 24-hour cutoff for
    every business, a rule nobody chose.
13. **Switching a service off stops only new bookings** (Frank, 2026-10-03,
    from 7b.1's review, F-138). A booking already made keeps its page whole:
    Change the time and Cancel, its move times read for its own service even
    when the service is switched off. Rejected: hiding the move and showing
    the phone, which treats an existing booking as if it were new.

## Out of scope

- Changing the service, the address or the details: a new booking.
- The owner moving a booking from the dashboard: features 11 and 12b, which
  can call the same move function.
- A business's own rule for how late a move may happen: Settings, feature 12.
  Until then it is decision 12: until the start.
- Retrying a failed event update or email: feature 8.
- A text telling the customer: feature 8.
- Rate limits on the public routes: feature 9.

## Build loop

Steps are built one at a time on `feature/07b-reschedule`. Each step's plan
gets Frank's yes just before it is built. After that yes nothing stops until
the review: build, tests, tick the box, the build log entry, commit with the
step number and push to the feature branch, `/audit` scoped to the step, then
the independent review (`workflow.stepReview: "every"`,
`workflow.checkpointCommits: "enabled"`). Findings are talked through after
the review; P0/P1 are fixed before the next step. `/complete` makes the merge
commit, on Frank's yes.

No package is planned. Installing one is a line only Frank crosses.

## Build steps

- [x] **7b.1 Free times that ignore the booking's own time.**
  - `findFreeTimes` gains `ignoreBooking` (`{ id, personId, startsAt,
    endsAt }`): that booking's held rows are left out of every person's and
    room's busy time, and its own start to end is crossed off the busy blocks
    Google answers for its current person only (decision 11, `crossOffSpan`).
  - `GET /public/bookings/:token/times?from=YYYY-MM-DD&to=YYYY-MM-DD&person=<id>`
    (public CORS, never with credentials, `no-store`): the people she can
    pick and the free start times for this booking's service, for the picked
    person or any available when `person` is left out, as the booking form's
    own times route answers (decision 10), with its query rule (31 dates at
    most) and its 503 `unavailable` when a calendar cannot be read. 404 for a
    bad link or a person who does not offer the service (7a's decision 2);
    409 `already_started` or `already_cancelled` when it can no longer move.
  - The slug `bookings` is refused when a business is made.
  - **Done when** saved tests, against the local database: a time overlapping
    the booking's own old time is offered; another person who offers the
    service is offered too, and any available covers everyone; the same time
    for another booking's service is not; a room held only by this booking does not block
    it; another booking, time off and the person's Google still block; the
    booking's own Google event does not; a bad link answers 404 with the same
    body; a started or cancelled booking answers 409; nothing in the answer
    carries the customer's details; making a business with the slug
    `bookings` is refused.

- [x] **7b.2 Move.**
  - The booking gains `sequence` (integer, 0); `booking_moved` joins the
    activity types; migration 0018.
  - `backend/lib/booking/move-booking.ts`: the start checked against
    `findFreeTimes` with `ignoreBooking` for the picked person or any
    available, then one transaction with the booking row locked: still
    confirmed and not started, its active held rows released, the new span
    held for the picked person or the first free one in the booking's own
    any-available order, with the first free room by name, `startsAt`,
    `endsAt`, `personId`, `placeId` and `sequence + 1` saved, a
    `booking_moved` entry. The same start with the same person (or any
    available) as now: answers it, writes nothing (decision 4).
  - `POST /public/bookings/:token/move` with `{ startsAt, personId }`
    (`personId` null for any available): 200 the page's
    view at the new time; 404 for a bad link; 409 `time_taken`,
    `already_started` or `already_cancelled`; 400 for a start that is not an
    ISO instant, or a body that is not JSON; 413 over 1 KB; 503 when a
    calendar cannot be read.
  - The page's view gains `canMove` (the same as `canCancel`, decision 13).
  - A booking's own service is read even when switched off, for its move
    times and its move (decision 13); new bookings still need it switched on.
  - **Done when** saved tests, against the local database: a move changes the
    times, releases the old rows, holds the new ones and writes one entry with
    the old and new start; moving into a time overlapping the old one works;
    moving to another person changes the person and holds their time;
    the free-times route offers the old time again; a second press to the same
    time writes nothing more; a time taken meanwhile is refused and nothing
    changes; two moves at the same instant to the same time make one; a
    started or cancelled booking is refused; another business's booking is
    never touched; nothing in the answer, the log or the timeline payload
    carries the customer's details.

- [x] **7b.3 The event moves in the booked person's Google.**
  - The provider seam gains `updateEventTime(accessToken, eventId, time)`:
    Google's `PATCH` of the event's start and end by its saved id; 404 or
    410 answers false and the event is written afresh; throws on any other
    failure. `move-booking-event.ts` does the following.
  - When the move changed the person: the event is removed from the old
    person's Google and written into the new person's. Google keeps a deleted
    event's id in a calendar, so an event moved to another person carries an
    id made from the booking and its `sequence`; updates and removals use the
    saved `calendarEventId`, so moving back to the first person later is
    never refused (the 7b.3 plan confirms the exact id rule).
  - Started by the move after its transaction, not awaited, in the shape of
    the removals (decision 5); the updates still running can be awaited by
    tests.
  - **Done when** saved tests, with Google faked: a move patches the event
    with the new times; an event never written gets written; a move to
    another person removes the old person's event and writes the new
    person's; moving back to the first person later is not refused; no connection
    makes no call; the call carries the person's own access key; a Google
    error keeps the move, logs one line with no customer details; a second
    press to the same time makes no call; the move's answer does not wait for
    Google.

- [x] **7b.4 Both are told.**
  - `bookingIcs` takes `sequence`: the moved invite is `METHOD:REQUEST`, the
    same UID, the new times and the booking's `sequence`; the cancelling
    invite carries `sequence + 1` instead of a fixed 1 (decision 6). Stamped
    with the move's own timeline moment, so a retry sends the same invite.
  - `backend/emails/booking-moved.tsx` to Jane: "Your booking has moved", the
    new time, the old one, the business's phone and the "Manage your booking"
    link; `backend/emails/booking-moved-notification.tsx` to the business:
    "Moved: <service>, <new time>", the old time, the customer's name, phone
    and email, Reply to the customer. Never the product's name.
  - Sent after the move, not awaited: Jane's when she gave an email, the
    business's always. Keys `booking-moved/<id>/<sequence>` and
    `booking-moved-notification/<id>/<sequence>`; each that went gets an
    `email_sent` entry.
  - `npm run email:preview` writes the two new emails as well.
  - **Done when** saved tests, with Resend faked: a move sends both, Jane's
    invite carrying the booking's UID, the new times and the new sequence; a
    second move sends a higher sequence under new keys; a cancel after a move
    carries a sequence above the move's; a phone-only booking sends only the
    business's; a repeat of the same move sends nothing more; Resend failing
    keeps the move and logs one line; the templates show the time in the
    business's zone, no product name, the customer's text as text; the
    preview opened by hand, screenshots in the log.

- [ ] **7b.5 Jane's page: change the time.**
  - On `frontend/components/booking-page/booking-page.tsx`, beside Cancel:
    "Change the time" opens the free times a week at a time (earlier and
    later weeks, never before today), grouped by day in the business's zone.
    Picking a time asks once more ("Move to Tuesday, October 13 at 10:00
    a.m.?", "Keep the current time" focused first), locks while sending, and
    ends on "Your booking has moved" with the new time read out and focused.
  - States: no free times that week (said, with the next week a press away),
    a time taken meanwhile ("That time was just taken. Pick another." and the
    times reloaded), already started (the business's phone), cancelled, and a
    failure that keeps the choice usable. Through the typed public client,
    never with the login cookie.
  - **Done when** the frontend build and lint pass; checked by hand in the
    browser at phone width on a dev booking: the times, a week with none, the
    confirm step, the moved booking, a time taken meanwhile, a started
    booking; focus and announcements checked; the screenshots in the log.

## Files / areas

- `backend/lib/scheduling/find-free-times.ts` (`ignoreBooking`), and the
  Google busy time it reads
- `backend/lib/booking/`: `move-booking.ts`, `find-booking-page.ts`
  (`canMove`), the after-move starts beside `booking-event-writes.ts` and
  `booking-cancellation-emails.ts`
- `backend/lib/calendar/`: `calendar-provider.ts`,
  `google-calendar-provider.ts` (`updateEventTime`), a new
  `move-booking-event.ts`
- `backend/lib/email/`: `booking-ics.ts`, a sender for the two new emails
  through `find-booking-email-context.ts` and `send-and-record-emails.ts`,
  `send-cancellation-emails.ts` (the sequence)
- `backend/emails/`: `booking-moved.tsx`, `booking-moved-notification.tsx`,
  the preview script
- `backend/routes/public-booking-page-routes.ts`
- `packages/shared/db/booking-tables/booking-table.ts` (`sequence`),
  `packages/shared/crm/activity-types.ts`, migration 0018, the business slug
  rule (where client setup makes the slug; confirmed in 7b.1)
- `frontend/components/booking-page/`, `frontend/lib/api-client.ts`
- their tests

## Data / contracts

**Free times for a move** (`GET /public/bookings/:token/times`, 200):

```ts
type BookingMoveTimesType = {
  timezone: string; // the business's IANA zone
  people: { id: string; name: string }[]; // who she can pick, by name
  startTimes: string[]; // ISO 8601 instants in UTC, ascending, unique
};
```

`from`, `to` and `person` follow the booking form's query rule
(`freeTimesQueryValidationSchema`, 31 dates at most). 400 `bad_request`; 404
`not_found`; 409 `already_started` or `already_cancelled`; 503 `unavailable`. The same shape as the booking form's own times route;
an unknown `person` answers 404 `not_found`.

**Move** (`POST /public/bookings/:token/move`, body
`{ startsAt: string; personId: string | null }`):
200 the page's view at the new time; 400 `bad_request` (a start that is
not a time, a body that is not JSON); 413 for a body over 1 KB; 404
`not_found`; 409 `time_taken`, `already_started` or `already_cancelled`; 503
`unavailable` when a calendar cannot be read. Safe to repeat.

**The page's view** gains `canMove: boolean` (confirmed and not started).

**booking** gains `sequence integer not null default 0`.

**The timeline entry**: `type: "booking_moved"`, payload
`{ bookingId, fromStartsAt, toStartsAt, fromPersonId, toPersonId, sequence }`
(ISO instants; the people since 7b.4's review, F-154, so a move's emails name
that move's person even when sent after a later move),
`actorUserId` null (the customer did it).

**The moved invite**: `invite.ics`, `text/calendar; charset=utf-8;
method=REQUEST`; `METHOD:REQUEST`, `STATUS:CONFIRMED`, the booking's UID,
`SEQUENCE:<sequence>`, the new times, `DTSTAMP` from the move's entry. The
cancelling invite: `SEQUENCE:<sequence + 1>`.

**The move emails**: keys `booking-moved/<id>/<sequence>` and
`booking-moved-notification/<id>/<sequence>`; `email_sent` kinds
`booking_move` and `booking_move_notification`.

## Testing

Backend Vitest against the local database, as 7a: businesses of the test's
own, Google and Resend faked, nothing real sent. Every case on the feature's
Simulate page is a saved test under the same name. The frontend has no test
runner: the page is checked by hand in the browser (there is no browser test
harness), with screenshots in the build log.

## Notes for the AI

- Read the booking through its own business: the token gives the booking id,
  the booking row its business, every other read uses that business.
- Lock the booking row (`for update`) before deciding, so two moves, or a move
  and a cancel, at once make one outcome.
- Release the old rows before holding the new ones inside the transaction:
  the overlap rule would refuse a new span that overlaps the booking's own
  old one otherwise.
- The free-times check runs outside the transaction, as `bookTime`'s does;
  the overlap rule inside it is the race guard.
- The Google event's id is the booking id without dashes, plus `s` and the
  move's number for a write after a move (`calendarEventIdOf(id, sequence)`);
  the saved `calendarEventId` is what updates and removals use.
- From step 7b.3's review, for feature 8 (F-149, F-150): a follow that
  cannot remove the first person's event, or a cancel that beats the follow,
  leaves that event behind with nothing pointing at it, and two moves
  within one follow's Google calls can leave an orphan. The move's retry job
  must carry the first person and the event id it is removing; a single
  column on the booking would only half-solve it. F-153 (unverified): a
  PATCH of an event deleted by hand in Google may answer 200.
- From step 7b.4's review, for feature 8 (F-156): six modules repeat the same
  start-and-settle background tracker (event writes, moves, removals, and the
  confirmation, move and cancellation emails), and every test file awaits
  each one by hand. Feature 8's job runner replaces them; nothing shared is
  built before it.
- A confirmation retried by feature 8 after a move would carry the new times
  under the confirmation's old key, which Resend refuses: feature 8 decides
  (a note, not this feature's work).
- Never put a token, a customer's details or a key in a log line.
- From step 7b.1's review: a business that switches a service off leaves the
  booking's page open while its move times answer 404 (F-138); Frank decided
  (decision 13) the booking keeps working, so 7b.2 reads its own service
  even when switched off. An
  owner can still change their address through Better Auth's own
  organization update (F-137), which the reserved slug does not cover; Frank
  left it for Settings, feature 12 (2026-10-03).
- `bookTime` orders "any available" by the day's booking counts; a move's
  counts must leave out the booking being moved (7b.2).
- From step 7b.2's review, for 7b.3 (F-141): a move to another person keeps
  `calendarEventId` while `personId` changes, and nothing records whose
  calendar holds the event, so 7a's cancel would remove it from the wrong
  person. 7b.3 moves the event between calendars and must know the old
  person (the move can hand it over, or the event's owner can be saved).
- From step 7b.2's review (F-145): the move's free check copies about 70
  lines of `bookTime`'s; the name lookup is shared now
  (`find-resource-names.ts`), the rest is carried for when the owner's move
  (features 11 and 12b) gives a third caller.

## Open questions

1. **Who does the moved booking?** Answered by Frank, 2026-10-03: changing
   the time is booking again, with the same choices as her first booking
   (decision 10).
2. **How is the booking's own Google event left out?** Answered by Frank,
   2026-10-03: crossed off Google's busy answer (decision 11).
3. **Until when can Jane move?** Answered by Frank, 2026-10-03: until the
   appointment starts (decision 12).
