# Feature: Services, people and places

**From build-plan:** feature 12d

**Size:** heavy - five separate risks with real logic: writing services, a person's or place's lifecycle (turning off, never deleting), who does what (what customers are offered), a work email that changes who gets which email, and a time rule for a service's new length.

**Branch:** feature/12d-services-people-and-places

## Goal

The owner manages, on Settings, what customers can book and who does it: each service
(its length, buffers, how often start times repeat, whether the customer picks the
person, whether it asks the address, live or hidden), the people and places of the
business (add, rename, turn off and on again), who does what (the people who do each
service and the rooms it needs), and each person's own work email. Changing a service's
length keeps every booking and lists the upcoming ones that no longer fit at the new
length. After this, nobody edits `booking_link`, `resource`, `booking_link_resource` or
a setup file to change any of it.

## Design reference

`prototypes/settings.html`: the "What people can book" card (one row per service: name,
length, Live or Hidden, Edit; "+ Add a service") and the section list (Hours, Services,
Crews, Days off, Calendar, Brand). Crews (feature 19) and the drag handles (no order is
stored) are not built. Settings has its section list since the layout fix; Frank is not
happy with one long page (Oct 10), so from this feature each section is its own page
(decision 1). Shared tokens already ported.

## In scope

- Settings becomes one page per section: `/settings/hours` (12a's, moved), `/settings/services`,
  `/settings/people`; `/settings` opens Hours. The section list links them, the current
  one marked.
- **Services (12d.1)**: the list (name, length, Live or Hidden) and a form to add or change
  one: name, description (optional), length, buffer before and after, start times every N
  minutes or every service length, who picks the person (the customer, or the business
  sends whoever is free), whether it asks the customer's address, live or hidden.
- **People and places (12d.2)**: the list (name, person or place, on or off) and a form to
  add one (name, person or place) or change one (name, on or off). Turning one off never
  touches a booking: the answer lists their upcoming bookings, still booked.
- **Who does what (12d.3)**: on each service, tick the people who do it and the places it
  needs; nobody ticked means anyone, no place ticked means no room is needed.
- **Work email (12d.4)**: on each person, an optional work email at the business's own
  domain. When set, the customer's confirmation replies to that person, and the person
  gets their own new-booking notification.
- **A service's new length (12d.5)**: saving a service with a different length lists the
  upcoming bookings of that service that would no longer fit the hours at the new length.
- Read-only for a role that may not change the business, as 12a.

## Out of scope

- Hours (12a, done), closed days and holidays (12e), the booking form and its questions
  (12f), texts and worker texts (12g), the calendar pick (12h).
- Crews (feature 19), a service's order on the page (no column for it), the booking
  window's look (`layout` stays `month`, the only one built).
- Deleting a service, person or place (decision 3), changing a person into a place or back
  (decision 4), moving or cancelling bookings from any list (12b).
- A person's work email on moves, cancellations or reminders: only the new-booking
  notification and the confirmation's reply (decision 7). Worker texts already cover moves.
- Signing in as a person (crew have no login; the open question for items 13 and 17).

## Build loop

Approved one step at a time (AGENTS.md). Heavy: `workflow.stepReview` is `every`,
`checkpointCommits` enabled. After a step's plan has Frank's yes, nothing stops until the
review: build, tests and checks, tick the box, write the build log entry and commit it to
buildlogs, commit and push the step to `feature/12d-services-people-and-places`, `/audit`
scoped to the step, then the independent review. The planned stop is after the review.
Blocking findings (P0/P1) are fixed by default; P2/P3 are recorded and carried.
`/complete` makes the final pass and merges on Frank's yes.

## Build steps

- [x] **12d.1 The owner adds and changes services.** "I open Settings, Services, add
  'Cabinet consultation', 45 minutes, the customer picks the person, no address, and it
  shows in the booking window."
  - Frontend: Settings split into pages (`app/(dashboard)/settings/hours/page.tsx`,
    `services/page.tsx`, `people/page.tsx`; `settings/page.tsx` redirects to hours), the
    section list in a shared `settings` layout, `components/settings/services-screen.tsx`
    with the list and one service form (react-hook-form, as 12a), calls in
    `lib/api-client/settings/`.
  - Shared: `serviceValidationSchema` (strict): name 1 to 200, description up to 500 or
    none, `durationMinutes` 1 to 1440, buffers 0 to 1440, `slotIntervalMinutes` 1 to 1440 or
    null, `personChoice`, `asksAddress`, `active`. Built from the setup file's service schema
    where they share a field, so the rules live once.
  - Backend: `GET /settings/services` (any member), `POST /settings/services` and
    `PUT /settings/services/:serviceId` (`organization: ["update"]`), in
    `backend/lib/settings/`. A new service gets its slug from `toSlug(name)`, made unique in
    the business with `-2`, `-3`; renaming never changes it (decision 5). `layout` is set to
    `month` by the server. Hidden means `active = false`: the booking window no longer lists
    it, its bookings stay (decision 3).
  **Done when:** the route tests below pass; and by hand on Summit Painting (dev) at
  http://localhost:3400/settings/services, a new 45-minute service is listed, shows in
  `/admin/booking-preview/painting-dev` with 45-minute starts, and is gone from there once
  hidden; `/settings` opens Hours; the read-only screen reads `canEdit` only.
  *Built 2026-10-10.* Changed while building: the section list shows Hours and Services;
  People joins it with its page in 12d.2. Reading a Settings page is shared
  (`settings-section.tsx`, `read-settings-response.ts`), and 12a's `HoursNotice` and
  `SaveHoursResultType` became `SaveNotice` and `SaveResultType`, since Services uses them too.

- [x] **12d.2 People and places come and go.** "I add 'Room 2', rename 'Diego (painter)' to
  'Diego', turn Tomas off, and he is no longer offered; his Friday booking is still there."
  - Backend: `GET /settings/people`, `POST /settings/people` (`{ name, kind }`) and
    `PUT /settings/people/:resourceId` (`{ name, active }`), in `backend/lib/settings/`. A new
    person follows the business's week (no row: 12a). Never deleted; off is `active = false`
    (decision 3). The last active person cannot be turned off (409 `last_person`). A name
    another person or place of the business already has, ignoring case and outer spaces, is
    refused (409 `name_taken`, decision 6). Turning one off answers with their upcoming
    confirmed bookings (`upcomingBookings`, 12a's row shape), unchanged.
  - Frontend: `components/settings/people-screen.tsx`, the list and its form; the list of
    upcoming bookings under the form after turning one off, each linking to its lead.
  **Done when:** the route tests below pass; and by hand, a place added shows on the list
  and not on Hours (hours are per person), a person turned off disappears from Hours and is
  not offered in the booking preview while their booking stays on its lead page, and turning
  them on again brings both back.
  *Built 2026-10-10.* Changed while building: `GET /settings/people` also answers the business's
  `timezone` (the turned-off list shows times in it); a place turned off lists the bookings
  that use it. Saves of people and places lock the business's row (`for no key update`) so two
  cannot both find a name free or both find another person on. 12a's
  `OutsideHoursBookingType` and `OutsideHoursList` became `ListedBookingType` (with
  `listedBookingOf`) and `ListedBookings` (with a title), shared with this list; this settles
  F-337. By hand, Summit's services all send whoever is free, so the booking preview never
  names a person: "not offered" is proved by the route test, not seen in the preview.

- [x] **12d.3 Who does what.** "On 'Colour consultation' I tick only Marco and Room 1, and the
  booking window offers only Marco."
  - Backend: `PUT /settings/services/:serviceId/resources` (`{ peopleIds, placeIds }`)
    replaces that service's ticks in one transaction. Every id must be a person (in
    `peopleIds`) or a place (in `placeIds`) of this business, on or off; anything else is
    400 with the field. `GET /settings/services` returns each service's `peopleIds` and
    `placeIds`. The booking side already reads them (`findServiceResources`): nobody ticked
    means anyone, a turned-off person is never offered.
  - Frontend: on the service form, two lists of ticks (people, places), turned-off ones
    shown as off; the hints "Nobody ticked: anyone can do it" and "No place ticked: no room
    needed".
  **Done when:** the route tests below pass; and by hand, ticking only Marco on a service
  makes the booking preview offer only Marco for it, and clearing the ticks offers everyone.
  *Built 2026-10-10.* Changed while building: the service form's one Save sends the service, then
  its ticks when they changed, by their own call; a new service whose ticks fail to save is
  changed, never added twice, on the next Save. A service's save and add answers carry its
  `peopleIds` and `placeIds`. Added: when every one ticked is off, the hint turns red and says
  nobody is offered (people) or it cannot be booked (places), since the booking side never
  falls back to anyone then. By hand, Summit's Colour consultation was switched to "the
  customer picks" so the preview names people.

- [ ] **12d.4 A person's work email.** "I give Pedro pedro@summit-painting.test; a customer
  booking with Pedro can reply to him, and Pedro gets his own notification."
  - Migration: `resource.workEmail` (text, null), a person's only (check), stored trimmed
    and lowercased.
  - `PUT /settings/people/:resourceId` takes `workEmail` (an address, or null to clear). It
    must be at the domain of the business's `senderEmail` (decision 8): another domain is
    400 on the field; a business with no sender address set is 409 `no_sending_address`
    ("Set the business's sending address first").
  - `findBookingEmailRecipients` gains the booked person's work email: the confirmation's
    reply goes to it, and the person gets the new-booking notification (a new email kind,
    recorded on the timeline like the others, without the address). Unchanged when unset:
    no reply-to, no notification to the person (decision 11 of feature 6 still holds for
    anyone without one).
  **Done when:** the recipients rule tests and route tests below pass; and by hand with the
  dev business's Resend test key (or the console sender if none), a booking with a person
  who has a work email sends the person's notification and sets the confirmation's reply-to,
  and one with a person without sends exactly what it sent before.

- [ ] **12d.5 A service's new length lists the bookings that no longer fit.** "I make the
  estimate 90 minutes instead of 60, and I am told Maria's Tuesday 4:00 would now run past
  5:00; it is still booked as it was."
  - `backend/lib/bookable-hours/apply-length-change-rules.ts`, no database: given the hours,
    the service's upcoming bookings and the new length, it returns the confirmed bookings
    still to come that fit as booked and would not fit starting at the same moment with the
    new length. "Fits" is 12a.2's exported test (`fitsHours`), so clock changes and one-off
    dates count the same way (decision 9).
  - The service save (12d.1's `PUT`) reads the business's hours, the people's rows and the
    service's upcoming bookings in its transaction when the length changes, and answers
    `outsideHours` (12a's row shape); the form shows 12a's list under it.
  **Done when:** the Simulate page's cases pass as saved tests under the same names; and by
  hand, a Tuesday 4:00 booking of a 60-minute service with Tuesday ending at 5:00, then the
  service made 90 minutes, lists that booking, which is unchanged on its lead page.

## Files / areas

- `frontend/app/(dashboard)/settings/` (layout, `hours/`, `services/`, `people/`), `frontend/components/settings/`, `frontend/lib/api-client/settings/`
- `packages/shared/zod-validation/` (service, resource, ticks and work-email schemas, exported from the index)
- `packages/shared/db/booking-tables/resource-table.ts` and a new migration (12d.4 only)
- `backend/routes/settings-routes.ts` and its test; `backend/lib/settings/` (find and save services, people, ticks)
- `backend/lib/bookable-hours/apply-outside-hours-rules.ts` (export `fitsHours`), `apply-length-change-rules.ts` and its test (12d.5)
- `backend/lib/email/find-booking-email-recipients.ts`, `send-booking-emails.ts`, `send-and-record-emails.ts` (the new kind) and the notification template (12d.4)
- `backend/lib/errors/refuse.ts` (`last_person`, `name_taken`, `no_sending_address`)

## Data / contracts

All under the dashboard CORS, CSRF and no-store middleware and the `booking` module; reads
for any member, writes need `requirePermissionMiddleware({ organization: ["update"] })`.
The business always comes from the session; every query filters on it first; an id of
another business, an unknown one, or the wrong kind is one `404 not_found`.

**`GET /settings/services`** `200 { canEdit, services, people }`: `services` by name, each
`{ id, name, slug, description, durationMinutes, bufferBeforeMinutes, bufferAfterMinutes,
slotIntervalMinutes, personChoice, asksAddress, active, peopleIds, placeIds }`; `people`
every person and place `{ id, name, kind, active }` for the ticks (12d.3).

**`POST /settings/services`**, body the service schema. `201 { service }`.
**`PUT /settings/services/:serviceId`**, the same body. `200 { service, outsideHours }`
(`outsideHours` empty until 12d.5, and when the length did not change).
**`PUT /settings/services/:serviceId/resources`**, `{ peopleIds: string[], placeIds:
string[] }`, no repeats. `200 { peopleIds, placeIds }`.

**`GET /settings/people`** `200 { canEdit, people, timezone, senderDomain }`: every person and place by
name, `{ id, name, kind, active, workEmail }` (`workEmail` from 12d.4, null for a place);
`senderDomain` the business's sending domain or null (12d.4).
**`POST /settings/people`**, `{ name, kind: "person" | "place" }`. `201 { resource }`.
**`PUT /settings/people/:resourceId`**, `{ name, active, workEmail? }`. `200 { resource,
upcomingBookings }`: the resource's upcoming confirmed bookings when it was just turned off,
else `[]`; rows `{ bookingId, leadId, customerName, serviceName, personName, startsAt,
endsAt }`, ISO, soonest first (12a's `outsideHours` row).

**Errors**: 400 `{ error: { code: "bad_request", message }, field }` from the first Zod
issue; 409 `last_person` "Someone has to stay on: turn another person on first.";
409 `name_taken` "Another person or place here already has that name."; 409
`no_sending_address` "Set the business's sending address first."; 401/403 as 12a.

**Formats**: minutes as whole numbers; names trimmed, compared ignoring case for
`name_taken`; work email trimmed and lowercased, its domain compared lowercased.

**User text** (names, descriptions) is rendered by React as text. Emails render the
person's name through the existing templates' escaping.

## Testing

Commands: `npm run test --workspace=@scheduleads-app/shared`, `npm run test
--workspace=backend` (local Postgres, migrated and seeded), `npm run build` and
`npm run lint` for the frontend. No Verify command and no browser test harness; hand
checks are in each Done when.

One test per rule that would hurt if broken:

- 12d.1: a member without the permission is refused a save; another business's service
  gets the 404; a new service gets a unique slug and `month`, and a rename keeps the slug;
  a hidden service is no longer offered and its bookings stay.
- 12d.2: the last active person cannot be turned off; a name already taken is refused; a
  turned-off person is not offered and their bookings stay, listed in the answer.
- 12d.3: a save replaces the ticks; a place in `peopleIds`, or another business's person,
  is refused and nothing changes.
- 12d.4: a work email at another domain is refused, and none can be set without a sending
  address; the recipients rule: with a work email the confirmation replies to the person
  and the person is notified, without one nothing changes.
- 12d.5, named as on the Simulate page: a longer service that runs a booking past the end
  of the day is listed; a longer service that still fits is not listed; a shorter service
  never lists a booking; a booking already outside before the change is not listed again;
  a longer booking that would run into a gap between windows is listed; another service's
  bookings are never listed; a cancelled or past booking is never listed.

## Notes for the AI

- 12a's patterns: client components fetching through `dashboardApiClient` with local
  state; react-hook-form with shadcn Input, Label, Button; each error under its field with
  `aria-describedby`; a refused save focuses the first bad field; saved and failed messages
  announced and cleared on the next edit. No TanStack Query (feature 14).
- Nothing is pre-filled where the business must choose (decision 30): who picks the person
  and whether it asks the address start unpicked; buffers start at 0 (none), start times
  start at "every service length".
- The setup command keeps working for a new business; it adds only what is missing, by name.
- Comments beside the line they explain, one or two lines, no history.

## Open questions

None blocking. Every choice is in the build log's Decisions drawer and can be overruled at
its step's plan; the two worth a look before their steps are decision 1 (a page per
section) and decision 9 (what "no longer fits at the new length" means).
