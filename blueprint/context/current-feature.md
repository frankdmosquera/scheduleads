# Feature: Texts

**From build-plan:** feature 12g

**Size:** heavy - two separate risks with real logic: the business's texts (a number that routes every customer's reply to one business, reminders that must reach bookings already made, a reply phone refused if it is any business's texting number), and each person's worker texts (a phone refused if it is any business's texting number, three switches with no default).

**Branch:** feature/12g-texts

**Status:** verified 2026-10-12: both steps built and reviewed, nine findings fixed and one carried; backend 991, shared 184 and booking component 83 tests pass, the frontend builds and lints. Then a final review of the whole feature.

## Goal

The owner sets the business's texts on Settings: whether the confirmation text goes, any number of
reminders each any number of minutes before, and where a customer's reply is passed on (a phone, an
email, or both); and, on People, each person's worker texts: their phone, and whether they hear when
a booking is added to their day, moved, or taken off it. Nothing is on by default. After this nobody
edits `text_settings` or `worker_text_settings` by hand or in a setup file to change any of it.

## In scope

- **The business's texts (12g.1)**: a Texts page, `/settings/texts`, in the section list after
  Booking form. It shows the texting number, the confirmation text on or off, the reminders (add one
  as a number of minutes, hours or days before, remove one), and where replies go (a phone, an
  email, or both, at least one). One Save writes the lot. Saving refuses a reply phone that is any
  business's texting number (8b, F-199), and a reply phone equal to its own number. A reminder added
  also reaches the upcoming bookings already made; one removed stops (see Notes). The yes to later
  texts stays on the Booking form page (12f).
- **The texting number** (Decided): the agency gives a business its number, with the business's
  first text choices, in its setup file; the owner sees the number and changes everything else. A
  business with no texts yet sees "Texts are not set up for your business yet" and nothing to save.
- **Each person's worker texts (12g.2)**: on People, each person (never a place) has a Texts part:
  off, or on with a phone and three yes/no choices (added to their day, moved, taken off), none
  picked until the owner picks. Turning texts off removes the person's row. Saving refuses a phone
  that is any business's texting number (8c, decision 6). Two people may share one phone.
- Read-only for a role that may not change the business, as 12a.

## Out of scope

- The words of the texts (fixed since 8b and 8c), and texts in other languages.
- Buying or moving a Twilio number, and anything on Twilio's side.
- What the business sends to a customer who said yes to later texts (a later feature).
- Worker texts for places, and texts to the owner other than as a reply destination.
- Showing which texts were sent (the lead timeline already lists them).

## Build loop

Approved one step at a time (AGENTS.md). Heavy: `workflow.stepReview` is `every`,
`checkpointCommits` enabled. After a step's plan has Frank's yes, nothing stops until the review:
build, tests and checks, tick the box, write the build log entry and commit it to buildlogs, commit
and push the step to `feature/12g-texts`, `/audit` scoped to the step, then the independent review.
The planned stop is after the review. Blocking findings (P0/P1) are fixed by default; P2/P3 are
recorded and carried. `/complete` makes the final pass and merges on Frank's yes.

## Build steps

- [x] **12g.1 The business's texts.** "Summit's owner turns the confirmation text off, adds a
  reminder 2 hours before and removes the 20-hour one, and sends replies to an email instead of a
  phone: the next booking gets no confirmation, tomorrow's booking already made gets the 2-hour
  reminder and not the 20-hour one, and a customer's reply arrives by email. A reply phone that is
  another business's texting number is refused."
  - Backend: `GET /settings/texts` (any member) answers `{ canEdit, texts }`, `texts` null when the
    business has none; `PUT /settings/texts` (`organization: ["update"]`) saves the confirmation,
    the reminders and the reply destination in one transaction under `lockBusinessResources`;
    `409 no_text_settings` when the business has none; `400` on the reply phone field when it is
    any business's texting number. Reminders added: for each upcoming confirmed booking, the
    reminder's job for the booking's current move, unless its moment has passed. Check in the build
    that a reminder is never sent twice for one booking, move and minutes (removed then added back
    while its first job is still queued); add the guard if the sending job lacks one.
  - Shared: the save's schema (the settings schema without the number and without the yes to later
    texts, which 12f owns); reminders kept in order, soonest last, no repeats, at most 10 (a
    reversible limit, so a page cannot grow without end). The setup
    file gains an optional `texts` block (the full text settings, number included), added only when
    the business has none, and listed as a difference after that.
  - Frontend: `app/(dashboard)/settings/texts/page.tsx`, "Texts" in the section list,
    `components/settings/texts-screen.tsx` and its form.
  **Done when:** the route tests below pass, and by hand on Summit the scene above shows on the page
  and in the database's queued jobs; Summit's texts are put back after.

- [x] **12g.2 Each person's worker texts.** "On Summit's People, Carlos's texts go on with his
  phone, yes to added and moved, no to taken off: a booking added to his day queues his text, a
  cancel does not. Marco's phone set to Summit's texting number is refused. Turning Carlos's texts
  off removes them."
  - Backend: the People read answers each person's `texts` (`{ phone, addedOn, movedOn, removedOn }`
    or null); `PUT /settings/people/:resourceId/texts` with the settings or `null` (off), a person
    of this business only (`404` otherwise, a place `400`), `400` on the phone field when it is any
    business's texting number.
  - Frontend: the Texts part of the person's form on People.
  **Done when:** the route tests below pass, and by hand on Summit the scene above works; Summit's
  people are put back after.

## Files / areas

- `frontend/app/(dashboard)/settings/texts/`, `frontend/components/settings/` (section list, the
  texts screen and form, the person's form), `frontend/lib/api-client/settings/`
- `backend/lib/settings/` (find and save the texts, the worker texts), `backend/lib/text/` (the
  texting-number check), `backend/lib/jobs/enqueue-booking-texts.ts` (reminders for bookings
  already made), `backend/routes/settings-routes.ts` and its test
- `packages/shared/zod-validation/text-validation-schemas/`, `packages/shared/client-setup/` and the
  setup schema, `packages/shared/scripts/seed-dev.ts`

## Data / contracts

All under the dashboard CORS, CSRF and no-store middleware and the `booking` module; reads for any
member, writes need `requirePermissionMiddleware({ organization: ["update"] })`. The business always
comes from the session; every query filters on it first. No migration: both tables exist (8b, 8c).

**`GET /settings/texts`** `200 { canEdit, texts }`: `texts` null, or `{ fromNumber, confirmationOn,
reminderMinutesBefore, replyPhone, replyEmail }`, numbers as stored (`+14035550148`).

**`PUT /settings/texts`** `{ confirmationOn, reminderMinutesBefore, replyPhone, replyEmail }`,
strict: reminders whole minutes, at least 1, no repeats, at most 10; a reply phone or an email or
both; phones typed any common way, stored as Twilio texts them. `200 { texts }` as the GET's.
`409 no_text_settings` without texts. `400 { error, field: "replyPhone" }` for a texting number.

**`PUT /settings/people/:resourceId/texts`** `{ texts: { phone, addedOn, movedOn, removedOn } | null }`
(amended at 12g.2: wrapped, so one strict schema reads both), every switch given. `200 { texts }`
(null when off). `404 not_found` for another business's or an unknown person, `400` for a place,
`400 { error, field: "texts.phone" }` for a texting number. The People read answers `workerTexts`,
`{ personId, phone, addedOn, movedOn, removedOn }[]`, a person not listed having none.

**User text**: phones and emails are rendered by React as text, never HTML.

## Testing

Commands: `npm run test --workspace=@scheduleads-app/shared`, `npm run test --workspace=backend`
(local Postgres, migrated and seeded), `npm run build` and `npm run lint` for the frontend.

One test per rule that would hurt if broken:

- 12g.1: a save keeps the choices; a reply phone that is another business's texting number, or its
  own, is refused and nothing saved; a business with no texts gets 409; a reminder added reaches an
  upcoming booking and not a past one, at the booking's current move; a reminder removed and added
  back sends once; a member without the permission cannot save.
- 12g.2: a person's texts save and turn off; a phone that is any business's texting number is
  refused; another business's person is 404 and a place 400; a member without the permission
  cannot save.

## Notes for the AI

- 12a's and 12f's patterns: client components through `dashboardApiClient`; each error under its
  field with `aria-describedby`; a refused save focuses the first bad field; saved and failed
  messages announced and cleared on the next edit. No TanStack Query (feature 14).
- Nothing pre-filled where the business must choose (decision 30): a person's three switches start
  unpicked; a new reminder's minutes are typed.
- Decided while planning, named so Frank can overrule: a reminder added on Settings also reaches
  upcoming bookings already made (an owner who adds "the evening before" expects tomorrow's
  customers to get it); a removed one stops, as the sending job already re-reads the settings.
- Comments beside the line they explain, one or two lines, no step or finding numbers.

## Decided

- Who sets a business's texting number (Frank, 2026-10-12, at 12g's plan): the agency gives it, with the
  business's first text choices from intake, in the setup file; the owner sees it and changes
  everything else. It is how a customer's reply finds its business, so an owner could otherwise claim
  a number meant for another business and get its replies.
