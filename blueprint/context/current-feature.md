# Feature: Free times

**From build-plan:** feature 5c

**Branch:** feature/05c-free-times

## Goal

For a service, and either one person the customer picked or "any available",
work out the start times a customer can book: bookable hours minus bookings,
time off and Google busy times, with the service's buffers, the business's
notice and its horizon. Serve them on a public route the widget (feature 9)
will call. Worked out on every request, never stored.

The third of feature 5's four parts. Nothing shows on screen yet. 5d books one
of these times and checks it again first.

## In scope

- The start-time step on a service: `booking_link.slotIntervalMinutes`, empty
  meaning "every service length" (decision 3, from the plan).
- The rules that turn one person's bookable hours, their busy time, standby
  and the rooms into start times, with buffers, notice and the horizon.
- The rule for who gets an "any available" booking (decision 2), as a function
  5d calls when it books.
- One read that gathers everything for a service, a person or "any
  available", and a range of dates.
- The public route, and the people a customer can pick for a service.

### Decisions

1. **Buffers may fall outside bookable hours** (Frank, 2026-10-01, B). Only the
   appointment itself must fit inside a bookable window. The buffers still
   block: the appointment plus both buffers must not touch anyone's busy time.
   Primo: window 7:30 to 8:30, a 60-minute estimate with 15 after, so 7:30 is
   offered and 8:30 to 8:45 only has to be free.
2. **"Any available" goes to whoever has the fewest bookings that day** (Frank,
   2026-10-02, B). Among the people free at that time: the fewest booking
   commitments starting on that date in the business's time zone (the
   commitment's start, so its buffer before included; time off does not
   count); ties go by name, then id. A room goes to the first free one by
   name, then id. "Any available" offers a time when at least one person (and
   a room, when one is needed) is free then.
3. **Start times repeat every service length by default; the owner can change
   it** (the plan). Stored on `booking_link` as `slotIntervalMinutes`, null
   meaning the service's length. Counted from the start of each bookable
   window: a 9:00 to 12:00 window with 75-minute facials offers 9:00, 10:15
   and, if it fits, nothing at 11:30 (11:30 + 75 runs past 12:00).

Chosen in this spec as the simplest safe option (reversible, recorded):

4. **A calendar that cannot be read never reads as free.** With "any
   available", that person is left out of the answer and one warning line is
   logged. When the customer picked that person, the route answers 503
   `unavailable` ("Times cannot be read right now. Try again shortly."), so a
   broken calendar is never shown as an empty week.
5. **One request covers at most 31 dates** (the business's calendar dates,
   both ends included), clamped to today through today plus the horizon. One
   Google read per person per request.
6. **Daylight saving**: a start time that does not exist on the clock that day
   (the hour skipped in spring) is not offered; a repeated hour (autumn) uses
   its first occurrence. Lengths are real minutes.
7. **The public route names the people a customer can pick**: id and name
   only, the ones `findServiceResources` offers, by name. Nothing else about a
   person, and never whether they are on standby or connected to Google.

## Out of scope

- Booking a time, holding it, the lead, the booking row, the Google event (5d).
- Setting the start-time step, skills, rooms or standby from a screen (12).
- The widget and its layout (9). Showing times in the customer's own time zone
  (the widget's job; the route answers in instants plus the business's zone).
- Rate limiting public routes (not in the plan; noted for 9, the first public
  traffic).
- Part-day standby (5b decided standby is dated).

## Build loop

Steps are built one at a time on `feature/05c-free-times`. Each step's plan
gets Frank's yes just before it is built. After that yes nothing stops until
the review: build, tests, tick the box, the build log entry, commit with the
step number and push to the feature branch, `/audit` scoped to the step, then
the independent review (`workflow.stepReview: "every"`,
`workflow.checkpointCommits: "enabled"`). Findings are talked through after
the review; P0/P1 are fixed before the next step. `/complete` makes the merge
commit, on Frank's yes.

## Build steps

- [x] **5c.1 The start-time step on a service.**
  - `packages/shared/db/booking-tables/booking-link-table.ts` gains
    `slotIntervalMinutes` (integer, nullable, no default) and a check
    `booking_link_slot_interval_check` (null or > 0). Migration
    `0012_booking_link_slot_interval.sql`, generated from `packages/shared`.
  - The dev seed gives one clinic service an explicit step (Chemical Peel, 30
    minutes, starts every 15) and leaves the rest empty, with find-or-make so
    a second run changes nothing.
  - **Done when** `db:migrate` builds a fresh `scheduleads_dev` and `db:seed`
    runs twice; backend tests prove an empty step is allowed, 15 is stored,
    and 0 and -5 are refused by the database; the backend and frontend builds
    pass.

- [x] **5c.2 The free-time rules.** No database, every rule tested.
  - `backend/lib/local-time/` (one helper per file, after review F-60):
    `localTimeToMoment`, a business date plus a minute of the day in its time
    zone, to an instant, null when that time does not exist (decision 6); and
    `localDate`, `addDays`, now shared with feature 2's bookable hours.
  - `backend/lib/scheduling/apply-free-times-rules.ts`: for one person, from
    their resolved bookable hours (`ResolvedBookableHoursType`), the service
    (length, buffers, step), their busy blocks (commitments and Google), their
    standby dates, the rooms (null = no room check, else each room's busy
    blocks and standby dates), a date range and `now`: the start instants they
    can take, sorted. A start is offered when the appointment fits inside one
    bookable window (decision 1); it is at least the notice after `now`; its
    date is inside the horizon, not closed, not a standby date; the
    appointment plus both buffers overlaps none of the person's busy blocks;
    and, when a room is needed, at least one room is free over the same span
    and not on standby. Busy blocks are half-open: a block ending at 10:00
    does not block 10:00.
  - **Done when** saved tests prove: Primo's 7:30 with the 15 after outside
    the window, and 7:30 refused when 8:30 to 8:45 is busy; the step (empty,
    then 15 minutes); notice and horizon; closed and one-off dates; standby;
    a needed room, none free, and no room check; touching busy blocks; the
    spring and autumn clock changes in America/Denver (Alberta stopped
    changing its clocks in 2026, so Edmonton has none to test).

- [x] **5c.3 Who gets "any available".** No database.
  - `backend/lib/scheduling/choose-any-available.ts`: given a start time,
    the people free then with their booking count that day, and the free
    rooms, returns the person and the room (decision 2), or null when nobody
    is free.
  - `backend/lib/scheduling/count-bookings-that-day.ts` (added while
    building): each person's booking count on a date, from the commitment
    rows 5c.4 reads.
  - **Done when** saved tests prove: fewest bookings wins; time off does not
    count as a booking; a tie goes by name, then id; the first free room by
    name; nobody free gives null; a needed room with none free gives null.

- [x] **5c.4 Free times for a service.**
  - `backend/lib/scheduling/find-free-times.ts`:
    `findFreeTimes({ organizationId, bookingLinkId, personId, fromDate,
    toDate, now })`. `personId` null is "any available". Reads the service,
    `findServiceResources` (5b), `findStandbyDates` (5b),
    `resolveBookableHours` per person (2), `findCommitments` for the people
    and rooms (5a), and `getBusyTimes` per person (3), over the range widened
    by the buffers. Applies 5c.2 per person; "any available" is the union of
    the people's times. Answers `{ timezone, people, startTimes }`, or null
    when the service is missing, inactive or another business's, or the
    picked person is not offered for it. A picked person's unreadable
    calendar throws `CalendarUnavailableError`; with "any available" that
    person is left out and `warnConnectFailed`-style one-line warning logged
    (decision 4).
  - **Done when** database tests on the seeded clinic prove: a picked
    practitioner's times; "any available" as the union; a held commitment
    (with `holdTime`) removes the times it covers, buffers included; a
    standby date removes that person on that date only; a needed room taken
    removes the time; a person from another business answers null; a person
    whose connection needs reconnecting throws when picked and is left out of
    "any available".

- [x] **5c.5 The public route.**
  - `GET /public/:slug/booking-links/:bookingLinkId/times?from=YYYY-MM-DD&to=YYYY-MM-DD&person=<id>`
    in `backend/routes/public-booking-links-routes.ts`, `person` omitted for
    "any available". The query is checked by a shared Zod schema
    (`free-times-query-validation-schema.ts` in
    `booking-links-validation-schemas/`). The business comes only from the
    slug, as the other public routes do.
  - `RefusalCodeType` gains `unavailable`.
  - **Done when** route tests on `clinic-dev` prove: 200 with the timezone,
    the pickable people and start times; "any available" when `person` is
    left out; 400 for a bad date, `to` before `from`, more than 31 dates, a
    malformed person id; the same 404 for an unknown business, an inactive
    service and a person not offered for the service; 503 `unavailable` when
    the picked person's calendar cannot be read; the response never carries
    `organizationId`, standby or calendar details; `npm run build
    --workspace=frontend` passes (the typed client sees the route).

## Files / areas

- `packages/shared/db/booking-tables/booking-link-table.ts`,
  `packages/shared/migrations/0012_booking_link_slot_interval.sql`,
  `packages/shared/scripts/seed-dev.ts`.
- `packages/shared/zod-validation/booking-links-validation-schemas/`
  (the query schema, exported through `index.ts`).
- `backend/lib/local-time/`: the clock helpers, one per file (5c.2).
- `backend/lib/scheduling/`: `apply-free-times-rules.ts`,
  `choose-any-available.ts`, `count-bookings-that-day.ts`,
  `find-free-times.ts`, tests beside each.
- `backend/lib/calendar/`: `CalendarUnavailableError` if no existing error
  fits (5c.4 checks).
- `backend/lib/errors/refuse.ts`, `backend/routes/public-booking-links-routes.ts`
  and its test.

## Data / contracts

**booking_link.slotIntervalMinutes**: integer, nullable, no default. Null =
start times every `durationMinutes`. Check `booking_link_slot_interval_check`:
`slotIntervalMinutes is null or slotIntervalMinutes > 0`. Not on the public
booking-link responses.

**applyFreeTimesRules** (pure): inputs as in 5c.2, output `Date[]` sorted
ascending, unique. A start instant `s` is offered for one person when:

- its local date `d` is in `[max(fromDate, today), min(toDate, today +
  horizonDays)]`, not in `closedDates`, not a standby date of the person;
- `d`'s windows are the one-off date's windows if `d` has one, else the
  weekday's; some window `[a, b)` has `a <= m` and `m + duration <= b`, and
  the real end `s + duration` is no later than the moment the clock shows `b`
  when that moment exists (review F-59, decision 6), where
  `m` is the start's minute of the day and `m = a + k * step` for a whole
  `k >= 0` (`step` = `slotIntervalMinutes ?? durationMinutes`);
- `s >= now + minimumNoticeMinutes`;
- the span `[s - bufferBefore, s + duration + bufferAfter)` overlaps none of
  the person's busy blocks;
- rooms null, or some room not on standby on `d` whose busy blocks the span
  does not overlap.

**chooseAnyAvailable** (pure): `(people: { resourceId, name, bookingsThatDay
}[], rooms: { resourceId, name }[] | null) => { personId: string; placeId:
string | null } | null`. Inputs are only the free ones; people and rooms
sorted inside, never trusted to arrive sorted.

**countBookingsThatDay** (pure): `(commitments: { resourceId, kind, startsAt
}[], date: YYYY-MM-DD, timezone) => Map<resourceId, count>`. Counts only
`kind: "booking"` rows whose `startsAt` (buffer before included) falls on
`date` in the business's zone. 5d reads the same rows, so the room rule it
also needs is one helper to share (review F-64, for 5d's spec).

**findFreeTimes** answers:

```ts
{
  timezone: string; // the business's IANA zone
  people: { id: string; name: string }[]; // who the customer can pick, by name
  startTimes: string[]; // ISO 8601 instants in UTC, ascending, unique
}
```

**The route**: `GET /public/:slug/booking-links/:bookingLinkId/times`.

| Query | Rule |
|---|---|
| `from`, `to` | required, `YYYY-MM-DD` real dates, `from <= to`, at most 31 dates |
| `person` | optional, a resource id (same rule as other ids); omitted = any available |

| Status | Body |
|---|---|
| 200 | the `findFreeTimes` answer |
| 400 | `bad_request` |
| 404 | `not_found`, one identical answer for every "not here" |
| 503 | `unavailable`, only when the picked person's calendar cannot be read |

## Testing

Backend Vitest, with the local `scheduleads_dev` migrated and seeded. 5c.2 and
5c.3 are pure and need no database. 5c.4 and 5c.5 use the seeded clinic, add
their own rows and remove them, and refuse any database that is not local and
`*_dev`. Google is never called in tests: a person with no connection has no
busy times, and the unreadable case is a connection row marked
`needs_reconnect`.

## Notes for the AI

- Read time with `findCommitments` over the range widened by the largest
  buffer on each side, so a buffer reaching outside the range still sees what
  it touches.
- `resolveBookableHours` already applies the horizon, closed dates, holidays
  and one-off dates for the business or a person; do not re-implement them.
- Standby comes from `findStandbyDates`; rooms are read the same way (5b
  allowed a place on standby and reads it as hidden that day).
- `getBusyTimes` returns `[]` with no connection and throws when the
  connection needs reconnecting or the read fails; it never answers "free".
- From 5a: three or more holds on one person at the same instant can exhaust
  `holdTime`'s retries. 5c only reads; 5d owns holding.
- Public routes give one identical 404 for every "not here" and take the
  business only from the slug.
