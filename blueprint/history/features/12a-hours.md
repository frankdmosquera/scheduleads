# Feature: Hours

**From build-plan:** feature 12a

**Size:** heavy - two separate risks with real logic: saving a business's and each person's hours (permissions, tenant scope, keeping the fields 12e owns), and finding the bookings a change leaves outside (times across time zones and clock changes).

**Branch:** feature/12a-hours

**Status:** verified 2026-10-10: both steps built and reviewed, then a final review of the whole feature; backend 917, shared 172 and booking component 79 tests pass, the frontend builds and lints.

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

- [x] **12a.2 Saving lists the bookings that now fall outside.** "I shorten
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

## Implementation walkthrough

Feature 12a was specced heavy with two steps, one per real risk, and kept them: saving the hours
(permissions, tenant scope, never touching the fields 12e owns), then finding the bookings a
change leaves outside (times across time zones and clock changes). The eight Simulate cases were
published with the spec and became saved tests under the same names in 12a.2. Each step had the
builder's audit, a fresh reviewer and a check of the fixes; a final integration review closed the
feature.

### shared: the two save schemas (12a.1)

`businessHoursValidationSchema` (week, one-off dates, time zone, notice, how far ahead) and
`personHoursValidationSchema` (own week or null, one-off dates) are both strict and built from the
existing `availability_rule` schemas, so a window, an overlap or a date is checked by one rule
everywhere, the setup file included. The date message became "Use a real date, like 2026-11-02."
because the same schema checks the card's empty field and an impossible date in a setup file
(F-321).

### backend: reading and saving the hours (12a.1)

`routes/settings-routes.ts` is mounted at `/settings` behind the dashboard CORS, cross-site and
no-store middleware and the `booking` module. `GET /settings/hours` answers any member with
`canEdit`, the business's hours (null before its first save) and every active person by name.
The two saves need `{ organization: ["update"] }`. The permission question moved out of
`requirePermissionMiddleware` into `lib/auth/has-business-permission.ts`, so the GET's `canEdit`
asks Better Auth exactly what the saves ask, by action and never by role name.
`lib/settings/save-business-hours.ts` upserts the business's row: its first save creates it with no
closed days and no holidays, every later save changes only the five hour columns, so 12e's
settings are never touched and cannot be sent. `save-person-hours.ts` finds the person by
business, id, kind and active, so another business's person, a place and an unknown id are one
404; it refuses with `no_business_hours` (409) while the business has none, and switching back to
the business's week saves `weeklyHours: null` and keeps the person's one-off dates.
`sorted-hours.ts` stores windows and dates in order; `business-hours-of.ts` reads the business's
row and throws on a row missing a setting the database guarantees, rather than showing empty hours.
A 400 carries `field`, the first issue's path, so the cards show a server error in place.

### frontend: the Settings page (12a.1)

"Settings" joined the dashboard nav; `app/(dashboard)/settings/page.tsx` renders
`components/settings/settings-screen.tsx`, which fetches through `dashboardApiClient`, reads 401 as
signed out and 403 as a refusal as the leads screens do (F-323), and shows the business's card,
then one card per person once the business has hours. `week-editor.tsx` is the one week editor for
the business and every own-week person; `day-windows-editor.tsx` draws a day's windows as the
prototype does and is reused for a one-off date; `one-off-dates-editor.tsx`, `notice-field.tsx`
(a number and a unit, kept in minutes) and the time zone select from
`Intl.supportedValuesOf("timeZone")` complete the business card. Every field's error sits under it
with `aria-describedby`; a whole-day error (an overlap, a repeated date, a date with no windows)
marks every field of that day (F-322); `lib/use-focus-first-invalid.ts` moves focus to the first
bad field after the errors draw. A person's switches and windows carry their name for a screen
reader (F-320). Nothing is pre-filled except how far ahead, 30 days, on a business's first hours.

### backend: the bookings a save leaves outside (12a.2)

`lib/bookable-hours/apply-outside-hours-rules.ts` has no database: given the hours before and
after a save and the upcoming bookings, it keeps the confirmed bookings still to come that fitted
before and do not fit after. A person's windows on a date follow the booking window's merge (own
week takes only their own one-off dates; following the business also takes the business's, their
own winning). Fits is the booking window's own test, from `apply-free-times-rules.ts`: the
booking's clock start and length inside a window, and its real end no later than the window's real
end, with the clock count alone when that end is the hour skipped in spring. The first version
moved such an end past the jump and missed a booking the booking window offers (F-330).
`lib/settings/find-upcoming-bookings.ts` reads the business's (or one person's) confirmed bookings
after now with the customer, service and person, every join kept inside the business;
`outside-hours-of.ts` shapes the answer. Both saves now run in one transaction: the business save
holds its row `for update` and reads everyone's rows and bookings before writing; a person's save
locks the person (`for no key update`, so their bookings can still be made) and reads the
business's row `for share`, so the two saves never interleave (F-329). No booking is ever changed.

### frontend: the list under the card (12a.2)

`components/settings/outside-hours-list.tsx` lists, under the card that saved, each booking's
customer (a link to `/leads/[leadId]`), service, person and local time in the business's zone,
with "Still booked. Open a booking to call the customer."; the card's saved message counts them.
Its heading level comes from the card (F-333). The refusal notice the leads screens used moved to
`components/centred-card/refusal-notice.tsx` as `RefusalNotice`, shared by both (F-327).

### tests

Route tests in `routes/settings-routes.test.ts` run the real app against throwaway businesses: a
member without the permission is refused both saves, another business's person and a place get
the same 404, the first save makes the row and later saves keep closed days and holidays (and a
400 names its field), a person's save before the business has hours is a 409, back to the
business's week keeps one-off dates, a save lists the bookings it leaves outside and changes
none, and a person's first own week lists theirs (F-328). The rule has the eight Simulate cases
plus the skipped-hour case, which is built from what the booking window offers and fails on the
first version.

## Findings

### 12a/F-320 [P3] closed - A person's day switches keep the bare day name, so they read the same as the business's

**File:** frontend/components/settings/week-editor.tsx:52-64
**Found:** 2026-10-10 by /audit (scope: current, step 12a.1; lenses: all)
**Why it matters:** The windows and Add buttons on a person's card carry their name ("Marco (estimator), Tuesday, window 1, from"), but the day's checkbox is labelled by its visible text alone, "Tuesday". A screen reader moving through the page hears the business's Tuesday switch and every person's as the same control.
**Suggested fix:** Give the checkbox an aria-label with the same prefix as its windows when `labelPrefix` is set.
**Resolution:** Fixed 2026-10-10: the day checkbox takes the same name as its windows when a prefix is set ("Marco (estimator), Tuesday"). Closed 2026-10-10 by the check of 12a.1's fixes (bbd7510..5fc529c): week-editor.tsx:62 names a person's day switch with their name; the business's keeps its visible label.

### 12a/F-321 [P3] closed - "Pick a date." now answers every bad one-off date, including an impossible one in a setup file

**File:** packages/shared/zod-validation/availability-validation-schemas/date-hours-validation-schema.ts:12
**Found:** 2026-10-10 by /audit (scope: current, step 12a.1; lenses: all)
**Why it matters:** The message was written for the empty date field on the Hours card, but `dateHoursValidationSchema` also checks the setup file (`client-setup-validation-schema.ts:31`), where 2026-02-30 now reports "Pick a date." instead of saying the date does not exist.
**Suggested fix:** A message that fits both: "Use a real date, like 2026-11-02." (the card's empty field still shows it under the date).
**Resolution:** Fixed 2026-10-10: the message is now "Use a real date, like 2026-11-02.", which reads right for the empty field on the card and for an impossible date in a setup file. Closed 2026-10-10 by the check of 12a.1's fixes: date-hours-validation-schema.ts:12 reads "Use a real date, like 2026-11-02."; the old text is gone and no test asserted it.

### 12a/F-322 [P2] closed - An overlap, a repeated one-off date or a date with no windows gets no focus, no aria-invalid and no announcement

**File:** frontend/components/settings/day-windows-editor.tsx:122; frontend/components/settings/one-off-dates-editor.tsx:89; frontend/lib/use-focus-first-invalid.ts:13
**Found:** 2026-10-10 by independent review of step 12a.1 (scope: 86675f7..bbd7510; lenses: quality, security, performance, tests)
**Why it matters:** These three errors sit on the whole list ("weeklyHours.mon", "dateHours", "dateHours.0.windows"), so the editors show them as a plain paragraph tied to no field. No input is marked invalid, so a refused save leaves focus on Save and a screen reader hears nothing; the spec asks for focus on the first bad field and each field tied to its error. An overlapping second window is the most common mistake on the card.
**Suggested fix:** When a day or date carries a list error, mark its inputs invalid and describe them by the message; with no windows left, mark the Add button; for a repeated date, mark the date fields that repeat.
**Resolution:** Fixed 2026-10-10: a day or date error marks every field of that day invalid and describes them by the message (with no windows left, the Add button); a repeated date marks the date fields that repeat. Checked by hand: two overlapping Monday windows on Save put focus on Monday window 1, described by "Two windows on the same day overlap." Closed 2026-10-10 by the check of 12a.1's fixes: day-windows-editor.tsx marks every field of a day with a day error and ties them to its message, the Add button when no windows are left; one-off-dates-editor.tsx marks only the repeating date fields; the new ids do not collide.

### 12a/F-323 [P3] closed - An ended sign-in shows "unexpected status (401)" on Settings, and Try again cannot fix it

**File:** frontend/lib/api-client/settings/fetch-hours-settings.ts:20-24; frontend/components/settings/settings-screen.tsx:47-53
**Found:** 2026-10-10 by independent review of step 12a.1 (scope: 86675f7..bbd7510; lenses: quality, security, performance, tests)
**Why it matters:** The spec says to follow the leads screens, which read 401 as "signed out" with a way back and 403 as a refusal (fetch-leads.ts:27-33). The dashboard reads /me only on mount, so a session that ends between screens lands here on a raw status and a Try again that keeps failing.
**Suggested fix:** Map 401 and 403 as fetchLeads does and show the same notice.
**Resolution:** Fixed 2026-10-10: fetchHoursSettings reads 401 as signed out and 403 as a refusal, as fetchLeads does, and the screen shows the leads screens' notice with the way back to sign in. Closed 2026-10-10 by the check of 12a.1's fixes: fetch-hours-settings.ts:28-35 maps 401 and 403; settings-screen.tsx:50-51 shows the sign-in notice; Try again is left for real failures.

### 12a/F-324 [P3] closed - No test pins the 400's `field`, which the cards use to show an error in place

**File:** backend/routes/settings-routes.test.ts:652-656
**Found:** 2026-10-10 by independent review of step 12a.1 (scope: 86675f7..bbd7510; lenses: quality, security, performance, tests)
**Why it matters:** The refused save only checks the status, so dropping `field` or joining its path differently would pass while every server-side error lost its place on the card.
**Suggested fix:** In the same test, send an overlapping window and expect `field: "weeklyHours.mon"` with code bad_request.
**Resolution:** Fixed 2026-10-10: the first-save test also sends an overlapping Monday and expects bad_request with field "weeklyHours.mon". Closed 2026-10-10 by the check of 12a.1's fixes: settings-routes.test.ts:269-278 asserts the whole 400 with field "weeklyHours.mon".

### 12a/F-325 [P3] closed - The read-only notice names a role ("Only the owner") while the check asks about an action

**File:** frontend/components/settings/settings-screen.tsx:73-75
**Found:** 2026-10-10 by independent review of step 12a.1 (scope: 86675f7..bbd7510; lenses: quality, security, performance, tests)
**Why it matters:** The business's admin role may change the business too (auth-server.ts:65-71), and custom roles later make the wording drift further from what is allowed.
**Suggested fix:** "Your role cannot change the hours. You can see them here."
**Resolution:** Fixed 2026-10-10: the notice reads "Your role cannot change the hours. You can see them here." Closed 2026-10-10 by the check of 12a.1's fixes: settings-screen.tsx:79 asks about what the role may do, not which role.

### 12a/F-327 [P3] closed - Settings shows its refusal through LeadsRefusalNotice, a component named and commented for the leads screens

**File:** frontend/components/settings/settings-screen.tsx:9,51; frontend/components/leads/leads-refusal-notice.tsx:1-2
**Found:** 2026-10-10 by the check of 12a.1's fixes (scope: bbd7510..5fc529c)
**Why it matters:** What it shows is generic, but its name and header say leads, so the naming misleads, and a change made for leads alone would change Settings unnoticed.
**Suggested fix:** Move it to a shared place as `RefusalNotice` with a generic header, used by both screens.
**Resolution:** Carried to step 12a.2, which changes the Settings screen anyway. Fixed 2026-10-10 in step 12a.2: the notice moved to frontend/components/centred-card/refusal-notice.tsx as RefusalNotice, with a generic header, used by the leads list, the lead page and Settings. Closed 2026-10-10 by /audit of 12a.2 (0f33b77..47dc46e): refusal-notice.tsx:1-2 has the generic header, all three screens import it, and no reference to the old name is left in frontend/.

### 12a/F-328 [P2] closed - No saved test proves a save lists anything: the step's whole point is checked by hand only

**File:** backend/routes/settings-routes.test.ts (no `outsideHours` assertion); backend/lib/settings/save-business-hours.ts:31-86; backend/lib/settings/save-person-hours.ts:33-94
**Found:** 2026-10-10 by /audit (scope: current, step 12a.2; lenses: all)
**Why it matters:** The Simulate cases test `applyOutsideHoursRules` alone, with rows built by hand. What feeds it is untested: the old row read before the upsert (moved after it, every list is empty), the person rows map, the joins in `findUpcomingBookings`, the person filter, and the person save's "no old row means follows the business". Any of these broken returns `outsideHours: []`, which the route tests accept, and the owner is silently told nothing moved.
**Suggested fix:** Two route tests on the seeded business, as the step's Done when does by hand: a confirmed Tuesday 4:00 booking, Tuesday shortened to end at 3:00, the answer lists it (bookingId, leadId, names) and the booking row is unchanged; the same save again lists nothing. One more for a person switched to an own week that leaves their booking out.
**Resolution:** Confirmed 2026-10-10 by independent review of 12a.2: `outsideHours` appears in no test file in backend/ (routes or lib/settings); only the pure rule is tested. Stays open. Fixed 2026-10-10: two route tests in settings-routes.test.ts on a business with bookings. "a save lists the upcoming bookings it leaves outside and changes none": Tuesday cut to end at 3:00 lists Maria's 4:00 with its booking, lead, customer, service and person, leaves the booking row identical, skips a cancelled one, one still inside and one of a person on her own week; the same save again lists nothing. "a person's first own week lists their bookings it leaves outside": a person with no row yet moved to an own week lists only the booking it pushes out. Closed 2026-10-10 by the check of 12a.2's fixes (ee7ca97..c689f9b): the first test fails if the old row were read after the upsert (nothing listed), if the person rows were dropped (Lee, on Ana's own 8:00-6:00, would be listed) or if a join lost a name; the second fails if "no row" stopped meaning "follows the business" (Kim would not have fitted before). The Tuesday is found from today in Edmonton, two or more days ahead, with bookings at 10:00 and 4:00, so neither the date nor a clock change can move them. The person filter cannot change a list (another person's before and after are the same rows), so it needs no test. The second test relies on the first's bookings, as its comment says. The new tests leave their business behind, recorded as F-335.

### 12a/F-329 [P3] closed - Each save locks the row it writes but reads the other side unlocked, so two owners saving at once can get a wrong list

**File:** backend/lib/settings/save-business-hours.ts:45-58; backend/lib/settings/save-person-hours.ts:49-58
**Found:** 2026-10-10 by /audit (scope: current, step 12a.2; lenses: all)
**Why it matters:** The business save reads every person's row with a plain select, and the person save reads the business's row the same way and uses it for both before and after. If a person's card and the business's card are saved at the same moment, each list is worked out against the other's old row: a booking can be listed for a person who just moved to an own week, or missed when the time zone changed underneath. Only the notice is wrong, no booking changes, and it needs two saves inside one transaction's time.
**Suggested fix:** Lock the other side too, in the same order in both saves: the business save adds `.for("update")` to the person rows; the person save reads the business row `.for("share")` before locking its own.
**Resolution:** Confirmed 2026-10-10 by independent review of 12a.2, with one addition: a person's own row is unlocked too on its first save, since `for update` on save-person-hours.ts:59-68 locks nothing when the row does not exist yet, so two first saves of the same person (two tabs) both compare against "no row". The suggested lock order holds without a deadlock. A customer booking racing a save is a different path, recorded as F-331. Stays open. Fixed 2026-10-10: the person save locks the person `for no key update` (two saves of one person wait for each other even before a row exists; a booking for them can still be made) and then the business row `for share`, which the business save holds `for update` before it reads anyone's rows, so a business save and a person save never interleave. No lock was added to the business save's person rows: the shared business row already serialises them. Closed 2026-10-10 by the check of 12a.2's fixes (ee7ca97..c689f9b): the person save takes the person, then the business row (share), then its own row; the business save takes only the business row, so neither ever holds what the other waits for: no deadlock. Whichever waits reads after the other commits (READ COMMITTED: a new snapshot per statement, and a waiting `for share` returns the updated row). Two saves of one person queue on the person, row or no row. A booking insert checks its person key `for key share`, which `for no key update` does not block; book-time.ts takes no row lock and touches neither row; move-booking and cancel-booking lock only `booking`. F-331 stays as it was.

### 12a/F-330 [P3] closed - A booking in a window that ends inside the skipped spring hour is offered by the booking window but judged never to have fitted, so it is never listed

**File:** backend/lib/bookable-hours/apply-outside-hours-rules.ts:47-63 (momentOf, fitsHours); backend/lib/scheduling/apply-free-times-rules.ts:58-71
**Found:** 2026-10-10 by independent review of step 12a.2 (scope: 0f33b77..47dc46e; lenses: quality, security, performance, tests)
**Why it matters:** The spec says fits is decided "the way free times does". Free times treats a window end that falls in the skipped hour as absent and lets the clock count decide; momentOf moves it to the first minute after the jump. Run with tsx in a scratch script: America/Denver, 2027-03-14, Sunday 1:00-2:30, a 60-minute service every 30 minutes. Free times offers 08:00Z and 08:30Z (1:00 and 1:30 a.m.); with Sunday then changed to 0:00-1:00 the rule lists only 08:00Z, because the 1:30 booking ends at 3:30 MDT, past the 3:00 moment momentOf gives the end. That booking sits outside the new hours unlisted. The named test "a booking across the spring clock change is judged on real time" cannot see this: neither of its bookings crosses the jump, and a plain local-clock comparison passes it as well. Rare (hours ending between 2:00 and 3:00 a.m.), but it is exactly the clock-change case the step promises.
**Suggested fix:** Make fitsHours use free times' own end rule: when localTimeToMoment returns null for the window end, compare the booking's clock start plus its length against endMinute, as free times does. Add a test with a window ending in the skipped hour, built from what applyFreeTimesRules offers.
**Resolution:** Fixed 2026-10-10: fitsHours now uses free times' own test: the booking's clock start and length inside the window, and its real end no later than the window's real end, with the clock count alone when that end is the skipped hour. New test "a window that ends in the hour skipped in spring is judged as the booking window offers it" takes its bookings from applyFreeTimesRules (Denver, 2027-03-14) and expects both listed; it fails on the old rule. The eight Simulate cases still pass. Closed 2026-10-10 by the check of 12a.2's fixes (ee7ca97..c689f9b): with ee7ca97's apply-outside-hours-rules.ts put back, the new test fails (1 failed, 8 passed), and passes again restored. A scratch script compared the two on 31,752 windows (every 30-minute window up to 1440, 30/60/90-minute services, spring and autumn days in Denver, London, Santiago, Havana and Lord Howe, plus an ordinary day): every start free times offers fits, and the only starts that fit without being offered are in the second pass of the repeated autumn hour, which free times never offers (localTimeToMoment takes the first) and the old rule also judged inside. Windows ending at 1440 and changes at midnight agree.

### 12a/F-333 [P3] closed - On the business card the list's h4 follows the "One-off dates" h3, so the heading outline files it under one-off dates

**File:** frontend/components/settings/outside-hours-list.tsx:20; frontend/components/settings/business-hours-card.tsx:141
**Found:** 2026-10-10 by independent review of step 12a.2 (scope: 0f33b77..47dc46e; lenses: quality, security, performance, tests)
**Why it matters:** The business card is h2 "When you take bookings", then h3 "One-off dates", then the list's fixed h4. A screen reader user moving by headings hears the outside list as part of One-off dates. On a person's card (h3 name, h4 one-off dates, h4 list) the level is right.
**Suggested fix:** Let the card pass the heading level (h3 on the business card, h4 on a person's), or render the title as a level the caller picks.
**Resolution:** Fixed 2026-10-10: OutsideHoursList takes its heading level from the card, h3 on the business card and h4 on a person's. Closed 2026-10-10 by the check of 12a.2's fixes (ee7ca97..c689f9b): business-hours-card.tsx:235 passes h3, a sibling of "One-off dates" (h3) under the card's h2; person-hours-card.tsx:163 passes h4 under the name's h3; the prop allows only those two levels, and the frontend builds and lints clean.

### 12a/F-335 [P3] closed - The settings route tests leave their booked business, with its bookings, in the dev database on every run

**File:** backend/routes/settings-routes.test.ts:225-230
**Found:** 2026-10-10 by the check of 12a.2's fixes (scope: ee7ca97..c689f9b)
**Why it matters:** The fix for F-328 added a fourth business, `booked`, with two people, a service, a stage and four customers' leads and bookings, but afterAll deletes only summit, other and fresh; booked's user goes, its business stays. Seen in `scheduleads_dev`: two `test-hours-b-*-dev` businesses were left from earlier runs before this check ran the tests, three after, each with 4 bookings and no members. Every run adds one more to the shared seeded database that other suites and the dev screens read.
**Suggested fix:** Add `booked.organizationId` to the organization delete in afterAll (everything under it cascades), and remove the businesses already left: `delete from organization where slug like 'test-hours-b-%-dev'`.
**Resolution:** Fixed 2026-10-10: afterAll deletes all four businesses, booked included. Checked: a run of the route tests left the count of `test-hours-*` businesses at 3, where each run had added one. The three already left from earlier runs stay in the local dev database until it is next rebuilt; nothing was deleted by hand. Closed 2026-10-10 by the final review of feature 12a (main...76850fe): settings-routes.test.ts:225-236 deletes all four businesses (summit, other, fresh, booked) and then all five users; every row booked makes (people, stage, Estimate, contacts, leads, bookings, its hours) hangs off its organization with ON DELETE CASCADE, and booking's composite `no action` keys are checked at the end of the same statement, so the delete succeeds (the suite passed, 917 tests). Counted in `scheduleads_dev` before and after a full backend run: 3 `test-hours-*` businesses (all `-b-`, from earlier runs) both times, and no `hours-s-`/`hours-m-` users left.

## Independent review

**Status:** passed
**Target commit:** 76850fe552b9c03ac885c289ac59c67e0bc2eaa2
**Base commit:** 86675f73ee99262beee1f75ed7f641f04af9735f
**Base ref:** main
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** runtime default
**Requested execution:** automatic
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent, read-only, one per review
**Actual execution:** automatic
**Reviewed at:** 2026-10-10
**Scope:** step 12a.1 (bbd7510), step 12a.2 (47dc46e), each with a check of its fixes, then the whole feature (main...76850fe)
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Rounds

1. Step 12a.1 at bbd7510, after the builder's audit (F-320, F-321): no P0 or P1. The business
   always comes from the login, a place or another business's person gets one 404, the save
   changes only the five hour columns. Found F-322 (P2) and F-323 to F-326 (P3); F-320 to F-325
   fixed in 5fc529c. The check of those fixes closed all six and found F-327, fixed in 12a.2.
2. Step 12a.2 at 47dc46e, after the builder's audit (F-328 P2, F-329): no P0 or P1. Tenant scope
   on every query, the one-off date merge matches the booking window's. Found F-330 to F-334 (P3);
   F-328, F-329, F-330 and F-333 fixed in c689f9b. The check of those fixes closed all four (the
   new rule compared with the booking window on 31,752 windows across clock-change days in five
   zones) and found F-335, fixed in 76850fe.
3. Final integration review of main...76850fe: every closed finding still closed, F-335 closed;
   every /settings route behind the dashboard middleware, a session, a subscription and the
   booking module, both saves behind organization:update; the answers match the spec's contracts.
   Raised F-336 and F-337 (P3), carried.

The audit gate was met by the builder's audits and these reviews, and the receipt is recorded here
directly instead of through `blueprint/context/review.md`, as for features 10 and 11.

### Commands

At 76850fe: `npm run build --workspace=frontend`, `npm run lint --workspace=frontend`,
`npm run test --workspace=@scheduleads-app/shared` (172 passed), `npm run test --workspace=backend`
(917 passed), `npm run test --workspace=@frankdmosquera/booking-component` (79 passed).

### Remaining risk

Carried open or unverified: F-326 (a time field may snap back while retyped; not tried in a
browser), F-331 (a booking made during a save may be missed; not reproduced), F-332 (three copies
of "windows on a date"), F-334 (the list's times use the browser's time-zone rules), F-336 (heading
levels on the Settings screen), F-337 (a type in its own file). No browser check was run by the
reviewers; the step's hand checks were run by the builder.
