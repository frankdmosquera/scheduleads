# Feature: Booking links, resources and availability rules

**From build-plan:** feature 2

**Branch:** `feature/booking-links-resources-and-availability-rules`

**Status:** verified

Approved step by step (decided 2026-09-25; see `AGENTS.md`, "A spec is
approved one step at a time"): each of steps 2.1 to 2.6 got Frank's yes just
before it was built. Verified 2026-09-28 by `/complete`'s final safety pass.
Rewritten 2026-09-25 to match version 8 of the booking
model, which Frank approved that day (the build log's "How it all fits
together", and `project-plan.md` decisions 20 to 29). Where this spec and an
older note disagree, version 8 wins.

## Goal

Give every business the three scheduling primitives the rest of the product
reads: its booking links (one per service), its resources (the people and
places that do or host the work), and its bookable hours (when customers can
book). Serve them on a public, read-only route a stranger's browser can call,
resolve bookable hours through one function every later item reuses, and
make the frontend call the API through `hc<AppType>` so a broken contract
stops the build instead of failing at runtime.

## In scope

- Three tables in `packages/shared`: `resource`, `booking_link`,
  `availability_rule`, with one migration.
- A resource is **one person or one place** (a room, a chair), never a
  group, and a column says which.
- **Every business has a first person, made automatically**: for every
  business that already exists, in the migration; for every new one, in a
  Better Auth hook. It is the business owner, named after the business.
- A booking link carries its length and **a buffer before and a buffer
  after**, any number including zero.
- `availability_rule` holds **bookable hours**: when customers can book
  online, not opening hours and not time at work. Unique per organization
  **and** resource. A null `resourceId` is the business's own row; a set one
  is that person's. The null-safe uniqueness is enforced by the database,
  not by code (see Data / contracts).
- A person's week is their own if they have one, otherwise the business's.
  A person can have **one-off dates** (hours on one date) without copying
  the week.
- **Set once per business, on the business's row only**: time zone, minimum
  notice, how far ahead customers can book, closed dates, the country and
  province, and the holidays the owner picked to close. The database refuses them on a
  person's row, so there is nothing to copy and nothing to drift.
- **Closures are for everyone, openings beat them**: a closed date or
  holiday closes online booking for everyone, whatever their own week says;
  a one-off date on it opens it again, for that person, or for everyone when
  it is the business's.
- A resource's rule can only point at a resource of the **same**
  organization, enforced by a composite foreign key.
- Zod validation schemas for a weekly-hours value, a one-off date and a
  whole rule, in `packages/shared`, used by every writer (the seeds now,
  settings in item 12).
- `resolveBookableHours`: the one function that works out, for a business and
  optionally one person, the week, the one-off dates, the closed dates
  within the horizon, and the business's settings.
- Two public routes, keyed by organization slug:
  `GET /public/:slug/booking-links` and
  `GET /public/:slug/booking-links/:bookingLinkId`.
- A public CORS rule for those routes, separate from the dashboard's, that
  never allows credentials, with origins from `WIDGET_ORIGINS`.
- The dev seed extended so both dev businesses have bookable data: the
  made-up painting company and clinic approved in 2.3. (A command that wrote
  links and hours into a real client's business was dropped on 2026-09-25:
  a client's hours are always set by the client in the app. See Out of
  scope.)
- The typed seam: the backend exports `AppType`, the frontend builds its
  client with `hc<AppType>` from `hono/client`, `fetchMe` moves onto it (its
  hand-written types go), and the dashboard home lists the business's active
  booking links through the public list route.
- Correcting the coding standard that says `AppType` lives in
  `packages/shared`. It cannot: see Notes for the AI.

## Out of scope

- Computing bookable slots, and `GET /public/:slug/availability`. Items 5
  and 9.
- Who does what (skills and rooms), the commitments table, standby and off,
  and the customer picking a person. Item 5; the owner ticks and sets them
  in items 12 and 12b.
- Linking a person to a login. Nothing in this item reads the link; the
  first item that does (item 3's per-person Google, or item 12b's calendars)
  adds it as one nullable column.
- The holiday picker (all the province's main holidays in one click, or one
  by one), and the one-click close and open screens. Item 12. Here nothing
  is closed by default; the seeds write the picks, closed dates and one-off
  dates.
- Any write route or settings screen for links, resources or hours. Item 12.
  Until then the dev seed is the only writer, and only on the local database.
- Any command that writes links or hours into a real client's business.
  Dropped by Frank, 2026-09-25: hours are always the client's own, set in
  the app; even when a new client asks for help with setup, it is done with
  them in Settings. The one gap this leaves, the agency's own business going
  live in item 10 before Settings exists in item 12, is noted on item 10.
- Calendar connection and free/busy. Item 3.
- Bookings, contacts, leads. Items 4 and 5.
- Per-resource screens. Nothing builds one until a tenant has two people.
- React Query. It arrives with the first screen that needs caching; this
  item's one list reads once on page load.
- Rate limiting the public routes. Recorded as a risk, not built.

## Build loop

`workflow.stepReview` is `every` and `workflow.checkpointCommits` is
`enabled`. Each step is committed and pushed without asking (Frank's standing
yes for feature branches, 2026-09-26, in `AGENTS.md`), then gets `/audit` scoped to
the step and the independent review, and P0/P1 findings are fixed or accepted
before the next step starts. Each step's commit message starts with its
number (`feat: 2.1 ...`). The build log is republished at every step.
`/complete` makes the final commit and asks before merging.

## Build steps

- [x] **2.1 The three tables, the first person, and their validation.**
  Add `resource`, `booking_link` and `availability_rule` to
  `packages/shared/db/drizzle-schema.ts` exactly as in Data / contracts,
  with a comment beside the two uniqueness indexes saying why they are two
  (a future reader will otherwise "simplify" them into the broken single
  constraint), and one beside the check that keeps business settings off a
  person's row. Add `weeklyHoursValidationSchema`,
  `dateHoursValidationSchema` and `availabilityRuleValidationSchema` under
  `packages/shared/zod-validation/availability/`, exported through the
  existing `index.ts`. Generate the migration from `packages/shared`, add by
  hand the one statement that gives every existing organization its first
  person (kind `person`, named after the organization), and read the SQL
  before applying it. Then add `organizationHooks.afterCreateOrganization`
  to the organization plugin in `backend/lib/auth/auth-server.ts`, creating
  the same first person for every new business. It runs after the business
  is saved, not in the same transaction, which fails safe: a business
  without a person cannot take a booking.
  **Done when:** `db:generate` produces one migration whose SQL contains the
  partial unique index `WHERE "resourceId" IS NULL`, the composite unique
  index, the composite foreign key, the check on business-only columns, and
  the backfill; `db:migrate` applies it to `scheduleads_dev` and every
  existing organization then has exactly one resource; creating a business
  through the API as the platform admin gives it its person; and by hand in
  `psql`, four inserts are refused: a second business row for one
  organization, a second rule for one resource, a rule naming another
  organization's resource, and a person's rule carrying a time zone. The
  Vitest tests for the three validation schemas pass (added 2026-09-25, when
  the test runner went in). Both builds pass.
  **Approved by Frank, 2026-09-25**, point by point: the three tables and
  the four refusals; the first person starts with the business's name and
  the owner decides the final name (renamed in settings, feature 12); these
  checks as the proof.

- [x] **2.2 The resolution function.**
  `backend/lib/bookable-hours/resolve-bookable-hours.ts` exports `resolveBookableHours(
  organizationId, resourceId | null, now)`. It reads the business's row and,
  when `resourceId` is set and that person has a row, the person's row. Both
  queries filter on `organizationId` first. It returns
  `ResolvedBookableHoursType` (Data / contracts), or `null` when the
  organization has no business row. The rules, in one place:
  - **Week:** the person's own, if their row has one; otherwise the
    business's.
  - **One-off dates:** the person's own. A person following the business's
    week also gets the business's one-off dates; on the same date, the
    person's own wins.
  - **Closed dates:** the business's closed dates (and holidays, from 2.6)
    inside the horizon, minus every date that has a one-off date for this
    person or for the business. A business opening a closed day opens it
    for everyone, each on their own hours.
  - **Time zone, notice, horizon:** always the business's.
  `now` is a parameter so the horizon is testable. The horizon runs from
  today in the business's time zone to today plus `horizonDays` (60 days on
  Sep 25 ends Nov 24); dates before or after it are dropped.
  **Split in two (Frank, 2026-09-25):** the rules are a pure function,
  `applyBookableHoursRules` in `backend/lib/bookable-hours/apply-bookable-hours-rules.ts`, with
  no database; `resolveBookableHours` only reads the rows and hands them
  over. The first version of this Done when said "against seeded rows", but
  the seeds are 2.3, so it could not be met in order.
  **Done when:** Vitest, in the backend, proves the rules half: a person's
  own week; the business's week for a person with no row; the business's
  week plus their date for a person with only a one-off date; on the same
  date the person's one-off date beats the business's; a business closed
  date closed for a person with their own week; a person's one-off date
  opening a closed day for them only; a business one-off date opening it
  for everyone; and past and beyond-horizon dates dropped. By hand, with
  rows added in `psql` and removed after, the database half returns `null`
  for a business with no business row, `null` for another business's
  person, and a real answer for a person with a row and one without. All
  tests pass, shared's included, and the backend build passes.
  **Approved by Frank, 2026-09-25**, point by point: the rules; the split
  and Vitest in the backend; this Done when.

- [x] **2.3 The seeds.**
  Extend `packages/shared/scripts/seed-dev.ts` so, idempotently, the two dev
  businesses are made-up versions of the real client shapes (**approved by
  Frank, 2026-09-25**; they replace `agency-dev` and `test-salon-dev`, the
  two logins stay):
  - **Summit Painting (dev)**, `painting-dev`, owned by `admin@example.com`,
    shaped like Primo: a business row with several windows a day and Sunday
    open; the owner (first person, an estimator), a second estimator and six
    painters; three booking links with buffers: interior estimate, exterior
    estimate, colour consultation. Crews and jobs join in feature 19.
  - **Riverbend Clinic (dev)**, `clinic-dev`, owned by `owner@example.com`,
    shaped like Face and Body and bigger: a business row; six practitioners
    with mixed hours (some their own week, some following the clinic, one
    weekends only, one with only a one-off date); five rooms (kind `place`):
    rooms 1 and 2 massage only, room 3 massage and facials, room 4 massage
    and body treatments, room 5 laser only; ten of her real treatments with
    her real lengths (from `face-and-body/data/servicesData.ts`: facials, a
    peel, massages, laser, a body wrap), massages with 15 minutes after for
    room turnover.
  The room layout above is the contract for feature 5: which treatment needs
  which room, and who does what (at most four practitioners do massage, so
  massage never runs out of rooms; facials compete for room 3; laser has one
  room), are wired from it then, not invented again.
  Each business's first person is used, never duplicated, and **created by
  the seed when missing**: on a fresh database the 2.1 backfill runs before
  the seed makes any business, and the seed inserts businesses directly, so
  the Better Auth hook never fires (review finding F-17, 2026-09-25). The
  local database is rebuilt from scratch to prove it. The planned
  `db:seed-booking-link` command for real clients was dropped on
  2026-09-25 (see Out of scope).
  **Done when:** the local `scheduleads_dev` is dropped and rebuilt from
  scratch (`db:migrate`, then `db:seed`; it only ever held seed data);
  Summit Painting then has its owner, a second estimator, six painters,
  three booking links and its business row, and Riverbend Clinic its owner,
  six practitioners with mixed hours, five rooms and ten booking links, each
  business with exactly one first person; `db:seed` run a second time
  changes no row count; every hours row is parsed by the 2.1 validation
  schemas before it is written, and the seed stops on a bad one; by hand,
  `resolveBookableHours` gives the weekends-only practitioner her own week and
  the practitioner with only an extra date the clinic's week plus that date;
  all tests and both builds pass.
  **Approved by Frank, 2026-09-25**, point by point: the two made-up
  businesses and the clinic's five-room layout; the real-client command
  dropped; this Done when, including rebuilding the local database.

- [x] **2.4 The public routes.**
  Split `backend/server.ts` into `app.ts` (routes, exports `app` and
  `AppType`) and `server.ts` (only `serve`), so importing the type never
  starts a server. Add `backend/routes/public-booking-links-routes.ts` with
  the two routes in Data / contracts, mounted under `/public` with
  `backend/middleware/public-middleware/public-cors-middleware.ts`: origins
  from `WIDGET_ORIGINS` plus the dashboard origin, `credentials: false`,
  `GET` only. `WIDGET_ORIGINS` is already in `.env.example`. `refuse` in
  `backend/lib/errors/refuse.ts` gains `not_found` and `bad_request`. The org
  is found by slug, and the link only by `(organizationId, bookingLinkId)`,
  never by id alone. **A business whose plan does not include `booking`
  gets the same 404** (agreed with Frank, 2026-09-26): one more condition on
  the organization lookup, through `subscriptionIncludes`.
  **Done when:** saved Vitest tests in the backend call the app against the
  local seeded database (refusing any database that is not local or not
  `*_dev`, like the seed) and prove: both routes return the documented shape
  with no `organizationId` anywhere; an unknown slug, an unknown link, an
  inactive link, another business's link under this slug, a business with
  no business row, and a business whose plan lacks booking all return the
  identical `404` body; a malformed slug or id returns `400` in the same
  error shape; and no response carries `Access-Control-Allow-Credentials`.
  By hand, in a real browser, a `fetch` from an allowed origin reads the
  answer and one from a disallowed origin is blocked. All tests and the
  backend build pass. The backend tests then need the local Postgres
  running; the 2.2 tests stay pure.
  **Approved by Frank, 2026-09-26**, in two parts: what it builds (pieces 1
  to 5, the plan-without-booking blocker first, answered yes); this Done
  when, as saved tests plus the browser by hand.
  **Built 2026-09-26**, all five pieces as planned: `app.ts` / `server.ts`,
  `routes/public-booking-links-routes.ts`, `publicCorsMiddleware`, `refuse`
  with `not_found` and `bad_request`, and two address schemas in
  `packages/shared/zod-validation` (`organizationSlugValidationSchema`,
  `bookingLinkIdValidationSchema`). 19 saved tests in
  `backend/routes/public-booking-links-routes.test.ts`, three planted faults
  caught; the browser half checked by hand. No plan without booking exists
  until feature 23, so the test uses an unrecognised plan in its place.

- [x] **2.5 The typed seam, proved.**
  Plan written and agreed Sep 27, both parts (piece 1, the blocker, answered
  yes). **Built 2026-09-27**, all five pieces as planned, plus `AGENTS.md`'s
  "not wired yet" line updated. By hand: the three links, the empty state,
  can't reach and its recovery, `/me` as before. Broken on purpose: the
  renamed route failed in `api-client.ts`, the renamed field in
  `booking-links-list.tsx`; both passed restored. Not pressed by hand: the
  list's own Try again (its state was seen once).
  1. `hono ^4.13.8` in `frontend` for `hono/client` (needs a yes, Open
     question 1), plus the workspace link `"backend": "*"`.
  2. `backend/tsconfig.types.json` writes only the routes' declarations into
     `backend/dist/types/`; `backend/package.json` gets `build:types` and a
     types-only export `backend/app-type`. The **frontend's** `predev` and
     `prebuild` run it after the shared build. Corrected Sep 27: the spec
     said "emitted by the backend build", but Vercel builds only the
     frontend, and old declarations left in `dist/` would let a renamed
     route pass the build. Declaration emit checked Sep 27: clean, status
     codes included.
  3. `frontend/lib/api-client.ts` builds two clients from one `AppType`:
     `dashboardApiClient` (sends the cookie) and `publicApiClient` (never
     does). Corrected Sep 27 from "one client": 2.4's public CORS rule has
     `credentials: false`, so a credentialed request to `/public/*` is
     blocked by the browser. `fetchMe` moves onto the dashboard client;
     `MeType` becomes the inferred type of `/me`'s 200 answer.
  4. `frontend/components/booking-links/booking-links-list.tsx` (new) takes
     the slug from `/me` and reads `GET /public/:slug/booking-links` once on
     page load: loading, list (name and length, name order), empty, not
     open for online booking yet (the public 404: no bookable hours until
     feature 12, or a plan without booking; no Try again, added by F-29 on
     2026-09-27), and unreachable with Try again. `page.tsx` renders it under the business
     card.
  5. Correct both `AppType` lines in `coding-standards.md` (File
     Organization and Data Fetching), adding the two-clients rule.
  Not in this step, said out loud: React Query (Out of scope), and the dev
  server does not pick up a renamed route's types until restarted.
  **Done when:** by hand, signed in as `admin@example.com`, the home lists
  `painting-dev`'s three links in name order; switched off for a moment in
  the local database, the empty state shows; with the API stopped, the
  unreachable state shows and Try again recovers; `/me` shows the business
  card as before and signed out still redirects to sign in. Then, broken on
  purpose: the list route renamed makes `npm run build --workspace=frontend`
  **fail with a type error** in `api-client.ts`, and `durationMinutes`
  renamed makes it fail where the list reads it; each passes once restored.
  All four outputs go on the step's page. Saved tests, both builds and lint
  pass. No new saved tests: the frontend has no test runner, and adding
  one needs a yes.

- [x] **2.6 Holidays the owner picks.**
  The business's row says its country and province (`holidayCountry`,
  `holidayRegion`) and, new, which holidays the owner has picked to close
  (`closedHolidays`). The picked holidays inside the horizon, in the
  business's time zone, join the closed dates in `resolveBookableHours`,
  where a one-off date opens them like any closed date. **Nothing is closed
  by default: we build the functionality, the client decides their schedule**
  (Frank, 2026-09-28). The picker screen is feature 12.
  **Plan, rewritten 2026-09-28, five pieces.** The first
  version (2026-09-27) closed Alberta's nine statutory holidays for every
  business automatically, following version 8's "the whole year on by
  default". Frank reversed that: none closes until the owner picks it.
  1. Blocker: the holiday source (Open question 2). Recommended
     `date-holidays` in `backend` only: every province, Easter days, kept
     current by its maintainers; about 11 MB and four helper packages.
     **Answered 2026-09-28: yes, the whole package, no `--pick`.** Added as
     `date-holidays ^3.37.0`. The plan's size was wrong: 11 MB was the
     package alone; with its helpers it is 43 MB on disk and twelve
     packages (moon tables, moment, lodash), none with install scripts.
     Measured in memory: about 9 MB alone, about 3 MB on top of the running
     API (~215 MB). `holidays2json --pick CA,US` was weighed and left out:
     it saves memory only, and needs a hook that fails quietly.
  2. The owner picks; nothing is closed by default. A new column,
     `closedHolidays`, on the business's row: a list of holiday names
     (`"Family Day"`), empty = none closed, refused on a person's row like
     every business setting. Names, not dates, so a picked holiday lands on
     the right date every year. The names come from the province's list and
     the country's national one (an Alberta business can also pick National
     Day for Truth and Reconciliation, which is national only). "All the
     province's main holidays in one click" is the picker's, feature 12.
     One migration, generated from `packages/shared`.
  3. `backend/lib/bookable-hours/closed-holidays.ts` (new, the only file
     that knows the source) gives the dates of the picked holidays between
     two dates; `applyBookableHoursRules` adds them to the closed dates
     before one-off dates open any; a horizon past New Year asks for both
     years. `resolveBookableHours` passes the three columns along.
  4. A picked name or a province the source does not know throws, like a
     business row missing a setting: a business that silently lost its
     Christmas closure would take bookings on Christmas Day. No picks, or no
     country, means only its own closed dates.
  5. The seed: both made-up businesses `CA` / `AB`. The painting company
     picks all nine statutory days (the one-click case); the clinic picks
     four by hand (New Year's Day, National Day for Truth and
     Reconciliation, Canada Day, Christmas Day: the pick-and-choose case).
     Set on existing rows with no picks too, so no machine needs a rebuild.
     The shared validation schema gains `closedHolidays`.
  **Done when:** saved tests on the rules with a fixed `now`: a business
  with no picks gets only its own closed dates; Family Day picked closes Feb
  16 in 2026 and, in 2027 when February 1 is a Monday, Feb 15; all nine
  picked close exactly nine dates in a year; a national-only pick (Truth and
  Reconciliation, Sep 30) closes for an Alberta business; Heritage Day,
  not picked, stays open; a one-off date on a picked Canada Day opens it for
  that person only; a horizon past New Year gets both years; an unknown name
  or province throws; planted faults make the right tests fail. By hand,
  today: the migration applies to the local database, which refuses
  `closedHolidays` on a person's row; the painting company's public detail
  route lists Thanksgiving (Oct 12) and Remembrance Day (Nov 11); the
  clinic's lists Sep 30, Dec 25 and Jan 1 and not Thanksgiving; the seed
  run twice changes nothing the second time; the lockfile gains only the
  package and its helpers, and the frontend build does not contain it. All
  tests, both builds, lint and the format check pass.
  **Changed from the first Done when (2026-09-27):** it asked the public
  route to show Family Day and Canada Day, but no business books that far
  ahead (60 and 120 days end late November and late January), so those are
  proved by saved tests with a fixed date.
  **Approved by Frank, 2026-09-28**, in two parts: what it builds (pieces 1
  to 5, the holiday-source blocker first, answered yes); this Done when.
  **Built 2026-09-28** (`5a30d47`), all five pieces as planned, plus one
  addition: picks need a country, refused by the database
  (`availability_rule_holidays_need_country_check`) and the form check.
  Migration `0002_closed_holidays`. 8 saved tests on the rules and 4 on the
  form check, three planted faults caught. **Review fixes, 2026-09-28:**
  F-31, the horizon is at most 365 days (migration `0003`); F-32 carried to
  feature 12; F-33, this block and the Files list brought up to date.

## Files / areas

- `packages/shared/db/booking-tables/` - three tables, one file each (split from
  `drizzle-schema.ts` on 2026-09-27)
- `packages/shared/migrations/` - `0001` (the three tables, plus the backfill),
  `0002_closed_holidays`, `0003_horizon_at_most_a_year`
- `packages/shared/zod-validation/availability-validation-schemas/` - three validation
  schemas, exported from `zod-validation/index.ts`
- `packages/shared/scripts/seed-dev.ts`
- `backend/lib/auth/auth-server.ts` (the first-person hook),
  `backend/app.ts` (new), `backend/server.ts` (reduced),
  `backend/routes/public-booking-links-routes.ts` and its test,
  `backend/middleware/public-middleware/public-cors-middleware.ts`,
  `backend/lib/bookable-hours/resolve-bookable-hours.ts`,
  `backend/lib/bookable-hours/apply-bookable-hours-rules.ts` and its test,
  `backend/lib/bookable-hours/closed-holidays.ts` (2.6),
  `backend/package.json` (`date-holidays`), `backend/tsconfig.json`,
  `backend/tsconfig.types.json`
- `frontend/lib/api-client.ts`, `frontend/app/page.tsx`,
  `frontend/components/booking-links/booking-links-list.tsx`,
  `frontend/package.json`
- `.env.example`, `blueprint/context/coding-standards.md`

## Data / contracts

Ids are text from `randomUUID()`, as in `seed-dev.ts`. Timestamps are
`timestamptz`. Every table cascades on organization delete.

**`resource`** - one person or one place, never a group.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | |
| `organizationId` | text, not null | FK `organization.id` |
| `name` | text, not null | the first person is named after the business |
| `kind` | text, not null, default `person` | check: `person` or `place` |
| `active` | boolean, not null, default true | |
| `createdAt`, `updatedAt` | timestamptz, not null, default now | |

Unique `(organizationId, id)`, which exists only so `availability_rule` can
reference both columns.

**`booking_link`** - a service; the handle a host site stores as
`Service.bookingId`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | |
| `organizationId` | text, not null | FK `organization.id` |
| `name` | text, not null | |
| `slug` | text, not null | unique per organization, same rule as the org slug |
| `description` | text, nullable | |
| `durationMinutes` | integer, not null | check `> 0` |
| `bufferBeforeMinutes` | integer, not null, default 0 | check `>= 0` |
| `bufferAfterMinutes` | integer, not null, default 0 | check `>= 0` |
| `active` | boolean, not null, default true | inactive reads as absent publicly |
| `createdAt`, `updatedAt` | timestamptz, not null, default now | |

Nothing reads the buffers until item 5, which keeps them inside a booking's
stored time.

**`availability_rule`** - bookable hours.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | |
| `organizationId` | text, not null | FK `organization.id` |
| `resourceId` | text, nullable | null = the business's row |
| `weeklyHours` | jsonb, nullable | required on the business's row; null on a person's row = follows the business's week |
| `dateHours` | jsonb, not null, default `[]` | one-off dates, shape below |
| `timezone` | text | business's row only; IANA name; every minute and date is local to it |
| `minimumNoticeMinutes` | integer | business's row only; check `>= 0` |
| `horizonDays` | integer | business's row only; check `between 1 and 365` (at most a year ahead, since 2.6's review, F-31); no default, a writer sets it |
| `closedDates` | jsonb | business's row only; `YYYY-MM-DD` list |
| `holidayCountry` | text, nullable | business's row only; ISO 3166-1 alpha-2; null = no holidays |
| `holidayRegion` | text, nullable | business's row only; the province, e.g. `AB`; needs a country |
| `closedHolidays` | jsonb, not null, default `[]` | business setting (2.6): the holiday names the owner picked to close, `[]` = none, nothing closed by default; a person's row must keep it empty; picks need a country |
| `createdAt`, `updatedAt` | timestamptz, not null, default now | |

One check keeps the two kinds of row honest: when `resourceId` is null,
`weeklyHours`, `timezone`, `minimumNoticeMinutes`, `horizonDays` and
`closedDates` are all set; when it is set, `timezone`,
`minimumNoticeMinutes`, `horizonDays`, `closedDates`, `holidayCountry` and
`holidayRegion` are all null and `closedHolidays` is empty (2.6). A person's row therefore holds only their own
week and their one-off dates, and changing a business setting changes it
for everyone.

Uniqueness, both indexes required (`resource-model-proposal.md` section 4):
a partial unique index on `(organizationId) WHERE "resourceId" IS NULL` for
the business's row, and a unique index on `(organizationId, resourceId)`
for per-person rows. A single `unique(organizationId, resourceId)` would
allow two business rows, because Postgres treats NULLs as distinct.
Foreign key `(organizationId, resourceId)` -> `resource(organizationId, id)`,
cascading, so a rule can never name another business's resource.

`weeklyHours` - keys `mon` to `sun`, each an array of
`{ startMinute, endMinute }`, integers `0` to `1440`, `endMinute >
startMinute`, windows within a day not overlapping. A missing or empty day
is closed.

```json
{ "sun": [{ "startMinute": 570, "endMinute": 1020 }],
  "mon": [{ "startMinute": 1020, "endMinute": 1170 }],
  "wed": [{ "startMinute": 450, "endMinute": 510 }] }
```

`dateHours` - one-off dates. Each entry is a date and its windows, same
window rules as a weekday, at least one window. It replaces that date's
hours, and it opens that date if it is closed or a holiday. Dates unique
within a row.

```json
[{ "date": "2026-10-13", "windows": [{ "startMinute": 540, "endMinute": 780 }] }]
```

Validation also requires `timezone` accepted by `Intl.DateTimeFormat`,
`holidayCountry` matching `^[A-Z]{2}$`, and `holidayRegion` matching
`^[A-Z0-9]{1,3}$` and only with a country.

**`ResolvedBookableHoursType`** (from `resolveBookableHours`)

```ts
{
  source: "resource" | "organization"; // whose week answered
  timezone: string;
  weeklyHours: WeeklyHoursType;
  dateHours: DateHoursType; // the one-off dates that apply, inside the horizon
  minimumNoticeMinutes: number;
  horizonDays: number;
  closedDates: string[]; // closed dates and holidays inside the horizon, minus opened ones; sorted, unique
}
```

**`GET /public/:slug/booking-links`** - public, no cookie, read-only.

```json
{ "bookingLinks": [{ "id": "...", "slug": "estimate", "name": "Painting estimate",
                     "description": "...", "durationMinutes": 30,
                     "bufferBeforeMinutes": 0, "bufferAfterMinutes": 15 }] }
```

Active links only, ordered by name. An existing business with no active links
returns `{ "bookingLinks": [] }`.

**`GET /public/:slug/booking-links/:bookingLinkId`**

```json
{ "bookingLink": { "id": "...", "slug": "...", "name": "...", "description": null,
                   "durationMinutes": 30, "bufferBeforeMinutes": 0, "bufferAfterMinutes": 15 },
  "availability": { "timezone": "America/Edmonton", "weeklyHours": { }, "dateHours": [],
                    "minimumNoticeMinutes": 240, "horizonDays": 60,
                    "closedDates": ["2026-12-25"] } }
```

The availability is the business's own (`resourceId` null); choosing a
person arrives with bookings in item 5.

Errors on both: `404 { "error": { "code": "not_found", "message": "..." } }`,
identical for an unknown slug, unknown or inactive link, a link of another
business, and a business with no business row, so a stranger cannot tell
them apart. `400` with the same shape for a malformed slug or id. This
extends the existing `refuse` shape and `RefusalCodeType` rather than adding
a second error shape. Neither route ever returns `organizationId`, `source`,
or anything about members, users or people.

## Testing

Vitest went in on 2026-09-25, before 2.1, as the Sep 19 decision said
("a test runner goes in before item 2"); Frank approved the install. The
test gate applies. 2.1 adds tests for the three validation schemas, 2.2 for
every resolution rule (it carries seven), and 2.6 for the holiday dates;
each step's `Done when` includes its tests passing, and every step reruns
all of them. 2.2 also gives the backend Vitest and its `test` scripts,
with its first test. What a unit test cannot prove is still proved by hand:
real SQL against `scheduleads_dev`, real HTTP against the running API, a
real browser for CORS (curl does not enforce it), and the deliberate broken
build for the typed seam. Final gate: the tests,
`npm run build --workspace=backend`, `npm run build --workspace=frontend`,
`npm run lint --workspace=frontend`.

## Notes for the AI

- **Version 8 is the source.** The booking model was approved on
  2026-09-25 after three audits; its decisions are `project-plan.md` 20 to
  29 and the build log's "How it all fits together". Do not reopen them;
  if something here seems to contradict them, say so and stop.
- **Bookable hours are not opening hours.** They say when customers can
  book online. The owner can still place work outside them (item 12b), and
  a job never hides anyone from customers.
- **Plans over overview.** `project-overview.md` still says "the two
  tables", puts `resource` in item 4, and calls `availability_rule` one per
  organization. Build to the plans. `/overview` should be rerun.
- **The first person and the business owner.** The first person is the
  business owner. When the platform admin creates a client's business, item
  3b creates it under the client's email so the client is its business
  owner; today `creatorRole: "owner"` would make the platform admin the
  owner instead. This item does not link the person to any login (Out of
  scope), so it cannot link the wrong one.
- **`AppType` cannot live in `packages/shared`.** It is derived from the Hono
  app instance, so shared would have to import backend and invert the
  dependency. The first repo learned this; the frontend takes a type-only
  dependency on the backend workspace, the standard Hono RPC arrangement.
  `coding-standards.md` still says shared; 2.5 corrects it.
- **The first repo declared `AppType` and never consumed it.** 2.5 does not
  close on "it typechecks". It closes on a build that fails when a route is
  renamed.
- **Port, do not copy, from `scheduleads` feature 2** (`../scheduleads`,
  branch `main`): `backend/src/routes/booking-links.ts`, the contract in
  `packages/shared/src/api/booking-link-contract.ts` (its
  `backend/scripts/seed-booking-link.ts` is not ported: that command was
  dropped). What changed: slug-keyed routes,
  `startMinute`/`endMinute`, a resource dimension, one-off dates, business
  settings only on the business's row, buffers on the service, horizon and
  province holidays, `timestamptz`, this repo's `refuse` error shape and
  naming.
- **Tenant scope.** The public routes take the slug from the path because a
  stranger has no session; that is the one place an organization comes from
  the URL, and it is read-only. Look up the org by slug, then every other
  query filters on its id. Never look a link up by id alone.
- **CORS.** The dashboard rule sends credentials; the public rule never does.
  Keep them separate, as the comment in `server.ts` already warns.
- **No new packages without Frank's yes.** `hono` in `frontend` and any
  holiday source are both asks.

## Open questions

1. **Answered 2026-09-27: yes.** `hono ^4.13.8` and `"backend": "*"` added
   to `frontend/package.json`; the lockfile gained only those two lines, one
   `hono` copy is shared, and `backend` links to the workspace folder.
2. **Answered 2026-09-28: `date-holidays`, the whole package.** Added to
   `backend` only as `^3.37.0`: 43 MB on disk with twelve helper packages,
   about 3 MB of memory on top of the running API. About a million
   downloads a week, since 2016; code ISC, data CC-BY-3.0 (credit only if
   the holiday list itself is republished). See step 2.6, piece 1.
3. **Answered 2026-09-25: yes.** `/tests` ran before 2.1 and installed
   Vitest in `packages/shared`, with a first test on the subscription
   limits that was shown to fail when the old `in` bug is put back. See
   Testing.
