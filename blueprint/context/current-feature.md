# Feature: Hours

**From build-plan:** feature 12a

**Size:** heavy - two separate risks with real logic: saving a business's and each person's hours (permissions, tenant scope, keeping the fields 12e owns), and finding the bookings a change leaves outside (times across time zones and clock changes).

**Branch:** feature/12a-hours

## Goal

The owner sets, on a new `/settings` page, when customers can book: the
business's week with several windows a day, its one-off dates, how much notice
it needs, how far ahead customers can book and its time zone; and for each
person, whether they follow the business's week or keep their own, plus their
own one-off dates. Saving never touches a booking: it keeps every one and lists
the upcoming bookings that fitted the old hours and no longer fit the new ones.
After this, nobody edits `availability_rule` or a setup file to change hours.

## Design reference

`prototypes/settings.html`, the "When you take bookings" card: one row per
weekday with an on/off switch, its windows as chips with a remove button and
"+ Add", the time zone as a tag in the card head, notice under the week. Its
"Gap between jobs" field is not built: buffers are per service since version 8
(12d). The page's section list (Hours, Services, Crews, Days off, Calendar,
Brand) gets only Hours now; each later sub-feature adds its own section.
Shared tokens come from `prototypes/theme.css`, already ported.

## In scope

- `/settings` in the dashboard, with "Settings" in the dashboard nav, holding
  one section now: Hours.
- The business's hours card: the week (each day off, or one or more windows),
  one-off dates (a date and its windows), notice, how far ahead (1 to 365
  days), time zone. One Save for the card.
- One card per active person of the business: "Follows the business's week"
  or "Own week" (edited like the business's), and their own one-off dates. One
  Save per card.
- A business with no hours yet (made on `/admin/client-setup`, no setup file
  applied): the business card opens empty to set them; people cards wait until
  the business's hours exist.
- Read-only for a member whose role may not change the business.
- Every save answers with the upcoming bookings it left outside the hours
  (step 12a.2), shown under the card with a link to each lead.
- The warning rule's Simulate page, published with this spec.

## Out of scope

- Closed days, reopening a day, the holiday picker and F-32 (12e). The save
  never reads or writes `closedDates`, `holidayCountry`, `holidayRegion` or
  `closedHolidays`.
- Services, buffers, people and places, who does what, work emails, and the
  warning when a service's length changes (12d).
- The booking form (12f), texts (12g), the calendar connection and picking
  busy calendars (12h). The calendar and email cards stay on the Setup screen.
- Hours for places: bookable hours are per person (the build plan).
- Opening hours for the public (not planned yet).
- Moving or cancelling a booking from the warning: the owner opens the lead;
  moving by hand is 12b.
- TanStack Query (feature 14, feature 11's decision 2).

## Build loop

Approved one step at a time (AGENTS.md). Heavy: `workflow.stepReview` is
`every`, `checkpointCommits` enabled. After a step's plan has Frank's yes,
nothing stops until the review: build, tests and checks, tick the box, write
the build log entry and commit it to buildlogs, commit and push the step to
`feature/12a-hours`, `/audit` scoped to the step, then the independent review.
The planned stop is after the review. Blocking findings (P0/P1) are fixed by
default; P2/P3 are recorded and carried. `/complete` makes the final pass and
merges on Frank's yes.

## Build steps

- [x] **12a.1 The owner sets the hours.** "I open Settings, change Tuesday to
  two windows, save, and the booking window offers the new times."
  - Shared: `businessHoursValidationSchema` (week, one-off dates, time zone,
    notice, how far ahead; strict) and `personHoursValidationSchema` (own week
    or null, one-off dates; strict), derived from the existing
    `businessAvailabilityRuleValidationSchema` and
    `personAvailabilityRuleValidationSchema` so the rules live once.
  - Backend: `backend/routes/settings-routes.ts` mounted at `/settings` behind
    the dashboard CORS, CSRF and no-store middleware, and the `booking` module.
    `GET /settings/hours` (any member), `PUT /settings/hours/business` and
    `PUT /settings/hours/people/:personId` (both
    `requirePermissionMiddleware({ organization: ["update"] })`). The functions
    behind them in `backend/lib/settings/`.
  - The business save creates the business's row on its first save (with
    `closedDates: []` and no holidays) and afterwards updates only its five
    columns, so 12e's fields stay as they are. The person save upserts the
    person's row; switching back to the business's week saves `weeklyHours:
    null` and keeps their one-off dates. Rows are never deleted here.
  - New refusal code `no_business_hours` (409) for a person's save while the
    business has none.
  - Frontend: "Settings" in `dashboard-shell.tsx`'s nav, `app/(dashboard)/settings/page.tsx`,
    components in `frontend/components/settings/`, calls in
    `frontend/lib/api-client/settings/` through `dashboardApiClient`. The
    week editor is one component used by the business card and every
    own-week person card.
  - Check while building: that no code reads a place's `availability_rule`
    row (resolve-bookable-hours and the free-times code read people only).
  **Done when:** the backend tests below pass; and by hand, signed in as
  `admin@example.com` on Summit Painting (dev), Tuesday changed to 9:00-12:00
  and 1:00-5:00 and saved shows the new windows after a reload, and
  `/admin/booking-preview/painting-dev` offers starts only inside them; one
  person switched to an own week is offered on their own hours there; a
  business made fresh on `/admin/client-setup` opens an empty hours card with
  how far ahead at 30 days, refuses a save without a time zone or notice, and
  after its first save shows the saved hours on reload. The seed has no login
  without the permission, so the read-only screen and the 403 are proved by
  the route test's own member login, and the screen reads `canEdit` only.

- [ ] **12a.2 Saving lists the bookings that now fall outside.** "I shorten
  Tuesday to end at 3:00, save, and I am told Maria's Tuesday 4:00 booking now
  sits outside the hours; it is still booked."
  - `backend/lib/bookable-hours/apply-outside-hours-rules.ts`, no database:
    given the hours before the save, the hours after, and the upcoming
    bookings, it returns the bookings that fitted before and do not fit after.
  - Fits: the appointment (`startsAt` to `endsAt`, never its buffers, as free
    times decides) lies inside one window of that person's hours on its local
    date in the business's time zone, compared as real moments the way
    free times does, so a clock change cannot stretch or shrink a window. The
    person's windows for a date follow `applyBookableHoursRules`' merge: an
    own week takes only the person's one-off dates; someone following the
    business also gets the business's one-off dates, their own winning on the
    same date; a one-off date replaces that day's week. Notice, how far ahead,
    closed dates and holidays are not part of it: they only limit new
    bookings, and closed days are 12e's.
  - Upcoming means `status = 'confirmed'` and `startsAt` after now (now a
    parameter, as everywhere in scheduling). The business's save checks every
    person's upcoming bookings (a time zone or one-off date can move anyone);
    a person's save checks only theirs.
  - The save reads the old rows `for update` inside the same transaction as
    the write, so the list compares against exactly what it replaced.
  - Both saves' answers gain `outsideHours`; the card shows the list under
    its Save, each row the customer, service, person and local time, linking
    to `/leads/[leadId]`, with "Still booked. Open a booking to call the
    customer." The list stays until the card is saved again or the page left.
  **Done when:** the Simulate page's cases pass as saved tests under the same
  names; and by hand, a Tuesday 4:00 booking made through the booking preview,
  then Tuesday shortened to end at 3:00, lists that booking with a working
  link, the booking is unchanged on its lead page, and saving the same hours
  again lists nothing.

## Files / areas

- `packages/shared/zod-validation/availability-validation-schemas/` (two new schemas, exported from the index)
- `backend/app.ts` (mount `/settings`), `backend/routes/settings-routes.ts`, `backend/routes/settings-routes.test.ts`
- `backend/lib/settings/find-hours-settings.ts`, `save-business-hours.ts`, `save-person-hours.ts`
- `backend/lib/bookable-hours/apply-outside-hours-rules.ts` and its test; `find-upcoming-bookings` read beside the saves (12a.2)
- `backend/lib/errors/refuse.ts` (`no_business_hours`)
- `frontend/components/dashboard/dashboard-shell.tsx`, `frontend/app/(dashboard)/settings/page.tsx`
- `frontend/components/settings/` (settings screen, business hours card, person hours card, week editor, one-off dates editor, outside-hours list)
- `frontend/lib/api-client/settings/` (fetch hours, save business hours, save person hours)

No migration: every column exists.

## Data / contracts

**`GET /settings/hours`** (any member of the business, `booking` module)
`200 { canEdit, business, people }`:

- `canEdit`: the same `{ organization: ["update"] }` check the saves use.
- `business`: `null` when the business has no hours yet, else `{ weeklyHours,
  dateHours, timezone, minimumNoticeMinutes, horizonDays }`.
- `people`: every active person (`resource.kind = 'person'`) of the business,
  by name: `{ id, name, weeklyHours, dateHours }`, `weeklyHours: null` meaning
  "follows the business's week", `dateHours: []` when they have no row.

**`PUT /settings/hours/business`**, body `{ weeklyHours, dateHours, timezone,
minimumNoticeMinutes, horizonDays }`. `200 { business, outsideHours }`.

**`PUT /settings/hours/people/:personId`**, body `{ weeklyHours: WeeklyHours |
null, dateHours }`. `200 { person, outsideHours }`. `404 not_found` "No person
here." for an id that is not an active person of this business (another
business's, a place, unknown: one answer). `409 no_business_hours` "Set the
business's hours first."

**`outsideHours`** (empty in 12a.1, filled from 12a.2): `[{ bookingId, leadId,
customerName, serviceName, personName, startsAt, endsAt }]`, ISO strings,
soonest first. The screen formats the times in the business's time zone with
the shared `booking-time` helper.

**Errors**: 400 `{ error: { code: "bad_request", message }, field }` from the
first Zod issue, `field` its path joined by dots; 401/403 from the existing
middleware ("forbidden" for a role that may not change the business).

**Formats**: minutes from local midnight, 0 to 1440, windows sorted on save,
touching allowed, overlapping refused (existing schema). Dates `YYYY-MM-DD`.
Time zone an IANA name the runtime knows. Notice whole minutes >= 0. How far
ahead whole days 1 to 365.

**Security**: the business always comes from the session, never the request;
every query filters on it first; the person is found by `(organizationId, id,
kind = 'person', active)`. User text (names) is rendered by React as text.

## Testing

Commands: `npm run test --workspace=@scheduleads-app/shared`, `npm run test
--workspace=backend` (local Postgres, migrated and seeded), `npm run build`
and `npm run lint` for the frontend. No Verify command and no browser test
harness exist; hand checks are in each Done when.

One test per rule that would hurt if broken:

- 12a.1: a member without the permission is refused a save; another
  business's person, and a place, get the same 404; a business's first save
  makes its row and a later save keeps its closed dates and holidays; a
  person's save before the business has hours gets 409; switching a person
  back to the business's week keeps their one-off dates.
- 12a.2, named as on the Simulate page: a booking after the new end is
  listed; a booking still inside is not listed; a booking already outside
  before the save is not listed again; moving the time zone lists the bookings
  it pushes out; a person's own week leaves the business's change off their
  bookings; a one-off date that opens the day keeps its booking off the list;
  a booking across the spring clock change is judged on real time; a
  cancelled or past booking is never listed.

## Notes for the AI

- Feature 11's pattern for the screens: client components, fetching through
  `dashboardApiClient` with local state, loading and error states as
  `leads-list-screen.tsx` does; no TanStack Query.
- Forms: react-hook-form directly with shadcn Input, Label, Select, Button;
  never shadcn's Form wrapper. Times with `<input type="time" step="300">`; an
  end of 12:00 am means midnight (1440). Time zone from
  `Intl.supportedValuesOf("timeZone")`. Notice as a number and a unit
  (minutes, hours, days), stored in minutes. No new package.
- Each field's error sits under it, tied with `aria-describedby`; a refused
  save puts focus on the first bad field; the card's saved or failed message
  is announced (`role="status"` / `role="alert"`) and clears on the next edit.
- Nothing is pre-filled except how far ahead (30 days) on a business's first
  hours, as the build plan says; the time zone and notice start empty and are
  required (decision 30).
- Comments beside the line they explain, one or two lines, no history.

## Open questions

None. Every choice above is recorded in the build log's Decisions drawer and
can be overruled at its step's plan.
