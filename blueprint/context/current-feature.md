# Feature: People, places and skills

**From build-plan:** feature 12k

**Size:** heavy - three separate risks with real logic: who can be offered for a service (stored
skills, a new rule replacing "nobody ticked means anyone", a data carry-over), a service's own
hours (one more layer in the free-time math), and the People and Places pages rebuilt around them.

**Status:** in progress

**Branch:** feature/12k-people-places-and-skills

## Goal

The owner sets her business up the way she thinks of it. A **person** has skills: the services
they can do, ticked once on their own card, with their bookable hours beside them. A **service**
runs in its own window ("haircuts in the afternoon") and lists only the people who can do it, each
with an on/off switch for offering it now. A **place** (a room, a chair) has its own page and shows
the services that need it. A customer sees a time only where all of it overlaps: the service runs,
a person who can do it is on and free in their hours, and a place it needs is free. Nothing has to
be guessed, and nothing bookable today changes when it ships.

Added by Frank on 2026-10-25 after walking Summit Painting (dev): skills were hidden on the service
side, a person's hours sat on another page, and people and places shared one page.

## In scope

- **Skills on the person.** A person's card on People lists every service with a tick: "Can do".
  Saving replaces that person's skills. A newly ticked skill also switches them on for that
  service, so hiring someone is one tick; the service's page switches them off (Frank, 2026-10-25,
  after the 12k.1 review). A place has no skills.
- **The switch on the service.** A service's "Who does it" lists only the people who can do it,
  each with On / Off ("offering it now"). A person without the skill is not listed; a line says
  how to give it ("Tick it on their card on People"). Places it needs are unchanged.
- **The rule.** A service with nobody on cannot be booked: it shows no times and the booking route
  refuses it. This replaces build-plan item 5's "nobody ticked means anyone can do it". Removing a
  skill also turns that person off for the service. A save that leaves a service with nobody on
  still saves, and says so: "Nobody offers Haircut now: customers cannot book it."
- **The carry-over.** One migration, nothing bookable changes: every person ticked on a service
  today gets that skill, on. Every service with nobody ticked today ("anyone") gives every active
  person the skill, on. Places ticked today stay as they are.
- **A service's own hours.** On the service form: "Runs: whenever the business is open" or "Its own
  week", with one-off dates, the same editor a person's hours use. A start time is offered only
  inside the service's window, the person's bookable hours and the business's open days. A save
  lists the bookings now outside the window, as a person's hours save does today. Hand bookings
  are not limited by it, as today.
- **The person's card holds their hours.** Their bookable hours ("Bookable whenever the business is
  open" / "Own bookable hours", "+ A day that's different") move from Hours to their card on
  People. Hours keeps only the business's week and its settings.
- **"Booked by customers for"** on each person's card: the services they are on for, or "Not
  booked by customers".
- **Places get their own page**, Settings, Places ("Rooms, chairs or anything a service needs
  free"), with its own Add. A place's card ticks the services that need it; that tick is the same
  one as the service's "Places it needs". People keeps only people.
- **The client setup file**: a service's listed people get the skill and are on; a service that
  lists nobody gives every person the file lists, and the business's first person, the skill, on.
- **The dev seed** makes skills and switches matching today's ticks.
- Every new word in English and Spanish (12j), and every new API message in the Spanish table.

## Out of scope

- Named skills that no service uses (Painting, Crew lead), "Scheduled by you", crews: item 19.
  Moving these ticks into named skills then is a small data move, paid at item 19 (Frank,
  2026-10-25: the owner sees only her own service names).
- Renaming "Services" to "Events" on screen (see Notes).
- Worker sign-in and email replies through the app (later, item 15).
- Any change to the booking window package: it already shows what the API answers.

## Build loop

`workflow.stepReview` is `every` and the spec is heavy, so every step gets its own review. After a
step's plan has Frank's yes, it runs straight through without asking: build, tests, the browser
check, tick, build log, commit and push to `feature/12k-people-places-and-skills`, `/audit`, the
independent review. The one planned stop is after the review. Only three things stop a step
earlier (AGENTS.md): the plan proves wrong, a line only Frank crosses, or a P0/P1 finding.
The new migrations go on live by hand through the tunnel before the merge deploys, on Frank's yes.

## Build steps

- [x] 12k.1 **Skills on the person, the switch on the service.** Migration 0033: table
  `person_skill`, the carry-over. The free-time and booking rules read "on" people only, and
  nobody on means not bookable. `PUT /settings/people/:resourceId/skills`; the service's
  `PUT .../resources` refuses a person without the skill. On People, each person's card gets
  "Can do"; on Services, "Who does it" lists only those people with On / Off. The setup file and
  the seed follow. **Done when:** the backend tests prove a person who cannot do a service is
  never offered, a service with nobody on shows no times and refuses a booking, the carry-over
  keeps every service's offered people and free times identical on the seeded businesses, and
  removing a skill turns the person off; on http://localhost:3400 Peter gets "Interior estimate"
  on his card, appears under it on Services, and switched on is offered in the booking preview.
- [ ] 12k.2 **A service's own hours.** `availability_rule` gains a service's row (migration 0034).
  Free times intersect the service's window with the person's hours.
  `PUT /settings/services/:serviceId/hours` answers the bookings now outside it. The service form
  gets "Runs". **Done when:** the tests prove a time outside the service's window is never offered
  while the same time stays offered for a service without one, a one-off date applies, closed days
  still close, and a save lists the bookings outside; on the laptop "Interior estimate" set to
  afternoons offers no mornings in the booking preview.
- [ ] 12k.3 **People and Places pages, the person's card whole.** Places gets its own page and Add;
  a place's card ticks its services (`PUT /settings/places/:resourceId/services`). A person's card
  holds their hours, "Can do" and "Booked by customers for"; Hours keeps the business's week only.
  The words above, in both languages. **Done when:** the route's tests prove a place's ticks are the
  same rows as the service's "Places it needs"; on the laptop Riverbend Clinic (dev) shows six
  people and five places on two pages, a person's hours save from their card, and every new word
  reads in Spanish.

## Files / areas

- `packages/shared/db/`: new `scheduling-tables/person-skill-table.ts`; `availability-rule-table.ts`
  (12k.2); migrations 0033 and 0034; `zod-validation` for the new bodies.
- `backend/lib/scheduling/find-service-resources.ts` (on people only, no "anyone"),
  `find-free-times.ts`, `backend/lib/bookable-hours/` (the service window, 12k.2),
  `backend/lib/booking/book-time.ts` and `prepare-booking-move.ts` (refuse a service nobody is on),
  `backend/lib/settings/` (skills, ticks, service hours, place services),
  `backend/routes/settings-routes.ts`.
- `packages/shared/client-setup/apply-business-shape.ts`, `packages/shared/scripts/seed-dev.ts`.
- `frontend/components/settings/`: `people-screen.tsx` and a new places screen, the person and place
  cards, `service-form.tsx` ("Who does it", "Runs"), `hours-screen.tsx` and `person-hours-card.tsx`
  (moved), `settings-frame.tsx` (Places entry); `frontend/app/(dashboard)/settings/places/`;
  `frontend/lib/api-client/settings/`; the word files and `spanish-messages.ts`.

## Data / contracts

- `person_skill`: `organizationId`, `resourceId`, `bookingLinkId`, `createdAt`; primary key
  (`resourceId`, `bookingLinkId`); composite foreign keys to `resource` and `booking_link` on
  (`organizationId`, id), so a skill never crosses businesses; a deleted service takes its skills
  (cascade). A skill is only ever saved for a person (checked in the save and tested).
- `booking_link_resource` keeps its rows: a person row now means "on", and is allowed only while
  the person has the skill (the save checks it; removing a skill deletes the "on" row in the same
  transaction). Place rows are unchanged.
- `availability_rule` (12k.2): a nullable `bookingLinkId`; a row is the business's (both null), a
  person's (`resourceId`) or a service's (`bookingLinkId`), never both; one row per service.
  `weeklyHours` null means "whenever the business is open".
- `PUT /settings/people/:resourceId/skills` `{ serviceIds: string[] }`: 200 with the person's skills
  and the services left with nobody on; 400 for a service not the business's or a place; 404 for
  a person not the business's. Owner and admin only (`CHANGE_BUSINESS`), like every Settings save.
- `PUT /settings/services/:serviceId/resources`: unchanged shape; a person without the skill is a
  400 on `peopleIds`: "{name} cannot do this service yet: tick it on their card on People."
- `PUT /settings/services/:serviceId/hours` `{ weeklyHours: WeeklyHours | null, dateHours }`: 200
  with the saved hours and the bookings now outside them; the same validation as a person's hours.
- `PUT /settings/places/:resourceId/services` `{ serviceIds: string[] }`: replaces that place's
  service ticks; 400 for a person.
- `GET /settings/people` gains each person's `serviceIds` (skills) and `onFor` (service ids);
  places move to `GET /settings/places`. `GET /settings/services` gains each service's hours.
- Free time: a start is offered for a person when the service runs then, the person is on for it
  and free in their bookable hours, the business is open, and a place it needs is free.

## Testing

Backend and shared tests with Vitest against the local `scheduleads_dev` (AGENTS.md):
the rule (not able, off, nobody on, removing a skill), the carry-over on the seeded data (same
offered people and free times before and after), the setup file both ways, tenant scope on every
new route (another business's ids refused), the service window (inside, outside, one-off date,
closed day, no window), the bookings-outside list, a place's ticks. The Spanish message test covers
the new refusals. The frontend has no test runner; its screens are checked on
http://localhost:3400 in English and Spanish.

## Notes for the AI

- Frank called services "events" while thinking it through. Screens keep "Services": customers
  book a "service" in the window (12i), and "event" already means a Google Calendar event in this
  product. His to overrule.
- Standby (at work, hidden from customers) already exists per person per date; it is not the "on"
  switch. "On" is per service and lasting; standby is per date and covers every service.
- `booking_link_resource`'s comment ("Nobody ticked means anyone") and build-plan item 5's line
  change with 12k.1.
- The booking window package needs no change; check its "no times" screen with a service nobody
  is on.
