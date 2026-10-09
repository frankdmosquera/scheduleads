# Feature: The booking component

**From build-plan:** feature 9

**Branch:** `feature/09-the-booking-component`

**Status:** spec written 2026-10-08, waiting for the whole-feature pass, then step 9.1's yes.

## Goal

A customer on a business's own site presses "Book now", a modal in that site's
colours opens, they pick a service (unless the button already named one), a
day and a time, answer the standard and the business's own questions, press
Book once, and see that they are booked. The booking, the contact and the lead
land in that business through the public routes built in features 5 to 7, now
rate limited. The modal never names its provider.

This feature builds the component and proves it on a booking preview page inside this
repo. Wiring it into the agency's own site is feature 10.

## Decisions

1. **The component calls the API straight from the visitor's browser** (Frank,
   2026-10-08; answers project-plan open question 15). The public routes and
   their CORS from `WIDGET_ORIGINS` already exist (step 2.4); the rate limits
   see each visitor. Rejected: proxying through each host site's server
   action. Booking holds no secret (free times are public), and the proxy
   would need a key per site plus trusting the visitor address the host
   passes on, or every visitor would share one limit. The Sep 22 lean towards
   the proxy came from the clinic's store, where there was a secret.
2. **The code lives in a new workspace, `packages/booking-component`**
   (`@scheduleads-app/booking-component`), compiled by `tsc` to `dist/` like
   `packages/shared`, with its own CSS file. One source for every tenant.
   Rejected: building it inside `frontend/` (feature 10 would move it out of
   the CRM app), or a copy in each host site (four copies that drift). How a
   host site in another repo gets it (GitHub Packages, a git dependency) is
   feature 10's question; this feature keeps the package buildable on its own.
3. **Who does the job is a per-service setting** (decision 30, answering the
   build plan's "open until this item's spec"): `booking_link.personChoice`,
   `customer_picks` (a salon: the customer sees the people who do that
   service, and "Any available") or `business_assigns` (Primo's estimates:
   no choice shown, any available). No database default, so every new
   service states it; existing rows are backfilled `business_assigns`,
   which is exactly how every booking behaves today. The server enforces it:
   a person sent for a `business_assigns` service is refused, never ignored.
4. **The layout is a stored value**: `booking_link.layout`, only `month`
   allowed by its check for now (project-plan decision 11). The modal
   switches on it exhaustively, so the week strip in
   `prototypes/modal-primo.html` returns as one more value and one more
   branch. No database default; existing rows backfilled `month`.
5. **The business's own questions are a table, the answers a snapshot on the
   lead.** `booking_question` (per business, ordered, a label and whether it
   is required). The lead keeps each answer with the question's words as
   asked, so editing a question in feature 12 never rewrites what a customer
   was asked. Every answer is text for now; other kinds (a choice, yes or
   no) come with feature 12's ready-made sets for each trade, as a column
   whose existing rows read as text. Until feature 12 the questions are set
   by the seed and, for a real business, at its setup by hand.
6. **The modal opens on the service list when no service is named.** The
   header's "Book now" names none; a service page's button names its
   `bookingId` (face-and-body's contract: `Service.bookingId` is an opaque
   handle, here a booking link id; pages ask to book a service and do not
   know who answers).
7. **Rate limits are counted in the API's memory**, in fixed windows, written
   by hand (no package). The backend is one Railway instance; a restart
   forgets the counts, which lets at most one more burst through. Rejected: a
   Postgres counter table (a write on every public read and a cleanup job,
   for protection the one instance does not need yet) and
   `hono-rate-limiter` (a dependency for about forty lines). A second
   instance moves the counts to Redis (Frank, Oct 8: memory now, Redis
   then), written in the code beside the counter; routes reach the counter
   through one function, so the store can change under them.
8. **The limits** (agreed by Frank, Oct 8, at step 9.3's plan):
   - per visitor, every `/public/*` read: 60 a minute;
   - per visitor, every `/public/*` write (book, cancel, move): 10 in 10
     minutes;
   - per contact, bookings: 4 in 10 minutes for the same email, and
     separately for the same phone, in one business. A parent booking two or
     three children at once is never refused (5d, Oct 2); a script trying
     dozens is.

   A refusal is `429` with `Retry-After` and the usual shape:
   `too_many_tries`, "Too many tries. Please wait a minute and try again."
   A booking is counted just before it is saved, after the form's own
   booking is looked up, so a form sent again after a lost answer gets its
   booking and never "too many tries", while many sent at once cannot all
   pass. Copies of one form (its request key) are booked one after the
   other, in the API's memory like the counts: a copy sent while the first
   is still being saved waits, then gets that booking from the look-up.
   The count is handed back when the booking is refused (a taken time, a
   missing answer), crashes, or is the form's own booking answered again:
   only bookings made count against the contact (9.3). A count handed back
   after its window ended frees nothing in the next one.
9. **The Book button locks after one press and the form owns one key**
   (5d decision 7). The key is made when the details screen opens. A retry
   after a lost answer sends the same key, so the server answers with the
   booking that won. A new key is made only for a new form: after a
   booking, or when the modal is opened again.
10. **The modal is a native `<dialog>`** opened with `showModal()`: the
    browser gives the focus trap, Escape and the inert page behind it. Focus
    returns to the button that opened it.
11. **Times show in the business's time zone, named on the screen**, the same
    rule as the customer's page in 7b.
12. **The Sep 23 mock, checked against everything decided since** (Frank,
    Oct 9, before step 9.5). The shape stands (`prototypes/modal-month.html`,
    `modal-month-details.html`); eight details did not fit:
    1. Who does the job: the rail gets "Who would you like?", "Any
       available" first and chosen, then each person; only for
       `customer_picks` (Frank's yes).
    2. No time-zone switcher: every time in the business's zone, named under
       the calendar (Frank's yes). Note for feature 10: the agency's video
       calls may want the visitor's own clock, as a per-service setting.
    3. No struck-through busy times: the times route sends free times only,
       and showing busy ones would show the business's calendar.
    4. No location or footer line in the rail ("At your home...", "No charge,
       no obligation"): a service has no fields for them; the rail shows the
       service's description. Fields for them, if a business wants them, are
       feature 12's settings.
    5. The service list, absent from the mock, is the one built in 9.4.
    6. Screen two marks email and phone as "at least one is required", not
       all three required (the rule until feature 12).
    7. No "+ Add another contact": in no plan.
    8. The screens for when something goes wrong are 9.4's three, plus 9.6's
       "time taken".
    Frank asked to decide 3 to 8 without asking (Oct 9). The look itself gets
    a design review on the live preview page before `/complete`, with the
    `emil-design-eng` skill read from the blueprint for the polish.

## In scope

- `booking_link.layout` and `booking_link.personChoice`, migration and seed.
- The public routes grow: the business's face (name, logo, phone) and its
  questions with the service list; layout and personChoice with one service;
  the people with the times only when the customer picks; a person refused for a
  `business_assigns` service on the times route and the booking route.
- `booking_question`, `lead.answers`, answers sent with a booking, checked and
  saved, and shown in the business's booking notification email.
- Rate limits on every `/public/*` route.
- `PublicAppType`: the backend's type of the public routes only.
- The package: `BookingProvider`, `useBooking()`, `BookNowTrigger`, the modal,
  its CSS on `--sa-*` tokens, the month layout's three screens and the done
  screen, with every state below.
- A booking preview page for the platform admin, `/admin/booking-preview/[businessSlug]`, hosting the
  component in the agency's and Primo's tokens from `prototypes/`.
- The plans: open question 15 moved to decided, the build plan's "open until
  this item's spec" line answered.

## Out of scope

- Any host site, its `siteConfig`, `WIDGET_ORIGINS` values: feature 10.
- How another repo installs the package: feature 10.
- The week strip layout (parked, decision 4).
- The owner editing questions, layout, who-picks or the email or phone rule:
  feature 12. Until then "an email or a phone, at least one" stays the rule.
- Question kinds other than text (decision 5).
- The hosted page `/book/<slug>` (24), an embed script (named, not planned),
  deposits (open question 16).
- The customer's own booking page (7a, 7b) stays as built, except that a
  service the business assigns offers no pick of person there either (step
  9.1b, from F-256, Frank 2026-10-08).

## Build loop

`workflow.stepReview` is `every` and `checkpointCommits` is `enabled`.

**After the green light, nothing stops until the review.** Each step's plan
gets Frank's yes just before it is built. From that yes the step runs straight
through: build, tests and checks, tick the box, the build log entry, commit and
push to `feature/09-the-booking-component`, `/audit` scoped to the step, the
independent review. The planned stop is after the review, where the findings
are talked through. Earlier stops only for: the agreed plan proving wrong, a
line only Frank crosses (a package install, Railway or real data, `main`, a
merge, a force push, deleting anything), or blocking findings left unfixed.

## Build steps

- [x] **9.1 The service's two settings and the business's face.**
  Shared: `booking_link.layout` (text, not null, check `in ('month')`) and
  `booking_link.personChoice` (text, not null, check
  `in ('customer_picks', 'business_assigns')`), no database defaults, one
  migration that adds them, backfills existing rows (`month`,
  `business_assigns`) and then sets not null. The seed states both on every
  service: Summit Painting (dev) `business_assigns`, Riverbend Clinic (dev)
  `customer_picks`.
  Backend: `GET /public/:slug/booking-links` answers
  `{ business: { name, logo, phone }, bookingLinks }`.
  `GET /public/:slug/booking-links/:id` adds `layout` and `personChoice` to
  `bookingLink`. The people (active persons who do that service, nobody
  ticked meaning everyone, by name) are the times route's own `people`,
  which it already listed since 5c, now empty when the business assigns
  (amended at 9.1: one list, not a second copy on this route). The times route and `POST /public/:slug/bookings` refuse a person
  for a `business_assigns` service: 400, "This service does not take a pick
  of person." The owner's own path (`bookTime` with `source: manual`) is
  untouched.
  Plans: project-plan open question 15 moved into a decided entry (browser
  to API, 2026-10-08, decision 1's reason), the overview's open-questions
  line and fingerprint refreshed, the build plan's "open until this item's
  spec" sentence replaced by decision 3.
  **Done when:** route tests show the business face, both settings, people
  only for `customer_picks` (inactive and unticked people excluded as the
  rules say), and both refusals; the seed runs; backend and shared suites
  pass.

- [x] **9.1b The customer's own booking page follows who picks** (F-256,
  Frank 2026-10-08). Decision 3 reaches the 7b page: for a service the
  business assigns, "Change the time" lists no people and offers no pick.
  Backend: the booking page's answer carries the service's `personChoice`.
  The move times route (`GET /public/bookings/:token/times`) answers
  `people: []` for a service the business assigns and refuses a person
  asked for, 400 with the same "This service does not take a pick of
  person."; the move (`POST /public/bookings/:token/move`) refuses a
  person the same way, after its own "pressed twice answers the same" check
  so a repeat still answers as before. A service the customer picks for is
  unchanged (decision 14: the panel opens on her own person).
  Amended after the step's review (Frank, 2026-10-08, F-263 option A): a
  move with nobody picked, under either setting, keeps the booking's own
  person while they are free; someone else only when they are busy, and
  "try again" when their calendar cannot be read (F-265).
  Frontend: `change-time-panel.tsx` shows no person choice for a service
  the business assigns, asks the times with nobody picked (any available),
  and its last question names the time only. The booked person's name on
  the page stays: the customer is told who is coming.
  **Done when:** route tests show the empty people list, both 400s with
  nothing moved, a move with nobody picked moving, and the clinic's picker
  answers unchanged; the frontend builds; with the two Scheduleads dev
  servers running (3400, 3401), a painting-dev booking's page shows no
  painter list and a clinic-dev booking's page still shows its picker,
  screenshots taken; suites pass.

- [x] **9.2 The business's own questions, answered and saved on the lead.**
  Shared: `booking_question` (`id`, `organizationId`, `position` integer,
  `label` 1 to 200 characters, `required` boolean, timestamps;
  organization-scoped, cascade with the business) and `lead.answers` (jsonb,
  null when the business asks nothing: `[{ questionId, question, answer }]`,
  `question` being the label as asked). The create-booking schema takes
  `answers: [{ questionId, answer }]`, at most 20, each answer trimmed, at
  most 500 characters; the route's body limit grows from 16 KB to 64 KB to
  fit 20 full answers in multi-byte text. The seed gives each dev business
  two or three questions, one required.
  Backend: the service list's `business` carries
  `questions: [{ id, label, required }]` in position order. A booking is
  refused (400) with an answer to a question the business does not have, two
  answers to one question, or a required question unanswered or blank
  ("Answer: {label}"). `bookTime` saves the snapshot on the lead in the same
  transaction as the rest. The business's booking notification email shows
  each question and answer under the customer's own words, as text, never
  HTML.
  **Done when:** route tests cover saved answers with their words as asked,
  each refusal, a business with no questions (answers absent, lead.answers
  null); the email test shows the answers escaped; suites pass.

- [x] **9.3 Rate limits on the public routes.**
  Backend: one limiter (decision 7) in `backend/lib/rate-limit/`, a
  middleware on `/public/*` counting reads and writes per visitor, and the
  per-contact count inside the booking route after the body is valid
  (email lowercased and trimmed; phone through 8b's
  `textable-phone-number` helper, so `+1 403...` and `403...` are one phone,
  and any other number reduced to its digits), both
  keyed by business. The numbers and the refusal are decision 8. The clock
  is injectable for tests. The visitor's address: in production the address
  Railway's proxy puts in its header (the step confirms the header name from
  Railway's documentation and writes it in the code and the deploy notes),
  otherwise the socket's address. Each counter's window entry is dropped
  once it is over, so memory stays bounded by recent visitors. `/texts/*`
  (Twilio, signed) and the dashboard routes are not limited here.
  **Done when:** tests show the 61st read in a minute refused with
  `Retry-After` and allowed again in the next window, the 11th write
  refused, the 5th booking for one email refused while a second email from
  the same visitor still books, the 5th booking for one phone written
  different ways (`+1 403...`, `403-...`) refused (added with Frank, Oct 8),
  two businesses counted apart, and a parent booking two children at the
  same time both booked; suites pass.

- [x] **9.4 The package, the provider and the service list.**
  Backend: `PublicAppType`, the type of a Hono app holding only the
  `/public` routes, exported beside `AppType` through `build:types`, so the
  package never sees admin or dashboard route shapes.
  Package `packages/booking-component`: `package.json` (React and React DOM
  as peer dependencies; `hono` and `@scheduleads-app/shared` as
  dependencies, both already in this repo at the same versions, so nothing
  new is downloaded; Vitest as a dev dependency, likewise already here; the
  step's yes covers these declarations), `tsconfig`, `dist/` output keeping
  `"use client"`, and `booking-component.css` ported from
  `prototypes/widget.css` and `month.css`: every colour, font and radius
  reads a `--sa-*` token with a neutral fallback, no CRM token.
  Exports, documented in the package's `index.ts`:
  `BookingProvider({ apiUrl, slug, children })` wraps the host's children so
  server components stay server components; `useBooking()` returns
  `{ open(bookingId?: string) }`; `BookNowTrigger({ bookingId?, className?,
  ariaLabel?, children })` is one unstyled `<button type="button">`. Calls go
  through `hc<PublicAppType>` with credentials omitted, each with a
  10-second ceiling, so a stuck spinner is impossible.
  The modal (decision 10): opens on the service list when no `bookingId` is
  given (name, duration, description as text), or straight on that service.
  States: loading; no services ("Nothing can be booked online right now.",
  and the business's phone as a call link when it has one); a service id
  that is not offered (the same words); cannot load or too many tries (the
  message, Try again, and the phone).
  Frontend: the workspace dependency, and `/admin/booking-preview/[businessSlug]` for the
  platform admin only (anyone else gets the same not-found as a wrong
  address), a plain host page with a Book now button, one button per
  service, and a switch between the agency's and Primo's tokens.
  **Done when:** the package builds and its tests pass; the frontend builds;
  on the booking preview page with clinic-dev, Book now opens the service list,
  Escape closes it and focus is back on the button; a service button opens
  that service; a slug with no services shows the empty words; nothing on
  screen names the provider; the look switch moves the window between the
  agency's look and Primo's (added with Frank at the plan, Oct 9).
  Amended while building (Oct 9): the package also declares `typescript`,
  `@types/react` and `backend` (for `PublicAppType`, build time only) as dev
  dependencies, all already in the repo (Frank's yes, Oct 9). The phone shows
  wherever the business was read; when even the business could not be read
  (the first call failed) there is no phone to show. "Nothing to book" has no
  Try again. The preview page's not-found is Next's own 404 page, reached
  after the session check in the browser, so its HTTP status is 200. The week
  strip's classes in `widget.css` were not ported (decision 4 parks that
  layout).

- [x] **9.5 Screen one: pick a time.**
  The left rail: the business's logo (or its name), the service, its
  duration and description. When the service is `customer_picks`: "Who
  would you like?", "Any available" first and chosen, then the people by
  name (decision 12). A month calendar from today to the horizon,
  times asked one month at a time (the route's 31-date limit), days with a
  time marked and pickable, the chosen day's times listed, the time zone
  named. Previous month stops at the current month, next stops at the
  horizon. The first day with a time is chosen when a month loads, so its
  times show at once. A chosen time splits into the time and Next; Next
  opens screen two, an empty shell until 9.6. States: loading; no times this
  month ("No times left in {month}." and Next month while the horizon
  allows); cannot read times (503: the route's own words, "Times cannot be
  read right now. Try again shortly.", Try again, the phone); too many tries
  (9.4's words). Changing the person reloads the month. The day and time
  picks are keyboard reachable buttons with clear names ("Thursday,
  October 15", "9:30 AM").
  Logic, in plain functions with tests: the month's grid, grouping times by
  day in the business's zone, the month bounds from today and the horizon.
  **Done when:** those tests pass, and on the booking preview page with clinic-dev
  (customer picks) and painting-dev (business assigns) a time can be picked,
  each state is shown by a real case where one exists (a closed day, a month
  past the horizon), and screenshots of both themes are taken.
  Built (Oct 9): the window now keeps the one-service answer's
  `availability` (the business's zone and horizon) for the calendar; screen two is an empty
  shell whose rail keeps the picked time, the person and the zone, and Back
  returns to the same month and person. The picked time is set in the
  times' own font, not the mock's monospace, which wrapped "10:00 a.m.".
  Not seen live, because the seed has no such case: a month with no times
  left, and a calendar that cannot be read (503); both are covered by
  tests of what the window is handed.

- [ ] **9.6 Screen two, Book, and done.**
  The rail adds the chosen time. The standard questions: name, email,
  phone, address, what they want done; "At least one is required" under
  email and phone; then the business's own questions, required ones marked.
  Checked in the browser with the shared create-booking schema before
  sending; each error under its field, tied with `aria-describedby`,
  `aria-invalid` set, focus on the first wrong field, cleared when that
  field is edited. Book locks after one press, shows it is sending, and
  sends the form's key (decision 9). Answers: time taken (back to screen one
  with the route's words and the times reloaded), form already used,
  cannot read, too many tries, a lost connection (the choice kept, Try
  again with the same key). Done: "You're booked", the service, the time
  with its zone, the person, and "A confirmation is on its way to {email}"
  when an email was given. Closing and opening again starts a new form.
  User text (the customer's own and the business's labels) is rendered as
  text only.
  **Done when:** on the booking preview page a real booking is made in clinic-dev with
  answers, and the lead, its answers and the booking are in the database;
  pressing Book twice quickly makes one booking; a taken time (booked from a
  second tab) shows the taken message with fresh times; each field error
  shows and clears; suites pass.

- [ ] **9.7 The yes to text messages.** Waiting on the open question below;
  its plan is written once it is answered, before step 9.6 if the answer
  changes screen two.

## Files / areas

- `packages/shared/db/booking-tables/booking-link-table.ts`, a new
  `packages/shared/db/crm-tables/booking-question-table.ts`,
  `packages/shared/db/crm-tables/lead-table.ts`, `packages/shared/db/index.ts`,
  `packages/shared/migrations/`, `packages/shared/scripts/seed-dev.ts`.
- `packages/shared/zod-validation/booking-links-validation-schemas/create-booking-validation-schema.ts`.
- `backend/routes/public-booking-links-routes.ts`,
  `backend/routes/public-bookings-routes.ts`, their tests;
  `backend/lib/booking/book-time.ts`;
  `backend/lib/scheduling/find-service-resources.ts` (who does a service);
  `backend/emails/booking-notification.tsx`; a new `backend/lib/rate-limit/`
  and `backend/middleware/public-middleware/`; `backend/app.ts`,
  `backend/tsconfig.types.json`, `backend/package.json` (the
  `PublicAppType` export).
- New `packages/booking-component/`.
- `frontend/package.json`, a new `frontend/app/admin/booking-preview/[businessSlug]/`.
- `blueprint/project-plan.md`, `blueprint/build-plan.md`,
  `blueprint/context/project-overview.md` (step 9.1's plan lines).

## Data / contracts

- `booking_link.layout`: `'month'`. `booking_link.personChoice`:
  `'customer_picks' | 'business_assigns'`. Both not null, no default.
- `booking_question`: `id` text (the repo's id generator), `organizationId`,
  `position` integer (order; not unique), `label` 1 to 200, `required`
  boolean not null, `createdAt`, `updatedAt`. Unique on
  `(organizationId, id)` for scoped lookups.
- `lead.answers`: jsonb, null or
  `[{ questionId: string, question: string, answer: string }]` in the
  business's question order; an optional question left blank is left out.
- `GET /public/:slug/booking-links` 200:
  `{ business: { name, logo: string | null, phone: string | null,
  questions: [{ id, label, required }] }, bookingLinks: [...] }`.
- `GET /public/:slug/booking-links/:id` 200:
  `{ bookingLink: { ...as now, layout, personChoice }, availability }`.
- `GET /public/:slug/booking-links/:id/times` 200: as since 5c,
  `{ timezone, people: [{ id, name }], startTimes }`, `people` empty when
  the business assigns (amended at 9.1), plus `localStartTimes:
  [{ startsAt, date, time }]`, each time's business date and clock label
  worked out by the API, which the window shows as sent (F-279, 9.5 review);
  each also carries `when`, the whole moment as the emails say it (F-281).
- `GET /public/bookings/:token` 200: the booking gains `when`, and
  `GET /public/bookings/:token/times` 200 gains the same `localStartTimes`;
  the customer's page shows those as sent (F-281, 9.5 review).
- `POST /public/:slug/bookings` body adds
  `answers?: [{ questionId, answer }]`. New refusals: 400 person not taken,
  400 answers; 429 `too_many_tries` with `Retry-After` (seconds).
- Every public refusal keeps `{ error: { code, message } }`.
- Theme tokens the host defines (from `prototypes/theme.css`):
  the `--sa-*` set used by `widget.css` (`--sa-bg`, `--sa-surface`,
  `--sa-surface-2`, `--sa-text`, `--sa-muted`, `--sa-border`,
  `--sa-identity`, `--sa-identity-ink`, `--sa-font`, `--sa-font-mono`,
  `--sa-radius`, and the rest the port finds), each with a fallback.

## Testing

- Backend (Vitest, local `scheduleads_dev`): route tests for 9.1 to 9.3,
  `bookTime` answers, the notification email, the limiter with a pinned
  clock. Each new rule's test is shown able to fail.
- Shared: the create-booking schema's answers.
- Package (Vitest, new in 9.4): the month grid, grouping by day in a zone,
  month bounds, the request key's lifetime.
- No browser test harness exists (`Browser tests` not declared), so the
  screens are checked by hand on the booking preview page with screenshots, named as
  such in each report, not claimed as automated.
- No `Verify` command exists; each step runs the shared and backend suites,
  the package's tests, and the frontend build.

## Deploy notes

- The per-visitor limits read the visitor's address from `X-Real-IP`, the
  header Railway's proxy adds (Railway's networking docs, Specs & Limits),
  only when `NODE_ENV=production`; the API must run with it set. Railway's
  docs do not say whether the proxy replaces an `X-Real-IP` a visitor sends
  themselves: check it at the first deploy (send one with curl and see
  which address the API counts), with F-176 and F-179.
- The counts live in the API's memory: one API copy (one replica). A second
  copy moves them to Redis first (decision 7).

## Notes for the AI

- Never the word scheduleads, or any name of this product, anywhere a
  customer can see it: text, titles, `aria-*`, alt text.
- Every class in the package's CSS is `sa-` prefixed so it cannot collide
  with a host's; it reads only `--sa-*` tokens (`prototypes/widget.css`'s
  own rule: a CRM token in it is a bug).
- The public routes stay one identical "not here" for an unknown business,
  service or inactive service; the new people list never reveals a person's
  login, email or phone.
- The package does not import from `frontend/`; the booking preview page imports the
  package, never the other way.
- 8b's texts, 6's emails and 7's links are unchanged by 9.1 to 9.6.
- Only a note for feature 10: no `agents-web` folder exists on this laptop;
  tenant zero's site is probably `agency-site-app`.

## Open questions

1. **What does the customer's "yes to text messages" do?** The build plan
   (Oct 2) puts an optional yes on screen two. Feature 8b (Oct 7) since
   sends the confirmation and reminder texts to any textable phone a
   booking carries, as messages about a booking the customer asked for.
   Either the yes decides whether this customer gets those texts (an
   unticked box means no booking texts, and owner-made bookings need the
   same choice), or it is only saved on the contact for later messages and
   booking texts go as now. Decided before step 9.6.

Note for later (Oct 8, not this feature): the limits stop a script from one
address, not one that keeps changing addresses, emails and phones. The usual
next layer is an invisible bot check on the Book button; no plan holds it.
Added only if fake bookings show up.
