# Feature: Closed days and holidays

**From build-plan:** feature 12e

**Size:** heavy - three separate risks with real logic: which days are closed or open for whom (dates, holidays, openings for one person or everyone, and the bookings a close leaves on a closed day), cancelling customers' bookings from the dashboard (emails, texts and calendar events to real people), and a holiday list from a package that can rename what the business saved (F-32).

**Branch:** feature/12e-closed-days-and-holidays

## Goal

The owner closes and opens days on Settings: one click closes a day for online booking for
everyone, one click opens a closed day or a holiday again for one person or for everyone, and
the holiday picker closes the province's and the country's holidays the owner picks, none by
default. Closing stops new bookings only: the bookings already on that day are listed, and the
owner keeps them or cancels them, one by one or all at once. After this nobody edits
`closedDates`, `holidayCountry`, `holidayRegion` or `closedHolidays` by hand or in a setup file
to change any of it, and a holiday the package renames never takes a booking page down (F-32).

## Design reference

`prototypes/settings.html`: the "Days you are closed" card (a list of closed days, each with its
name and a remove cross; "+ Add a date") under the section list's "Days off". Settings is one page
per section since 12d, so this is `/settings/days-off`, the section list's fourth entry. The
prototype's "24 Dec - 2 Jan" range is not built: a day at a time (decision 3). Shared tokens are
already ported.

## In scope

- A Days off page, `/settings/days-off`, in the section list after People.
- **Closing and opening (12e.1)**: the list of closed days from today on (each closed date, and
  each picked holiday's next date, with its name), "+ Close a day", and on each closed day "Open
  again": for everyone, or for one person. Saving a close answers the confirmed bookings still to
  come on the days it closed, still booked (12a's list), each linking to its lead.
- **Cancelling from the list (12e.2)**: under that list, "Cancel" on each booking and "Cancel all",
  each confirmed first. A cancel is the customer's cancel done by the owner: the time is freed,
  the customer gets the cancellation email, the booked person their "off your day" text, the
  Google event comes out, and the lead's timeline names the owner.
- **The holiday picker (12e.3)**: the owner picks the country and the province from the holiday
  package's own list (none picked by default); the page lists that province's and that country's
  holidays for the coming year with their dates; "Close all main holidays" ticks every public
  holiday, and each holiday ticks or unticks on its own. A pick the package no longer knows is
  shown as such and never takes the booking page down (decision 8).
- Read-only for a role that may not change the business, as 12a.

## Out of scope

- Closing a day for one person only, or part of a day: that is time off (12b). Ranges of dates
  (decision 3).
- Hours and one-off dates' own editing (12a, done): opening a day writes a one-off date the Hours
  page already shows and edits.
- Moving bookings, cancelling from the leads list or a calendar (12b), refunds (no payments).
- The booking form (12f), texts settings (12g), the calendar pick (12h).
- Any holiday not in the package, a business's own named closures (a closed day has no name).

## Build loop

Approved one step at a time (AGENTS.md). Heavy: `workflow.stepReview` is `every`,
`checkpointCommits` enabled. After a step's plan has Frank's yes, nothing stops until the review:
build, tests and checks, tick the box, write the build log entry and commit it to buildlogs,
commit and push the step to `feature/12e-closed-days-and-holidays`, `/audit` scoped to the step,
then the independent review. The planned stop is after the review. Blocking findings (P0/P1) are
fixed by default; P2/P3 are recorded and carried. The first commit also drops the step tags from
the nine comments F-364 names. `/complete` makes the final pass and merges on Frank's yes.

## Build steps

- [x] **12e.1 Closing and opening days.** "I close Monday, November 2 for everyone: it is gone
  from the booking window, and Maria's booking that day is listed, still booked. I open it again
  for Ana only: she is offered that day on her usual Monday hours, nobody else is."
  - Rules, no database, in `backend/lib/bookable-hours/`: `apply-opening-rules.ts` decides what
    "open again" writes (decision 4): for everyone, a plain closed date leaves `closedDates`, and
    a holiday's date gets a business one-off date with the business's usual windows for that
    weekday; for one person, a one-off date on their row with their usual windows for that
    weekday (their own week, or the business's when they follow it). A weekday with no usual
    windows cannot be opened from here (decision 5). `apply-newly-closed-rules.ts` lists the
    confirmed bookings still to come whose local date is closed after the save and was not
    before, except a booking of a person the day is opened for. Both read the closed days the
    booking window does (`applyBookableHoursRules`), so they cannot disagree.
  - Backend, in `backend/lib/settings/` and `routes/settings-routes.ts`: `GET /settings/days-off`
    (any member), `PUT /settings/days-off` and `POST /settings/days-off/open`
    (`organization: ["update"]`). The save locks the business's hours row (`for update`, as 12a's
    hours save) and writes only the four closed-day columns; the opening writes the one-off date
    on the business's or the person's row in the same lock.
  - Frontend: `app/(dashboard)/settings/days-off/page.tsx`, "Days off" in the section list,
    `components/settings/days-off-screen.tsx` with the closed days, "+ Close a day" (a date field),
    each day's "Open again" (everyone, or a person from the business's active people), and 12a's
    `ListedBookings` after a close.
  **Done when:** the Simulate cases for closing and opening pass as saved tests under the same
  names, with the route tests below; and by hand on Summit Painting (dev) at
  http://localhost:3400/settings/days-off, a day closed is gone from
  `/admin/booking-preview/painting-dev`, its booking is listed and unchanged on its lead page,
  and opened for one person that person alone is offered that day on their usual hours. The day
  is opened again after the check.

- [ ] **12e.2 Cancelling the bookings on a closed day.** "Under the closed Monday I cancel
  Maria's booking alone, then Cancel all takes Lee's; each customer gets the cancellation email,
  and each lead's timeline says I cancelled it."
  - Backend: `POST /bookings/cancel` (`{ bookingIds }`, 1 to 100, `organization: ["update"]`) in a
    new `routes/bookings-routes.ts`, mounted behind the dashboard middleware, so 12b and the lead
    page reuse it. Every id must be a booking of the session's business, or the whole request is
    one 404 and nothing is cancelled. Each goes through `cancelBooking`, which gains the owner's
    form (decision 6): the booking found inside the business, the owner as the timeline entry's
    actor, and no business notification, since the owner did it (as feature 6's decision 10 for
    bookings the owner makes). Everything else is the customer's cancel unchanged: the time
    freed, the customer's email, the booked person's "off your day" text, the Google event out.
    A booking already started is not cancelled and is named in the answer.
  - Frontend: on the listed bookings, "Cancel" on each and "Cancel all", each behind a
    confirmation that says who is told ("Cancel Maria's booking? She gets an email."); the list
    drops what was cancelled and says what could not be.
  **Done when:** the route tests below pass; and by hand, cancelling one listed booking and then
  "Cancel all" leaves those bookings cancelled on their lead pages with the owner named, the
  emails queued (the API console names them; dev has no Resend key), and their times free in the
  booking preview once the day is opened again.

- [ ] **12e.3 The holiday picker.** "I pick Canada and Alberta; Close all main holidays ticks the
  nine public ones; Thanksgiving's booking is listed. A holiday the list no longer knows shows as
  such, and the booking page still works."
  - Backend: `GET /settings/days-off/holidays?country=CA&region=AB` (any member) answers the
    country's provinces and the holidays from today to a year ahead, the province's and the
    country's, each with its name, date and whether it is a main (public) one (decision 7). The
    save checks every pick against that list (400 on `closedHolidays`). `closed-holidays.ts`
    stops throwing on a name the package no longer has: it skips it, logs one line naming the
    business and the name, and the other picks still close (decision 8).
  - Frontend: the country and province pickers (none by default), the holidays list with a tick
    each, "Close all main holidays", and each pick the package no longer knows marked "no longer
    in the holiday list", to untick.
  **Done when:** the Simulate cases for holidays pass as saved tests under the same names, with
  the route tests below; and by hand on Summit, Close all main holidays closes the public ones
  (gone from the booking preview), one with a booking lists it, and a pick renamed by hand in
  `scheduleads_dev` shows as no longer in the list while the booking preview still loads. The
  picks are put back after the check.

## Files / areas

- `frontend/app/(dashboard)/settings/days-off/`, `frontend/components/settings/` (the section
  list, `days-off-screen.tsx` and its parts), `frontend/lib/api-client/settings/` (days off),
  `frontend/lib/api-client/bookings/` (cancel)
- `packages/shared/zod-validation/availability-validation-schemas/` (the days off save, the
  opening, the cancel request), exported from the index
- `backend/lib/bookable-hours/` (`apply-opening-rules.ts`, `apply-newly-closed-rules.ts`, their
  tests; `closed-holidays.ts` tolerant)
- `backend/lib/settings/` (find and save days off, open a day, the holidays list),
  `backend/routes/settings-routes.ts` and its test
- `backend/lib/booking/cancel-booking.ts` (the owner's form), `backend/routes/bookings-routes.ts`
  and its test, `backend/app.ts` (the mount)
- `backend/lib/errors/refuse.ts` (`no_usual_hours`, `not_closed`)

No migration: every column exists (`availability_rule.closedDates`, `holidayCountry`,
`holidayRegion`, `closedHolidays`, `dateHours`).

## Data / contracts

All under the dashboard CORS, CSRF and no-store middleware and the `booking` module; reads for
any member, writes need `requirePermissionMiddleware({ organization: ["update"] })`. The business
always comes from the session; every query filters on it first; a person or booking of another
business, or an unknown id, is one `404 not_found`. A business with no hours row yet answers
`409 no_business_hours` on every write, as 12a.

**`GET /settings/days-off`** `200 { canEdit, timezone, closedDates, holidayCountry, holidayRegion,
closedHolidays, closedDays, people }`: `closedDates` the saved ones from today on, sorted;
`closedDays` every closed day from today to a year ahead (amended in 12e.1: the horizon hid a day
closed beyond it), sorted, each `{ date, name,
openedForEveryone, openedFor }` (`name` the holiday's or null; `openedFor` the ids of people it
is opened for); `people` the active people `{ id, name }`. `timezone` null and lists empty before
the business has hours.

**`PUT /settings/days-off`** `{ closedDates, holidayCountry, holidayRegion, closedHolidays }`,
strict: dates `YYYY-MM-DD`, no repeats; a province needs a country; picks need a country and must
be in the package's list for that country and province. `200 { daysOff, newlyClosed }`:
`daysOff` as the GET answers it (without `canEdit`), `newlyClosed` 12a's rows `{ bookingId, leadId, customerName, serviceName,
personName, startsAt, endsAt }`, ISO, soonest first. A date the save adds to `closedDates` loses the
business's one-off hours on it (amended in 12e.1: a one-off date opens a closed day, so the close
would do nothing); people's own one-off dates stay, as their openings.

**`POST /settings/days-off/open`** `{ date, personId }` (`personId` null for everyone). `200 {
daysOff }` as the PUT's (amended in 12e.1: the page refreshes from one shape). `400 not_closed` when the date is not a closed day; `409
no_usual_hours` when the weekday has no usual windows for whoever it opens for.

**`GET /settings/days-off/holidays?country=&region=`** `200 { regions, holidays }`: `regions` the
country's provinces `{ code, name }`; `holidays` `{ name, date, main }` from today to a year
ahead, sorted. An unknown country or province is `400` on the field.

**`POST /bookings/cancel`** `{ bookingIds }`, 1 to 100, no repeats. `200 { cancelled,
alreadyCancelled, alreadyStarted }`, each a list of booking ids.

**Errors**: 400 `{ error: { code, message }, field }`; 409 `no_usual_hours` "Nobody works that
weekday here: set that day's hours on Hours."; 400 `not_closed` "That day is not closed."; 401/403
as 12a.

**Formats**: dates `YYYY-MM-DD` on the business's clock; a holiday pick is the package's English
name (decision 8); times ISO.

**User text**: names (people, holidays, customers) are rendered by React as text.

## Testing

Commands: `npm run test --workspace=@scheduleads-app/shared`, `npm run test --workspace=backend`
(local Postgres, migrated and seeded), `npm run build` and `npm run lint` for the frontend. No
Verify command and no browser test harness; hand checks are in each Done when.

One test per rule that would hurt if broken:

- 12e.1, named as on the Simulate page: a closed day is closed for everyone; a day opened for Ana
  is open for her only, on her usual hours for that weekday; a day opened for everyone opens on
  the business's usual hours; a closed day with no usual hours that weekday cannot be opened;
  closing a day lists its bookings, except those of someone it is opened for. Route tests: a
  member without the permission cannot close or open a day; another business's person gets the
  404; a save writes only the four closed-day columns and keeps the hours.
- 12e.2: another business's booking in the list is refused and nothing is cancelled; an owner's
  cancel frees the time, records the owner, queues the customer's email and the worker text and
  no business notification; a started booking is not cancelled and is named.
- 12e.3, named as on the Simulate page: a picked holiday is closed, and opened for everyone it is
  open that year only; a holiday the list no longer knows is skipped and the other picks still
  close. Route test: a pick not in the province's list is refused on save.

## Notes for the AI

- 12a's patterns: client components fetching through `dashboardApiClient`; react-hook-form where
  there is a form; each error under its field with `aria-describedby`; a refused save focuses the
  first bad field; saved and failed messages announced and cleared on the next edit; a closing
  form returns the keyboard to the button that opened it. No TanStack Query (feature 14).
- Nothing is pre-filled where the business must choose (decision 30): no country, no province,
  no holiday picked.
- Cancelling is irreversible and reaches customers: always confirmed first, never on one click.
- Any hand check puts the dev data back (12d's F-352).
- Comments beside the line they explain, one or two lines, no history (no step or finding
  numbers).

## Open questions

None blocking. Every choice is in the build log's Decisions drawer and can be overruled at its
step's plan; the ones worth a look first are decision 4 (what "open again" writes), decision 6
(the owner's cancel sends no business notification) and decision 8 (a renamed holiday is
skipped, not fatal).
