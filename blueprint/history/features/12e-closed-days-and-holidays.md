# Feature: Closed days and holidays

**From build-plan:** feature 12e

**Size:** heavy - three separate risks with real logic: which days are closed or open for whom (dates, holidays, openings for one person or everyone, and the bookings a close leaves on a closed day), cancelling customers' bookings from the dashboard (emails, texts and calendar events to real people), and a holiday list from a package that can rename what the business saved (F-32).

**Branch:** feature/12e-closed-days-and-holidays

**Status:** verified 2026-10-11: all three steps built and reviewed, then a final review of the whole feature; backend 966, shared 174 and booking component 79 tests pass, the frontend builds and lints.

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
  the customer gets the cancellation email, opening "Summit had to cancel your booking." rather
  than the customer's own "Thanks for letting us know" (F-370, Frank 2026-10-11), the booked
  person their "off your day" text, the
  Google event comes out, and the lead's timeline names the owner.
- **The holiday picker (12e.3)**: the owner picks the country, Canada, Colombia or the United
  States only (Frank, 2026-10-11), and optionally the province or state (none picked by default;
  Colombia has none in the package); the page lists the statutory holidays for the coming year
  with their dates: the province's own list when one is picked, the country's otherwise, and
  nothing else (Frank, 2026-10-11, settling F-379: "a holiday that people don't work", by law, the
  package's public ones; observances, optional days and school terms are closed by hand with
  "+ Close a day"). "Close them all" ticks every one listed, and each ticks or unticks on its own.
  A pick the package no longer knows is shown as such and never takes the booking page down
  (decision 8).
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

- [x] **12e.2 Cancelling the bookings on a closed day.** "Under the closed Monday I cancel
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

- [x] **12e.3 The holiday picker.** "I pick Canada and Alberta; Close all main holidays ticks the
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
closedHolidays, closedDays, people, unknownHolidays }`: `closedDates` the saved ones from today
on, sorted; `unknownHolidays` the picks the holiday list has in no year from this one to ten
years ahead (amended in 12e.3's review, F-375: a substitute day skips years and is not gone);
`closedDays` every closed day from today to a year ahead (amended in 12e.1: the horizon hid a day
closed beyond it), sorted, each `{ date, name,
openedForEveryone, openedFor }` (`name` the holiday's or null; `openedFor` the ids of people it
is opened for); `people` the active people `{ id, name }`. `timezone` null and lists empty before
the business has hours.

**`PUT /settings/days-off`** `{ holidayCountry, holidayRegion, closedHolidays }` (amended in
12e.3's review, F-376: the closed dates are no longer in the body, so a page loaded before a day
was closed elsewhere cannot open it again), strict, no repeats; a country from the three offered;
a province from that country's list, and only with a country; picks need a country and a name
the holiday list has (as `unknownHolidays` above). `200 { daysOff, newlyClosed }`:
`daysOff` as the GET answers it (without `canEdit`), `newlyClosed` 12a's rows `{ bookingId, leadId, customerName, serviceName,
personName, startsAt, endsAt }`, ISO, soonest first. Writes only the three holiday columns.

**`POST /settings/days-off/close`** `{ date }` (amended in 12e.1's review, F-365): closes one day for
everyone: the date joins `closedDates` once, and the business's one-off hours on it go, since a
one-off date opens a closed day; people's own one-off dates stay, as their openings. `200 { daysOff,
newlyClosed }` as the PUT's. The page's "+ Close a day" uses this; the PUT is the holiday picker's
(12e.3).

**`POST /settings/days-off/open`** `{ date, personId }` (`personId` null for everyone). `200 {
daysOff }` as the PUT's (amended in 12e.1: the page refreshes from one shape). `400 not_closed` when the date is not a closed day; `409
no_usual_hours` when the weekday has no usual windows for whoever it opens for.

**`GET /settings/days-off/holidays?country=&region=`** `200 { countries, regions, holidays }`
(amended in 12e.3: the country picker needs its list, and a holiday can fall twice in the year):
`countries` the three offered `{ code, name }`; with a country, `regions` its provinces
`{ code, name }` and `holidays` `{ name, dates }`, the statutory ones only (amended at the
final review, F-379), from today to a year ahead, one per name, soonest first; without one, both
empty. A country not offered or an unknown
province is `400` on `holidayCountry` or `holidayRegion`; a province without a country is `400`.

**`POST /bookings/cancel`** `{ bookingIds }`, 1 to 100, no repeats. `200 { cancelled,
alreadyCancelled, alreadyStarted }`, each a list of booking ids.

**Errors**: 400 `{ error: { code, message }, field }`; 409 `no_usual_hours` "The business does
not work that weekday: set that day's hours on Hours." (for everyone; for a person "They do not
work that weekday: set their hours on Hours."); 400 `not_closed` "That day is not closed."; 401/403
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
  404; a holiday save writes only the three holiday columns and keeps the closed days and the
  hours (renamed in 12e.3's review, F-376).
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

## Implementation walkthrough

Feature 12e was specced heavy with three steps, one per real risk, and kept them: which days are
closed or open for whom (12e.1, `080673f`, review fixes `72a0598`), the owner cancelling customers'
bookings on a closed day (12e.2, `1812c4a`, fixes `5e81b07`), and the holiday picker over a package
that can rename what a business saved (12e.3, `ca5748d`, fixes `c4fde9f` and `08df35d`: a staging
slip left the first fix commit holding only the rename of `save-days-off.ts` to
`save-holiday-picks.ts`, and the second carries the code and tests). Every step had a fresh
independent review. A final review of the whole feature at `bc8eb79` reopened F-379 and found
F-382; Frank decided the picker offers statutory holidays only, `e65d66d` fixed both, and a second
final review at `e65d66d` passed with one P3 left open (F-383). The Simulate page's cases for
closing, opening and holidays became saved tests under the same names. The first commit also
dropped the step tags from the nine comments F-364 named.

### the rules, no database (`backend/lib/bookable-hours/`)

`closed-days-between.ts` is the one list of a business's closed days between two dates, its closed
dates and its picked holidays' dates, one entry per date with the holiday's name. The booking
window (`applyBookableHoursRules`, which used to merge the two itself) and the Days off page both
read it, so they cannot disagree. `apply-opening-rules.ts` holds the page's rules. `listClosedDays`
lists every closed day from today to `DAYS_OFF_AHEAD` (365 days, the longest a business can take
bookings), each with whether the business has a one-off date on it and which active people have
their own; the window was widened from the booking horizon in 12e.1 because the horizon hid a day
closed beyond it, and F-368 added the test that proves it with Christmas Eve past a 60-day
horizon. `applyOpeningRules` (decision 4) first asks the booking window, over that year, whether
the date is closed for whoever it opens for (`not_closed` if not), then finds that weekday's usual
windows: the person's own week, or the business's when they follow it, and the business's week for
everyone. No windows is `no_usual_hours` (decision 5; F-366 kept it for everyone and reworded the
refusal). For everyone, a date the business closed simply leaves `closedDates`; a date still closed
after that, a picked holiday, also gets a business one-off date on the usual hours, so it opens that
year only. For one person, the one-off date goes on their row. `applyClosingRules` (F-365) adds the
date to `closedDates` once and drops the business's own one-off hours on it, since a one-off date
opens a closed day; people's own one-off dates stay, as their openings.

`apply-newly-closed-rules.ts` lists the confirmed bookings still to come whose local date is closed
for their person after a write and was not before, each person's closed days being the booking
window's own answer, so a booking of someone the day is opened for is not listed. `weekdayOf`
moved to `weekday-of.ts` from the two copies in the outside-hours and free-times rules, and
`businessHoursInputOf` out of `resolve-bookable-hours.ts`, so the settings code reads the business's
row the same way.

### reads, writes and routes (`backend/lib/settings/`, `routes/settings-routes.ts`)

`GET /settings/days-off` (any member) is `find-days-off.ts`: the closed dates from today on, the
three holiday columns, the closed days with who each is opened for, the active people, and
`unknownHolidays`. Every write goes through one place, `write-days-off.ts`: it reads the business's
hours row `for update`, as 12a's hours save does, reads each person's hours and the upcoming
bookings, applies the change, writes the four closed-day columns and the business's one-off dates,
and answers the page's new state with `newlyClosed` in 12a's listed row. `close-day.ts` is
`POST /settings/days-off/close` (F-365: closing used to ride on the PUT with the page's whole list,
which could not close a day the business had opened on Hours), and `save-holiday-picks.ts` is the
PUT, which since F-376 takes only the three holiday fields and writes the saved closed dates and
hours back unchanged, so a page loaded before a day was closed elsewhere never opens it again.
`open-closed-day.ts` (`POST /settings/days-off/open`) locks the business's row first, then the
person's hours row; their resource row is read without a lock, since their own hours save holds it
and then waits on the business's row. A person of another business, a place, someone turned off or
an unknown id are all one 404. `refuse.ts` gained `not_closed` and `no_usual_hours`. A business
with no hours row answers `409 no_business_hours` on every write, and the page says to set hours
first.

`GET /settings/days-off/holidays` is `find-holiday-choices.ts`: the three countries always, and with
a country its provinces and its statutory holidays from today to a year ahead on the business's
clock (UTC before its hours are set), one per name with every date it falls on. A country not
offered or an unknown province is a 400 on its field. The PUT checks its picks with
`refuse-holiday-picks.ts`, which uses the same lists and `unknownHolidayPicks`, and answers 400 on
`closedHolidays` naming the first pick the list does not have.

### the owner's cancel (`backend/lib/booking/`, `routes/bookings-routes.ts`)

`POST /bookings/cancel` sits in a new `bookings-routes.ts`, mounted in `app.ts` behind the dashboard
CORS, CSRF and no-store middleware, so the lead page and 12b can reuse it.
`cancel-bookings-by-owner.ts` first checks every id is a booking of the session's business; one
stranger refuses the whole list with a 404 and nothing is cancelled. It then cancels one at a time,
each in its own transaction as the customer's cancel is, so one that fails midway leaves the rest as
they were and a press again finishes them; the answer sorts the ids into cancelled, already
cancelled and already started. `cancel-booking.ts` gained the owner's form (decision 6): the
booking is looked for inside the session's business, the timeline entry names the login, and only
the customer's email is queued, not the business's notification, since the owner knows what they
did. Everything else is the customer's cancel unchanged: the time freed, the booked person's text,
the Google event out.

The customer's email says who cancelled (F-370, wording agreed by Frank on 2026-10-11).
`send-cancellation-emails.ts` already read the cancel's timeline entry for its stamp; it now also
reads its login, and `renderBookingCancelled(facts, byBusiness)` opens "{business} had to cancel
your booking." when there is one, while the customer's own cancel keeps "Thanks for letting us
know". `email-preview.ts` renders both. The listed row gained `customerHasEmail` (F-371), read from
the contact without sending the address, so the page can say who is not told.

### the holiday package (`backend/lib/bookable-hours/holiday-package.ts`)

The only file that imports `date-holidays`, behind one object. It offers Canada, Colombia and the
United States only (Frank, 2026-10-11), and uses statutory holidays only: the package's `public`
type, a day people do not work by law (Frank, 2026-10-11, settling F-379). With a province, the
province's own list stands alone, since the package already carries the national holidays the
province keeps under its own names and dates; without one, the country's. The first fix took the
province's entry where both had one and let the country fill in the rest, which added back the
very national days a state drops (Alabama listed two holidays on one Monday, California listed
Columbus Day); the final review reopened it, and the province's list alone is what fixed it.
Observances, optional days and school terms are left to "+ Close a day". A country or province the
package does not know gives no holidays, rather than the national list the package would quietly
use.

`closed-holidays.ts` no longer throws on a pick the package lacks (decision 8, F-32): it closes
nothing for that name and the other picks still close. `unknown-holiday-picks.ts` is the one
definition of "gone", shared by the page, the save's check and the booking window's log line in
`resolve-bookable-hours.ts`: a pick the lists have in no year from this one to ten years ahead
(`namesFrom`). A pick that only skips the coming year, such as a US substitute day or Election
Day, is kept (F-375: the step's first version read "known" off the one-year list, so such a pick
would have been shown as renamed, refused on save and logged). Each year's list and each ten-year
name set is worked out once per server run (F-377), since a booking-window read resolves the hours
once per person; measured locally, the first read about 55 ms, later ones about 0.1 ms.
`holiday-choices.ts` turns the list into the picker's entries, one per name, soonest first.

### frontend

`app/(dashboard)/settings/days-off/page.tsx` adds Days off to the section list in
`settings-frame.tsx`. `days-off-screen.tsx` shows every closed day for the coming year with its
holiday name and who it is opened for, one form open at a time, and the keyboard returned to the
button that opened it. `close-day-form.tsx` focuses its date field, refuses a past day, a day
already closed and, since F-369, a day beyond the year the list shows. `open-day-form.tsx` offers
Everyone and the active people it is not already open for, and focuses its radio group when it
opens (F-367). After a close or a holiday save, `closed-day-bookings.tsx` lists the bookings left
on a closed day, each linking to its lead, with Cancel on each and Cancel all. Each asks first, in
place, with the focus on the safe answer, and says who is told: "{name} gets the cancellation
email." or that a customer who left no email is not told and should be called (F-371). Cancel all
sends its ids in parts of 100, the API's cap (F-373), and a refusal or a booking already started
is named; the heading takes the focus after every press (F-372). The list stays until the next
change on the page, so the owner can work through it.

`holiday-picker.tsx` has the country and province pickers, nothing picked to start with
(decision 30), the statutory holidays with their dates, a tick each, and "Close them all". A new
country clears the picks; a new province keeps only the picks its list has. It reads the countries
on their own (F-378), so a saved country or province no longer offered shows as its own option and
can be changed. A saved pick in `unknownHolidays` is listed under "No longer in the holiday list"
to untick, one that only skips the coming year under "Picked, not in the coming year". A failed
read is announced with "Try again" (F-381). The API calls are `fetch-days-off.ts`,
`fetch-holiday-choices.ts` and `save-days-off.ts` in `lib/api-client/settings/`, and
`lib/api-client/bookings/cancel-bookings.ts`. A role that may not change the business sees the page
read-only, as 12a.

### shared schemas

`close-day-validation-schema.ts` and `open-closed-day-validation-schema.ts` (strict, a real date,
`personId` null for everyone) sit with the availability schemas, and
`cancel-bookings-validation-schema.ts` (1 to 100 ids, no repeats) with the booking ones, all
exported from the index. `holidayPicksValidationSchema` is the PUT's body, the three holiday fields
picked from the business rule's fields, strict, sharing the two "needs its country" checks with the
business rule. The days off schema the PUT no longer took was removed at the final review (F-382);
`DaysOffType` is now a plain `Pick` of the business rule's type, used by the read and the write.

### seed

Summit's holiday set is renamed `albertaStatutoryHolidays`, still Alberta's nine, as if the owner
pressed "Close them all". Riverbend no longer picks National Day for Truth and Reconciliation, which
is not statutory in Alberta and would now be named as gone.

### tests

Unit tests carry the Simulate names: `apply-opening-rules.test.ts` (a closed day is closed for
everyone; opened for Ana, open for her only on her usual Monday; opened for everyone on the
business's hours; a picked holiday opened for everyone is open that year only; no usual hours
cannot be opened; the year past the horizon), `apply-newly-closed-rules.test.ts`,
`holiday-choices.test.ts` (Alberta's nine, a state's own list deciding, the three countries),
`unknown-holiday-picks.test.ts`, and in `apply-bookable-hours-rules.test.ts` two cases that replace
the old ones (a renamed pick is skipped, where it used to throw; a day not statutory where the
business is closes nothing, where a national-only pick used to close). Route tests in
`settings-routes.test.ts` cover permissions, another business's person, the holiday save keeping
the closed days and hours, a close listing its bookings and an opening for Ana alone, a holiday save
listing the bookings it closes, the holiday list, and a pick refused on save.
`bookings-routes.test.ts` covers another business's booking refusing the lot, the owner's cancel
(time freed, owner recorded, customer email and worker text queued, no business notification) and
a started booking named. The email tests check both first lines. At the end: backend 966 tests,
shared 174, booking component 79, and the frontend builds and lints; the frontend has no test
runner, so the picker's fixes were checked by hand on Summit.

### Carried

F-383 (P3, open): four comments (`holiday-package.ts`, `closed-holidays.ts`,
`find-holiday-choices.ts`, the holidays route in `settings-routes.ts`) and the spec's Goal and step
12e.3 lines still describe the old merged province-and-country list and the main/other split. No
behaviour: every path already uses the one list.

## Findings

### 12e/F-364 [P3] closed - Code comments added by this feature cite step numbers, which the standards keep out of code

**File:** backend/lib/bookable-hours/apply-outside-hours-rules.ts:3; backend/lib/booking/book-time.ts:329; backend/lib/email/find-booking-email-context.ts:35; backend/lib/email/find-booking-email-recipients.ts:3; backend/lib/email/send-booking-emails.ts:3; backend/lib/settings/resource-settings-of.ts:10; frontend/components/settings/change-resource-form.tsx:3; packages/shared/client-setup/run-client-setup.test.ts:257, 288
**Found:** 2026-10-10 by the independent review of feature 12d (scope: current, e1a5d8f..9417aa7; lenses: quality, security, performance, tests)
**Why it matters:** coding-standards.md (Comments) says "No history in code comments (step numbers, finding numbers ...): that lives in the build log." F-363 removed the finding numbers, but this feature also adds nine comments tagged with a step number, `(12d.1)`, `(12d.2)`, `(12d.4)` or `(12d.5)`, for example "the booked person's, read when the email goes (12d.4)". The base has none (searched at e1a5d8f). A step is build history: once merged, `12d.4` means something only to someone who opens the build log, and each sentence already says what the code does without it. The older `(feature N)` and `(decision N)` tags are an established pattern in the base and are not part of this. Naming only, no behaviour.
**Suggested fix:** Drop the `(12d.N)` tags from the nine comments, keeping each sentence (in find-booking-email-recipients.ts:3 keep "which replaces feature 6's decision 11 for a person who has one"; in send-booking-emails.ts:3 also rewrap the line, which runs past 100 characters).
**Resolution:** fixed in step 12e.1: the nine comments keep their sentences without the (12d.N) tags; send-booking-emails.ts rewrapped. Closed 2026-10-10 by independent review of step 12e.1: all nine places read at 080673f, each sentence kept and untagged; `git grep -E "12[a-z]\.[0-9]"` over backend, frontend and packages finds no step tag left; send-booking-emails.ts:3-4 rewrapped, no behaviour touched.

### 12e/F-365 [P3] closed - A closed date opened by the business's one-off hours on Hours cannot be closed again from Days off

**File:** frontend/components/settings/close-day-form.tsx:41; backend/lib/settings/save-days-off.ts:48
**Found:** 2026-10-10 by independent review of step 12e.1 (scope: c40fa2d..080673f; lenses: quality, security, performance, tests)
**Why it matters:** The Hours page still saves the business's one-off dates freely, so a date can be in `closedDates` and also have a business one-off date. The page then shows it "Open for everyone" with no Open again button, and the close form's own check lets it through (`!day.openedForEveryone`). The form sends `[...daysOff.closedDates, date]`, which repeats the date, so the save is refused with "The same closed date is listed twice." under Date. Even with the repeat removed, the server's `added` only counts dates not already in `closedDates`, so the one-off would stay and the day would stay open. The owner has no way to close that day from Days off, and the message does not say why.
**Suggested fix:** Send the list without repeats (a `Set`) from the form, and on the server count a submitted date as newly closed when it was not closed for the business before (not in `closedFor(before, null)`), so its business one-off is dropped as for any other close.
**Resolution:** fixed in the 12e.1 review fixes: closing goes through POST /settings/days-off/close, which adds the date once and always takes back the business's one-off hours on it (applyClosingRules); the PUT writes only the four columns again. Route test, and a hand check on Summit (Oct 30 with its own hours showed Open for everyone, then Closed). Closed 2026-10-10 by independent review of step 12e.2: read at 1812c4a, close-day-form.tsx now posts only `{ date }` to POST /settings/days-off/close, and `applyClosingRules` (apply-opening-rules.ts:92) adds the date once (a Set) and drops the business's one-off on it while people's stay; the PUT keeps `before.dateHours`, which is right for the holiday picker it now serves. The unit case and the route test (settings-routes.test.ts, Monday shown open for everyone, then closed with Tuesday's hours kept) prove it; backend suite 955/955.

### 12e/F-366 [P3] closed - Opening a plain closed date for everyone needs the business's own hours that weekday, and the refusal says nobody works it

**File:** backend/lib/bookable-hours/apply-opening-rules.ts:71; backend/routes/settings-routes.ts:349
**Found:** 2026-10-10 by independent review of step 12e.1 (scope: c40fa2d..080673f; lenses: quality, security, performance, tests)
**Why it matters:** For everyone, `applyOpeningRules` checks the business's week before it knows whether anything needs windows. A date the business closed only leaves `closedDates`, which needs no hours; only a holiday that stays picked needs the business one-off. So a Sunday closed by mistake, at a business whose week has no Sunday but where a person on their own week works Sundays, can never be opened for everyone, and the 409 tells the owner "Nobody works that weekday here", which is false for that person. The workaround (open it for each such person) works, so this is a wording and reach issue, not a booking fault.
**Suggested fix:** For everyone, refuse with `no_usual_hours` only when the date is still closed after leaving `closedDates` (the holiday case that needs a business one-off). Or, if decision 5 is meant literally for everyone, keep the rule and change the message to "The business does not work that weekday: set that day's hours on Hours, or open it for one person."
**Resolution:** fixed in the 12e.1 review fixes: decision 5 stands (for everyone, the business's week decides), and the message now says "The business does not work that weekday: set that day's hours on Hours." Closed 2026-10-10 by independent review of step 12e.2: settings-routes.ts:374 says "The business does not work that weekday: set that day's hours on Hours.", true under decision 5; the person's message is unchanged. The spec's Errors line still quotes the old text: F-374.

### 12e/F-367 [P3] closed - The Open again form takes no focus when it opens, so the keyboard falls to the page

**File:** frontend/components/settings/days-off-screen.tsx:124; frontend/components/settings/open-day-form.tsx:37
**Found:** 2026-10-10 by independent review of step 12e.1 (scope: c40fa2d..080673f; lenses: quality, security, performance, tests)
**Why it matters:** Pressing "Open again" replaces that day's row content with the form, so the button that had the focus is unmounted and the focus goes to the document body; the next Tab starts from the top of the page. The close form already moves the focus into itself on open (close-day-form.tsx, `dateRef.current?.focus()`), and 12a's pattern returns the keyboard to where the owner was. Keyboard and screen-reader users lose their place on every opening.
**Suggested fix:** On mount, focus the form's radio group (it already has `tabIndex={-1}`) or its heading, as CloseDayForm focuses its date field.
**Resolution:** fixed in the 12e.1 review fixes: the open form focuses its radio group when it opens (checked on Summit: the active element is the radiogroup). Closed 2026-10-10 by independent review of step 12e.2: open-day-form.tsx:39 focuses the `[role=radiogroup]` on mount, and choice-field.tsx:23-24 renders that group with `tabIndex={-1}`, so it takes the focus; no new effect dependencies or loops.

### 12e/F-368 [P3] closed - No test proves the year window the step amended in, so a day closed beyond the booking horizon can drop off again unnoticed

**File:** backend/lib/bookable-hours/apply-opening-rules.test.ts:21; backend/lib/bookable-hours/apply-newly-closed-rules.test.ts:15
**Found:** 2026-10-10 by independent review of step 12e.1 (scope: c40fa2d..080673f; lenses: quality, security, performance, tests)
**Why it matters:** The contract was amended in 12e.1 because the horizon hid a day closed beyond it: `listClosedDays`, `applyOpeningRules` and `applyNewlyClosedRules` all widen the window to `DAYS_OFF_AHEAD` (365). Every fixture date in the unit and route tests lies inside the 60-day horizon, so replacing `DAYS_OFF_AHEAD` with `business.horizonDays` in any of the three still passes every test. That rule would hurt if broken: a closed day past the horizon vanishes from the page, cannot be opened (`not_closed`), and its bookings are not listed when it is closed.
**Suggested fix:** One unit case with a date past `horizonDays` (for example 2027-01-04 with horizon 60): `listClosedDays` lists it, `applyOpeningRules` opens it, and `applyNewlyClosedRules` lists a booking on it.
**Resolution:** fixed in the 12e.1 review fixes: a unit test closes Christmas Eve past a 60-day horizon: listed, opened, its booking listed; it fails with DAYS_OFF_AHEAD set to 60 and passes at 365. Closed 2026-10-10 by independent review of step 12e.2: the new case in apply-opening-rules.test.ts uses 2026-12-24, past the fixture's 60-day horizon (ends December 9) and inside 365; `listClosedDays`, `applyOpeningRules` and `applyNewlyClosedRules` each read `DAYS_OFF_AHEAD`, and replacing it with the horizon in any one of the three fails its assertion (not listed, `not_closed`, or the booking not listed).

### 12e/F-369 [P3] closed - Close a day accepts a date beyond the year the list shows, so the closed day is not shown and a second try is refused as a repeat

**File:** frontend/components/settings/close-day-form.tsx:90
**Found:** 2026-10-10 by independent review of step 12e.1 (scope: c40fa2d..080673f; lenses: quality, security, performance, tests)
**Why it matters:** The date field has `min={today}` but no upper bound, and its check only looks at `closedDays`, which stops a year ahead. Closing a date more than 365 days out says "Closed ..." but the day never appears in the list; closing it again is refused with "The same closed date is listed twice." It does no harm to bookings (the horizon is at most 365 days), but the owner cannot see or undo what they just did.
**Suggested fix:** Add `max` (today plus 365, the page's year) to the field and the same bound to its `validate`, with "Pick a date within the coming year."
**Resolution:** fixed in the 12e.1 review fixes: the date field has max today plus 365, and the check says "Pick a date within a year." Closed 2026-10-10 by independent review of step 12e.2: close-day-form.tsx sets `max={lastDay}` (today plus 365 on the business's clock) and the validate refuses a later date; `closedDaysBetween` includes its last date, so the furthest date the field allows is listed.

### 12e/F-370 [P2] closed - The owner's cancel sends the customer "Thanks for letting us know", for a cancel they did not make

**File:** backend/emails/booking-cancelled.tsx:62; backend/lib/booking/cancel-booking.ts:114
**Found:** 2026-10-10 by independent review of step 12e.2 (scope: 080673f..1812c4a; lenses: quality, security, performance, tests)
**Why it matters:** The owner's cancel queues the customer's own `booking_cancellation` email unchanged, and its first line is "Thanks for letting us know, Maria." When the business cancels because it closed the day, Maria told nobody anything: she gets an email thanking her for a cancellation she did not make, with no word that the business cancelled it. That reads as a mistake (or as someone else cancelling for her) and invites a confused call. The page even says so to the owner (closed-day-bookings.tsx:104, "each customer is told as if they had cancelled"). The spec says "the customer's email" unchanged, but decision 6 only covers the business notification; the customer-facing wording for an owner's cancel was never decided.
**Suggested fix:** Carry who cancelled into the email (for example read the cancel's timeline entry's `actorUserId`, which sendCancellationEmails already queries for its stamp, or a flag in the job payload) and render "{business} has cancelled your booking" without the thanks for an owner's cancel; or raise it with Frank as a spec amendment if the current wording is meant.
**Resolution:** fixed in the 12e.2 review fixes, wording agreed by Frank 2026-10-11: sendCancellationEmails reads the cancel's timeline login with its stamp, and `renderBookingCancelled(facts, byBusiness)` opens "{business} had to cancel your booking." when there is one; the customer's own cancel keeps "Thanks for letting us know". Tests: booking-emails.test.ts "thanks the customer who cancelled, and says so when the business cancelled"; send-cancellation-emails.test.ts "the customer's cancel thanks Jane; the owner's says the business cancelled". Spec amended. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): booking-cancelled.tsx:73 opens "{business} had to cancel your booking." only when send-cancellation-emails.ts:62 finds a login on the cancel's timeline entry, which only the owner's form records (cancel-booking.ts:108); the customer's own cancel keeps the thanks. Both named tests pass.

### 12e/F-371 [P2] closed - The confirmation promises the customer an email, but a phone-only customer is told nothing

**File:** frontend/components/settings/closed-day-bookings.tsx:109, 143; backend/lib/settings/listed-booking.ts:6
**Found:** 2026-10-10 by independent review of step 12e.2 (scope: 080673f..1812c4a; lenses: quality, security, performance, tests)
**Why it matters:** Each question says "Maria gets the cancellation email." A booking can be phone-only (send-cancellation-emails.ts:56 sends the customer's email only when there is one; its test "a phone-only booking's cancel sends only the business's"), and the owner's cancel queues only that email, so a phone-only customer hears nothing at all, while the owner was just told they would and has no reason to call. The customer then turns up on a closed day. `ListedBookingType` carries no contact detail, so the page cannot tell.
**Suggested fix:** Add whether the customer has an email to the listed row (a boolean, or the phone for the no-email case) and word the question per booking ("Maria has no email: call her at ..."), and in Cancel all name how many will not be told.
**Resolution:** fixed in the 12e.2 review fixes: listed rows carry `customerHasEmail`; each question says "{name} left no email, so is not told: call them from their lead." and Cancel all names how many are not told. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): listed-booking.ts:23 sets `customerHasEmail` from the contact's email without sending the address; closed-day-bookings.tsx:76-80 words each question by it and Cancel all names how many are not told (123-126).

### 12e/F-372 [P3] closed - A refused cancel closes the question and drops the keyboard to the page

**File:** frontend/components/settings/closed-day-bookings.tsx:42-45, 65
**Found:** 2026-10-10 by independent review of step 12e.2 (scope: 080673f..1812c4a; lenses: quality, security, performance, tests)
**Why it matters:** `cancel` calls `setAsking(null)` before checking the answer, which unmounts the question and its focused button; the heading is focused only on success (line 65), so after a refusal (the API down, a 404, a 500 midway through a list) the focus falls to the document body while the error is announced. Same class as F-367.
**Suggested fix:** Focus the heading in both paths (move `document.getElementById(HEADING_ID)?.focus()` above the early return).
**Resolution:** fixed in the 12e.2 review fixes: the list heading takes the focus on both paths. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): closed-day-bookings.tsx:54 focuses the list heading after every press, before the answer is read, so a refusal no longer drops the keyboard to the page.

### 12e/F-373 [P3] closed - Cancel all on more than 100 listed bookings is refused with no way to cancel all

**File:** frontend/components/settings/closed-day-bookings.tsx:111; packages/shared/zod-validation/booking-links-validation-schemas/cancel-bookings-validation-schema.ts:16
**Found:** 2026-10-10 by independent review of step 12e.2 (scope: 080673f..1812c4a; lenses: quality, security, performance, tests)
**Why it matters:** The server caps a request at 100 ids, but Cancel all sends every listed id and the list is not capped (`newlyClosed` lists every confirmed booking left on the closed days). Over 100, the press answers "Cancel at most 100 bookings at once." and nothing is cancelled, leaving one-by-one cancels. Rare for one day; likelier if 12e.3's holiday save feeds the same list across many dates.
**Suggested fix:** Send Cancel all in chunks of 100 and merge the answers, or hide Cancel all above 100 with a line saying so.
**Resolution:** fixed in the 12e.2 review fixes: Cancel all sends the ids in parts of 100 and merges the answers. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): closed-day-bookings.tsx:43-51 sends Cancel all in parts of 100, merges the three lists and stops at the first refusal, reporting what was cancelled before it.

### 12e/F-374 [P3] closed - The spec's Errors line still quotes the old no_usual_hours message

**File:** blueprint/context/current-feature.md:190
**Found:** 2026-10-10 by independent review of step 12e.2 (scope: 080673f..1812c4a; lenses: quality, security, performance, tests)
**Why it matters:** F-366's repair changed the business's refusal to "The business does not work that weekday: set that day's hours on Hours." (settings-routes.ts:374), but the spec's Errors contract still says "Nobody works that weekday here: set that day's hours on Hours." The spec is the contract later steps and `/complete` read; the two now disagree.
**Suggested fix:** Update the Errors line to the current message.
**Resolution:** fixed in the 12e.2 review fixes: the spec's Errors line quotes the current message. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): the spec's Errors line quotes "The business does not work that weekday: set that day's hours on Hours.", the message settings-routes.ts:408 answers.

### 12e/F-375 [P1] closed - A US holiday that skips the coming year (a substitute day, Election Day) is treated as renamed: shown as gone, refused on save, and logged

**File:** backend/lib/settings/refuse-holiday-picks.ts:22; backend/lib/bookable-hours/unknown-holiday-picks.ts:14; frontend/components/settings/holiday-picker.tsx:112; backend/lib/bookable-hours/holiday-choices.ts:20
**Found:** 2026-10-11 by independent review of step 12e.3 (scope: 5e81b07..ca5748d; lenses: quality, security, performance, tests)
**Why it matters:** "Known" is decided by whether a name falls in a date window, not by whether the package has it. In the United States the package names observed days as their own holidays, typed public: "Independence Day (substitute day)" (2026-07-03, 2027-07-05, then not again until 2032), "Juneteenth (substitute day)" (2027-06-18), "Christmas Day (substitute day)" and "New Year's Day (substitute day)" (2027-12-24, 2027-12-31), and "Election Day" only in election years. Reproduced with the step's built code: on 2026-10-11, `holidayChoices("US", "TX", ...)` lists both 2027 substitutes as main, so "Close all main holidays" ticks them; on 2027-07-06 the picker's list (today to a year ahead) no longer has them, so the page says "No longer in the holiday list. Picked before, these close nothing now. Untick them to save.", every holiday save is refused with "... is not in the holiday list: untick it." until the owner unticks them, and `unknownHolidayPicks` (today to the end of next year, a third window) logs them as unknown on every booking-window read. All three statements are false: the package still knows them and they return. Once unticked, the 2032 observed Independence Day is no longer closed. This is not the renamed-pick case Frank decided on 2026-10-11; it marks a valid pick as renamed for one of the three offered countries. Canada and Colombia showed no such names in 2026 to 2030.
**Suggested fix:** Use one definition of "the package knows this name" for the picker's gone list, the save's check and the log, independent of the one-year display window: for example the names the package lists for that country and province over a span long enough to cover the weekday cycle (today to seven or eight years ahead), computed once and cached. Optionally fold a "(substitute day)" entry into its holiday's dates so ticking "Independence Day" also closes the observed day; that is a product call for Frank. Add a test with a US substitute pick checked a year later.
**Resolution:** fixed in the 12e.3 review fixes, agreed by Frank 2026-10-11: one check for the page, the save and the booking window's log, `unknownHolidayPicks`, which asks whether the holiday list has the name in any year from this one to ten years ahead (`holidayPackage.namesFrom`); a pick that only skips the coming year is kept and shown under "Picked, not in the coming year"; the Days off read answers `unknownHolidays` and the page marks only those. Test: unknown-holiday-picks.test.ts "a holiday that skips the coming year is kept; only a renamed one is gone" (fails with a one-year lookup); the route test checks the read names a renamed pick. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): the page (find-days-off.ts:75, read by holiday-picker.tsx:143), the save (refuse-holiday-picks.ts:24) and the booking window's log (resolve-bookable-hours.ts) all use `unknownHolidayPicks`, which looks a name up over this year to ten years ahead (holiday-package.ts:98). Checked against the built code: on 2027-07-06 `unknownHolidayPicks("US", "TX", ["Independence Day (substitute day)", "Bogus"])` answers only "Bogus". The repair adds no new defect; the named test passes.

### 12e/F-376 [P2] closed - The holiday save sends the page's closed dates, so a day closed elsewhere since the page loaded is silently opened again

**File:** frontend/components/settings/holiday-picker.tsx:124; backend/lib/settings/save-days-off.ts:17
**Found:** 2026-10-11 by independent review of step 12e.3 (scope: 5e81b07..ca5748d; lenses: quality, security, performance, tests)
**Why it matters:** The picker is now the PUT's only caller (the spec moved "+ Close a day" to `POST /days-off/close` in F-365), and it sends `closedDates: daysOff.closedDates` from the page's state, which the server writes as is. Two people with `organization: ["update"]` (the owner and an admin), or one owner in two tabs: one closes Monday, the other, on a page loaded before that, saves the holidays; Monday leaves `closedDates` with no message to either, and customers can book a day the business closed. `POST /days-off/close` already avoids the mirror case by keeping the saved picks (close-day.ts:17).
**Suggested fix:** Have the holiday save write only the three holiday columns and keep the saved `closedDates` (a holidays-only body, or the server keeping `before.closedDates` for this save, as close-day keeps the picks); amend the PUT's contract in the spec to match.
**Resolution:** fixed in the 12e.3 review fixes, agreed by Frank 2026-10-11: the PUT takes only `{ holidayCountry, holidayRegion, closedHolidays }` (`holidayPicksValidationSchema`, strict, so a body with closed dates is refused) and `saveHolidayPicks` keeps the saved closed dates and hours; the picker sends the holidays alone. Test renamed "a holiday save writes only the three holiday columns and keeps the closed days and the hours" (fails when the save empties the closed dates). Spec's PUT contract amended. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): the PUT validates `holidayPicksValidationSchema` (strict, settings-routes.ts:315), save-holiday-picks.ts:16 writes the saved closed dates and hours back unchanged, and the picker sends the three holiday fields only. The renamed route test passes.

### 12e/F-377 [P2] closed - Every booking-window read recomputes up to two years of holidays per person and logs a stale pick once per person

**File:** backend/lib/bookable-hours/resolve-bookable-hours.ts:37-46; backend/lib/bookable-hours/holiday-package.ts:60; backend/lib/scheduling/find-free-times.ts:132
**Found:** 2026-10-11 by independent review of step 12e.3 (scope: 5e81b07..ca5748d; lenses: quality, security, performance, tests)
**Why it matters:** `resolveBookableHours` now runs `unknownHolidayPicks` on every call, which asks the package for every holiday of the province and the country from today to the end of next year (two lists, two years), synchronously. Measured locally against the built code: about 7 ms per call for Alberta's nine picks (and for six US-CA picks), on top of about 2.5 ms for the 60-day `closedHolidays` the rules already run. `findFreeTimes` resolves once for the business and once per person (line 132), so Riverbend's six people cost about 50 ms more blocking CPU per free-times read, and booking and moving resolve again. `getHolidays(year)` is not cached, though a year's holidays never change while the process runs. The warning also fires per resolve, so one booking-window read with a stale pick logs one line per person, not "once per read" as its comment says. Not profiled in production.
**Suggested fix:** Cache `getHolidays` per country, province and year in `holiday-package.ts` (bounded by the package's own places), and check unknown picks once per request or only in the Days off read, logging once per business per read.
**Resolution:** fixed in the 12e.3 review fixes, with F-375: each list's year of holidays and each ten-year name set is worked out once per server run and kept (holiday-package.ts); measured locally, the first read about 55 ms, every later one about 0.1 ms. The log line's comment now says it prints once per person asked about. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): holiday-package.ts keeps each year's list and each ten-year name set per place for the server run, keys bounded by the package's places (a client-supplied place is checked against the offered list before any lookup). Measured against the built code: first `unknownHolidayPicks` call about 33 ms, later calls about 0.001 ms. The once-per-person log line is now what its comment says.

### 12e/F-378 [P2] closed - A saved country or province the list does not offer leaves the picker with no way to change it

**File:** frontend/components/settings/holiday-picker.tsx:67-76, 200-212; backend/lib/settings/find-holiday-choices.ts:33-37
**Found:** 2026-10-11 by independent review of step 12e.3 (scope: 5e81b07..ca5748d; lenses: quality, security, performance, tests)
**Why it matters:** The countries list is only set from a successful read, and the only read on load is for the saved country and province. If those are refused (400 on `holidayCountry` or `holidayRegion`), `countries` stays empty: the Country select has only "No holidays", which it shows while its value is still the saved code, so choosing it fires no change; the province select and the list never render; Save is refused on a field whose control is not on the page, so the focus lands nowhere. Reachable today: a client setup file is checked only by the schema (any two-letter country, any 1-3 character province, availability-rule-validation-schema.ts:39-48), and a package update that drops a province is the same F-32 class decision 8 covers for holiday names, where the agreed answer is "shown on the page to untick", not a stuck form.
**Suggested fix:** Answer `countries` even when the country or province is refused (or read them separately), and show an unknown saved code as its own option ("CA-ZZ, no longer in the list") so the owner can pick another or "No holidays".
**Resolution:** fixed in the 12e.3 review fixes, agreed by Frank 2026-10-11: the picker reads the three countries on their own when it opens; a saved country the list does not offer shows as "MX, no longer offered" with "Pick a country from the list." under it, and a saved province as "ZZ, no longer in the list" with the country's own list read to pick another from; the province picker shows whenever a province is saved. The saved "no longer in the holiday list" marks hold only while the saved country and province are still picked. Checked by hand on Summit with MX and with CA-ZZ, each changed back to Canada and Alberta from the page; the frontend has no test runner. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): holiday-picker.tsx:68-78 reads the countries on their own, a saved country not offered shows as its own option (252-254) and a saved province likewise (275-277) with the country's list read in its place (86-88), so "No holidays" or another country can be picked and saved. Checked by reading; the frontend has no test runner.

### 12e/F-379 [P3] closed - A national holiday the province demotes or moves still counts as main, and can be listed twice or with two dates

**File:** backend/lib/bookable-hours/holiday-choices.ts:24
**Found:** 2026-10-11 by independent review of step 12e.3 (scope: 5e81b07..ca5748d; lenses: quality, security, performance, tests)
**Why it matters:** `main ||=` takes the country's type over the province's. With the step's code: US-CO "Columbus Day" is an observance in Colorado but main (the national type); US-GA "Washington's Birthday" carries 2026-12-24 (Georgia's date) and 2027-02-15 (the national one), so ticking it closes both; US-AL lists "Martin Luther King Jr. Day" and "Robert E. Lee/Martin Luther King Birthday" as two main holidays on 2027-01-18. "Close all main holidays" therefore closes days the state does not treat as public. Canada is barely affected (only the observance National Day for Truth and Reconciliation, and Newfoundland's Canada Day). Merging both lists is the spec's design; which list decides "main" was not stated.
**Suggested fix:** When a province is picked, take `main` from the province's own entry when it has one; raise the national-only and two-date cases with Frank as a spec note rather than change the merge silently.
**Resolution:** fixed in the 12e.3 review fixes, decided by Frank 2026-10-11: with a province, the package's province list (which already carries the national holidays it keeps) decides each holiday it names, its type and date; the country's list adds only names the province lacks (holiday-package.ts `holidaysOfPlace`). Colorado's Columbus Day is listed, not main; Georgia's Washington's Birthday is December 24 only. Test: holiday-choices.test.ts "a state's own list decides a holiday it has; the country's fills in the rest" (fails with the old merge). Spec amended. Reopened 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): the original defect is still there. The package's province list already carries every national holiday the province keeps and leaves out or renames the ones it does not, so "the country's list adds only names the province lacks" (holiday-package.ts:62-63) adds back exactly the national holidays the state dropped or renamed, typed public. Checked against the built code for 2026-10-11 to 2027-10-11: US-AL still lists "Martin Luther King Jr. Day" and "Robert E. Lee/Martin Luther King Birthday" as two main holidays on 2027-01-18, the very example above; US-CA lists Columbus Day as main though California's list leaves it out, so "Close all main holidays" closes October 12 there (also DE, FL, HI, NC, NV); about thirty states list "Washington's Birthday" as a second main holiday beside their own name for that day; CA-NL lists Canada Day and Memorial Day as two main holidays on July 1. Alberta (the current tenants' province) and Quebec are unaffected. The Colorado and Georgia cases are fixed. Suggested fix: with a province, use the province's list alone, which is what the resolution's own premise describes; that changes the rule written in the spec and the holiday-choices.test.ts line that expects Georgia's re-added "Christmas Eve", so it is Frank's call. Fixed again at the final review, decided by Frank 2026-10-11: only statutory holidays are used anywhere (the package's public ones, holiday-package.ts), and with a province its own list stands alone, with no national fill-in. Colorado and California no longer list Columbus Day, Alabama lists one holiday on January 18, Newfoundland one on July 1; Alberta lists exactly its nine. Tests: holiday-choices.test.ts "Alberta's year: its nine statutory holidays..." and "a picked state's own list decides..." (each fails with its rule broken); apply-bookable-hours-rules.test.ts "a day that is not statutory where the business is closes nothing, even picked". The Riverbend seed no longer picks Truth and Reconciliation Day. Spec amended. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..e65d66d; lenses: quality, security, performance, tests): holiday-package.ts:57-60 now answers the province's own list alone, or the country's without one, and holidaysOfYear (holiday-package.ts:39-53) keeps only `type === "public"`; the picker (holiday-choices.ts), the save's check and the page's gone list (unknown-holiday-picks.ts through `namesFrom`) and the booking window (closed-holidays.ts) all read through `holidaysBetween`, so none can add a dropped national day back. Checked against the built code for 2026-10-11 to 2027-10-11: Alberta lists exactly its nine; US-AL lists one holiday on 2027-01-18 ("Robert E. Lee/Martin Luther King Birthday"); CA-NL lists only Memorial Day on July 1; US-CO and US-CA have no Columbus Day; `unknownHolidayPicks("CA", "AB", ...)` names Truth and Reconciliation and Heritage Day and keeps Family Day, and `closedHolidays` closes nothing for Truth and Reconciliation in Alberta. Two names on one date remain only where the package's own state list types both public (ME and NM: Columbus Day and Indigenous Peoples' Day; NY, WI, WV: Susan B. Anthony Day on February 15), which the decided rule takes as the package says. The repair adds no new defect; the named tests pass (backend 966/966). Comments the old merge left behind: F-383.

### 12e/F-380 [P3] closed - No test for the unknown-pick log, or for a holiday save listing the bookings it closes

**File:** backend/lib/bookable-hours/unknown-holiday-picks.ts:6; backend/routes/settings-routes.test.ts:1128
**Found:** 2026-10-11 by independent review of step 12e.3 (scope: 5e81b07..ca5748d; lenses: quality, security, performance, tests)
**Why it matters:** `unknownHolidayPicks` has its own logic (a window to the end of next year, every name unknown without a country, nothing for an unknown province) and decision 8's one log line rests on it, but no test calls it or `resolveBookableHours` with a stale pick. The step's story ends "Thanksgiving's booking is listed", yet no test saves a holiday pick over a booking and checks `newlyClosed`; the 12e.1 tests list bookings for closed dates only. A regression in either would pass the suite.
**Suggested fix:** A unit test for `unknownHolidayPicks` (a known, a stale and a not-this-year pick, per F-375), and a route test that picks Thanksgiving over a booking on that day and expects it in `newlyClosed`.
**Resolution:** fixed in the 12e.3 review fixes, as a gap in the agreed tests: unknown-holiday-picks.test.ts covers the check behind the log line, the save and the page (with F-375), and settings-routes.test.ts "a holiday save lists the bookings left on the holidays it closes" books Robin on the next Remembrance Day and sees the save list it (fails when the save drops the picks). Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): unknown-holiday-picks.test.ts tests the one check behind the log, the save and the page (a renamed pick, a substitute day, no country, an unknown province), and settings-routes.test.ts "a holiday save lists the bookings left on the holidays it closes" saves Remembrance Day over Robin's booking and expects her in `newlyClosed`. Both pass.

### 12e/F-381 [P3] closed - A failed holiday list read is shown but not announced, and is never retried

**File:** frontend/components/settings/holiday-picker.tsx:238, 66-85
**Found:** 2026-10-11 by independent review of step 12e.3 (scope: 5e81b07..ca5748d; lenses: quality, security, performance, tests)
**Why it matters:** `loadError` is a plain paragraph, so a screen reader user who picks a country while the API is down hears nothing and finds no list; the Settings pattern announces failures (SaveNotice's alert). The read reruns only when the country or province changes, so the owner must switch away and back to try again.
**Suggested fix:** Render the read failure with `role="alert"` (or through SaveNotice), and offer a "Try again" that reruns the read.
**Resolution:** fixed in the 12e.3 review fixes, as the spec's announced-failure rule: a failed read is shown in a `role="alert"` region with a "Try again" button that reads the lists once more. The frontend has no test runner; checked by reading and by the page loading normally. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): holiday-picker.tsx:289-304 shows a failed read in a `role="alert"` region with "Try again", which bumps `attempt` so both reads (68-78 and 80-110) run again. Checked by reading; the frontend has no test runner.

### 12e/F-382 [P3] closed - The days off schema the PUT no longer takes is kept, only for its type

**File:** packages/shared/zod-validation/availability-validation-schemas/availability-rule-validation-schema.ts:100-105, 130-131
**Found:** 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests)
**Why it matters:** Since the holiday save takes only the three holiday fields, `daysOffValidationSchema` validates nothing anywhere: no route, form or test parses with it, and `DaysOffInputType` is not imported at all. Its comment still calls it "The Days off page's closed days and holidays", which reads as the save's body and contradicts `holidayPicksValidationSchema` beside it. Only `DaysOffType` is used, as the shape of the four saved columns in find-days-off.ts and write-days-off.ts. A reader looking for what the PUT accepts finds two schemas and has to trace which one is live. Naming and dead code only, no behaviour.
**Suggested fix:** Drop `daysOffValidationSchema` and `DaysOffInputType`, and declare the four-column shape where it is produced (for example `DaysOffSettingsType` built from `HolidayPicksType & { closedDates: string[] }` in find-days-off.ts).
**Resolution:** fixed at the final review: `daysOffValidationSchema` and `DaysOffInputType` are removed; `DaysOffType` is now a plain `Pick` of the business rule's type, used for the read and the write. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..e65d66d; lenses: quality, security, performance, tests): availability-rule-validation-schema.ts no longer declares `daysOffValidationSchema` or `DaysOffInputType`, and `git grep` finds no reference to either in backend, frontend or packages; `DaysOffType` (lines 123-127) is a `Pick` of `BusinessAvailabilityRuleType` used only by find-days-off.ts and write-days-off.ts; the PUT validates `holidayPicksValidationSchema` alone. Backend build, every test suite and the frontend build pass.

## Independent review

**Status:** passed
**Target commit:** e65d66d1dbddc8de76697f1631b09d16c0277e07
**Base commit:** c40fa2d7fa97eaae790fef29f6911472f9641d0d
**Base ref:** main
**Spec hash:** a287eaf6aa85893975a563fbabe9e61003d0a97998edc0b046bc6767265d55f7
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-11T19:41:36Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-11T19:45:15Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `c40fa2d7fa97eaae790fef29f6911472f9641d0d..e65d66d1dbddc8de76697f1631b09d16c0277e07` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `npm run test --workspace=@scheduleads-app/shared`: pass (23 files, 174 tests)
- `npm run test --workspace=backend`: pass (88 files, 966 tests, against local scheduleads_dev)
- `npm run test --workspace=@frankdmosquera/booking-component`: pass (16 files, 79 tests)
- `npm run build --workspace=backend`: pass
- `npm run lint --workspace=frontend`: pass
- `npm run build --workspace=frontend`: pass
- `/check`: not run (not required by the request)

### Evidence

- Phase B step 1: HEAD e65d66d1 equals the target; `git merge-base main HEAD` is c40fa2d7; current-feature.md SHA-256 matches; only blueprint/context/review.md differs from the target. The untracked blueprint/ai-voice-proposal.md is the owner's private note, outside the work, and was left untouched.
- Whole delta read: 66 files, nine commits (080673f to e65d66d): days off routes and rules, the owner's cancel (bookings-routes.ts, cancel-booking.ts, cancel-bookings-by-owner.ts, the cancellation email), the holiday package, picker, save check and unknown-pick check, the frontend Days off screen and its forms, schemas and the seed.
- Statutory-only rule (Frank, 2026-10-11) traced: every holiday read goes through `holidayPackage.holidaysBetween`, whose `holidaysOfYear` keeps only `type === "public"` and, with a province, uses its own list alone; the picker (holiday-choices.ts), the save check and the page's gone list (unknown-holiday-picks.ts via `namesFrom`), and the booking window (closed-holidays.ts via closed-days-between.ts) share it. The seed picks Alberta's nine for Summit and three statutory days for Riverbend.
- Built-code probe (backend/dist, 2026-10-11 to 2027-10-11): Alberta nine; US-AL one holiday on 2027-01-18; CA-NL one on July 1; no Columbus Day in US-CO or US-CA; Truth and Reconciliation and Heritage Day unknown in Alberta and closing nothing; a Texas substitute day still known on 2027-07-06.
- Security: every new dashboard route sits under the dashboard CORS, CSRF and no-store middleware, takes the business from the session, and writes behind `organization: ["update"]`; the cancel checks every id against the session's business before cancelling any, and `cancelBooking` filters on it again; the holiday caches are keyed only by places the package knows.
- No focused or skipped tests, no em dashes and no step or finding tags in the added code.

### Findings

- F-379 [P3] closed: the province's own list now stands alone and only statutory holidays are used, on every path.
- F-382 [P3] closed: the unused days off schema and input type are gone; `DaysOffType` is a plain Pick.
- F-383 [P3] open (new): four comments and the spec's Goal and step 12e.3 lines still describe the merged province-and-country list and "Close all main holidays".
- No P0 or P1 finding is open or fixed.

### Remaining risk

- `/check` was not run (not required); the frontend has no test runner, so the picker's behaviour was checked by reading and by the build only.
- A business saved before this feature with a pick that is not statutory where it is (for example Truth and Reconciliation in Alberta) now closes nothing on that day; the Days off page lists it under "No longer in the holiday list" and the booking window logs it. Production rows were not inspected.
- The dev seed only adds holiday picks to a business that has none, so a scheduleads_dev seeded before this commit may still carry Riverbend's old Truth and Reconciliation pick until it is rebuilt.
- Where the package's own state list types two names public on one date (ME and NM Columbus and Indigenous Peoples' Day; NY, WI, WV Susan B. Anthony Day on February 15), both are listed, as the decided rule takes the package's word.
