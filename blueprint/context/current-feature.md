# Feature: Calendars

**From build-plan:** feature 12b

**Size:** heavy - three separate risks with real logic: reading a week for one person or place from four sources (hours, closed days, held time, Google), a booking made by hand that must be a real booking, and time off over bookings that moves or cancels them in the same save.

**Branch:** feature/12b-calendars

**Status:** 12b.1 built and reviewed 2026-10-12; 12b.2 built, its review next; 12b.3 planned.

## Goal

Every person and every place has a calendar in the app. The owner sees a week of it: the bookable
hours, closed days, bookings with their customer, time off, and the person's Google busy times. He
adds things by hand: a phone estimate or a walk-in as a real booking (the customer, the lead, the
texts), and time off or a blocked afternoon. He can place work any time someone is not off and not
already busy; bookable hours only limit customers. Marking someone off over existing bookings moves
or cancels each of them in the same save. Until this, nothing can be put in by hand, and the
website could sell a slot already given away on the phone.

## In scope

- **The Calendar page**, `/calendar`, in the dashboard's main list after Leads: pick a person or a
  place, see one week (Monday to Sunday, the business's time zone), previous and next week.
- **Each day shows**: the bookable hours (12a; none on a closed day, 12e, marked closed); every
  active booking (time, service, customer's name, a link to the lead); time off; for a person with
  Google connected, the Google busy blocks of their ticked calendars (12h) apart from the app's own,
  or "Google could not be read" for that week, the rest still shown.
- **Book by hand** from the page: a service the person does, the person, a start (any time nobody
  it needs is busy, inside or outside bookable hours, not in the past), the customer's name and
  phone or email, the address when the service asks one, a note. The same booking path the website
  uses (`bookTime`, source `manual`): a lead in the first stage, the timeline entry, the Google
  event, the confirmation and texts as the business has set them (6, 8b, 12g).
- **Time off** for a person or a place: a start and an end, any length (an afternoon, a day, a
  week). Saved as `commitment` rows of kind `time_off`; removing one releases it. When it covers
  active bookings of that person or place, the save must carry a choice for each: **cancel** (the
  customer told, as the owner's cancel since 12e) or **move** (a new start, and the same person or
  another who does the service; the customer told, the Google event following, as 7b's move). The
  whole save is one transaction: the time off, every move and every cancel, or nothing (Decisions, 3).
- **Who sees what** (Decisions, 2): a role that may change the business sees every calendar and
  adds everything; any other member sees only their own person's calendar, read-only.

## Out of scope

- Moving or cancelling a booking from the calendar outside time off (the lead page and 12e cover
  cancel; a general owner move is a later item).
- Drag and drop, a day view of everyone side by side, and the final look (logic first, layout later).
- Recurring time off, and a reason or label on time off.
- Time off written into Google; other providers.

## Build loop

Approved one step at a time (AGENTS.md). Heavy: `workflow.stepReview` is `every`,
`checkpointCommits` enabled. After a step's plan has Frank's yes, nothing stops until the review:
build, tests and checks, tick the box, write the build log entry and commit it to buildlogs, commit
and push the step to `feature/12b-calendars`, `/audit` scoped to the step, then the independent
review. The planned stop is after the review. Blocking findings (P0/P1) are fixed by default;
P2/P3 are recorded and carried. `/complete` makes the final pass and merges on Frank's yes.

## Build steps

- [x] **12b.1 See each calendar.** "Summit's owner opens Calendar, picks Carlos and sees this week:
  his hours Monday to Friday, Thursday closed for a holiday, Tuesday's 10:00 booking with the
  customer's name, Friday afternoon off, and the busy block from his Google. Picking the van shows
  the bookings that use it. Next week shows next week. A member who is only Carlos sees Carlos's
  calendar and nobody else's."
  - Backend: `GET /schedule?resourceId=&weekOf=YYYY-MM-DD` (the business from the session):
    `{ canEdit, timezone, resources, resource, days: [{ date, closed, hours, items }], google }`,
    items `{ kind: "booking" | "time_off" | "google_busy", startsAt, endsAt, booking? }`. Reuses
    `resolveBookableHours`, `closed-days-between.ts`, `findCommitments` and `getBusyTimes`.
  - Frontend: `app/(dashboard)/calendar/page.tsx`, "Calendar" in the dashboard list, the week screen.
  **Done when:** the route tests pass, and by hand on Summit the scene above shows.

- [x] **12b.2 Book by hand.** "On Carlos's Thursday the owner books Mrs Lee's phone estimate at
  4:30 pm, after Carlos's hours: it shows on the calendar, Mrs Lee is a new lead, her confirmation
  goes as Summit's settings say, and the event is in Carlos's Google. 4:30 on a day Carlos is off is
  refused, and so is a time already past."
  - Backend: `POST /schedule/bookings` calling `bookTime` with source `manual` and the owner's login.
  - Frontend: the booking form on the calendar.
  **Done when:** the route tests pass, and by hand on Summit the scene above works.

- [ ] **12b.3 Time off.** "The owner marks Carlos off all Friday. Carlos has two bookings Friday:
  the page lists them in the same form; the owner moves one to Monday 9:00 with Carlos and cancels
  the other, then saves once. Friday is off, one customer is told of the new time and one of the
  cancel. If Monday 9:00 was taken meanwhile, nothing is saved, the cancel included. Removing the
  time off opens Friday again."
  - Backend: `POST /schedule/time-off` and `DELETE /schedule/time-off/:id`; an owner move (any time
    nobody is busy, its own old time not in the way, the person one who does the service); the
    save in one transaction with the cancel and move internals (check in the build that both can
    run inside a caller's transaction; give them that if not).
  - Frontend: the time off form with its list of bookings in the way.
  **Done when:** the route tests pass, the four Simulate cases are saved tests under their names,
  and by hand on Summit the scene above works.

## Files / areas

- `frontend/app/(dashboard)/calendar/`, `frontend/components/schedule/` (the week, the forms),
  the dashboard list in `frontend/components/dashboard/dashboard-shell.tsx`,
  `frontend/lib/api-client/schedule/`
- `backend/routes/schedule-routes.ts` and its test, mounted at `/schedule` in `backend/app.ts`
  under the dashboard CORS, CSRF and no-store middleware; `backend/lib/schedule/` (the week, the
  time off save, the owner move); `backend/lib/booking/` (`bookTime`, cancel and move internals)
- `packages/shared/zod-validation/` (the three bodies); no migration: `commitment` holds time off
  since 5a

## Data / contracts

All under the dashboard middleware and the `booking` module. The business always comes from the
session; every query filters on it first. Reads: a role with `organization: ["update"]` any
resource of the business, anyone else only the person linked to their login (`403` otherwise).
Writes need `organization: ["update"]`.

**`GET /schedule?resourceId=&weekOf=`** `weekOf` a local date, the week its Monday starts.
`resourceId` optional: missing, the caller's own person, or the first person for an owner without
one. `404` for a resource not of the business. `google: "read" | "not_connected" | "unreadable"`.
A booking item carries `{ id, leadId, customerName, serviceName, personName }`; text rendered by
React as text.

**`POST /schedule/bookings`** `{ bookingLinkId, personId, date, startMinute, customer: { name, email,
phone }, location, details }`, strict (amended at 12b.2: the business's own clock, a date and a minute of
the day, turned into a moment in its zone by the API, so the page needs no time-zone sums; an hour
skipped in spring is `400` on `startMinute`). `201 { booking }`. `409 time_taken` when anyone it needs is busy,
`400 in_the_past`, `400` on a field for a missing contact or address as `bookTime` answers.

**`POST /schedule/time-off`** `{ resourceId, startsAt, endsAt, bookings: ({ bookingId, action:
"cancel" } | { bookingId, action: "move", startsAt, personId })[] }`, strict, end after start.
`201 { timeOff }`. `409 bookings_in_the_way { bookings }` when an active booking in the span has no
choice (or a choice names one not in the way); `409 time_taken` when a move's time or the span
itself is taken meanwhile; nothing saved on any refusal.

**`DELETE /schedule/time-off/:id`** `204`; `404` for another business's or a booking's row.

## Testing

`npm run test --workspace=@scheduleads-app/shared`, `npm run test --workspace=backend` (local
Postgres, migrated and seeded), `npm run build` and `npm run lint` for the frontend. One test per
rule that would hurt if broken:

- 12b.1: the week shows hours, closed days, bookings, time off and Google busy apart, in the
  business's zone; Google unreadable still shows the rest; a member sees only their own calendar;
  another business's resource is 404.
- 12b.2: a booking by hand outside bookable hours is made, with a lead and its jobs; a busy time,
  time off and a past time are refused; a member without the permission cannot book.
- 12b.3, the Simulate cases under their names: "time off with no bookings in the way is saved";
  "time off over a booking with no choice is refused, and nothing is saved"; "one booking moved and
  one cancelled in one save: the time off is saved and both customers are told"; "a move to a time
  taken meanwhile saves nothing, not even the cancel". Also: removing time off frees the time.

## Decisions (made while planning, Frank's to overrule)

1. **One person or place at a time, a week at a time.** One Google read per view; everyone side by
   side is a later look.
2. **Owners see everyone; a member sees only themselves, read-only.** Customer names stay with the
   roles that run the business.
3. **Time off over bookings is all or nothing.** A move that fails leaves nothing half done: no
   time off saved over a booking still standing, no customer told of a cancel that did not finish.
4. **Time off and a blocked afternoon are the same thing**: a span, any length. No reason field.

## Notes for the AI

- `bookTime` with source `manual` already skips the form's contact and answer rules and books any
  time nobody is busy (`findBookingChoices` `byOwner`); 12b.2 is mostly the route and the form.
- `findBookingChoices` refuses `movingBooking` with `byOwner` today; 12b.3 adds the owner move.
- Google is read, never written, for time off. No outside settings change in any step.
