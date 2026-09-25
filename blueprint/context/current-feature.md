# Feature: Booking links, resources and availability rules

**From build-plan:** feature 2

**Branch:** `feature/booking-links-resources-and-availability-rules`

**Status:** approved step by step (decided 2026-09-25; see `AGENTS.md`,
"A spec is approved one step at a time"). The whole-feature picture is
agreed; each step's plan gets Frank's yes just before it is built. 2.1
approved.
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
  notice, how far ahead customers can book, closed dates, and the country
  and province for statutory holidays. The database refuses them on a
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
- `resolveAvailability`: the one function that works out, for a business and
  optionally one person, the week, the one-off dates, the closed dates
  within the horizon, and the business's settings.
- Two public routes, keyed by organization slug:
  `GET /public/:slug/booking-links` and
  `GET /public/:slug/booking-links/:bookingLinkId`.
- A public CORS rule for those routes, separate from the dashboard's, that
  never allows credentials, with origins from `WIDGET_ORIGINS`.
- The seed CLI: seeds a booking link and the business's row for an existing
  organization by slug. Plus the dev seed extended so both dev businesses
  have bookable data, including a person with their own week, a person with
  only a one-off date, and a place.
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
- Switching single holidays off, and the one-click close and open screens.
  Item 12. Here every holiday of the province is on, and closed dates and
  one-off dates are written by the seeds.
- Any write route or settings screen for links, resources or hours. Item 12.
  Until then the seed CLI is the only writer.
- Calendar connection and free/busy. Item 3.
- Bookings, contacts, leads. Items 4 and 5.
- Per-resource screens. Nothing builds one until a tenant has two people.
- React Query. It arrives with the first screen that needs caching; this
  item's one list reads once on page load.
- Rate limiting the public routes. Recorded as a risk, not built.

## Build loop

`workflow.stepReview` is `every` and `workflow.checkpointCommits` is
`enabled`. `/implement` asks once, before 2.1, to commit and push each step;
after that each step is committed and pushed, then gets `/audit` scoped to
the step and the independent review, and P0/P1 findings are fixed or accepted
before the next step starts. Each step's commit message starts with its
number (`feat: 2.1 ...`). The build log is republished at every step.
`/complete` makes the final commit and asks before merging.

## Build steps

- [x] **2.1 The three tables, the first person, and their validation.**
  Add `resource`, `booking_link` and `availability_rule` to
  `packages/shared/src/db/drizzle-schema.ts` exactly as in Data / contracts,
  with a comment beside the two uniqueness indexes saying why they are two
  (a future reader will otherwise "simplify" them into the broken single
  constraint), and one beside the check that keeps business settings off a
  person's row. Add `weeklyHoursValidationSchema`,
  `dateHoursValidationSchema` and `availabilityRuleValidationSchema` under
  `packages/shared/src/zod-validation/availability/`, exported through the
  existing `index.ts`. Generate the migration from `packages/shared`, add by
  hand the one statement that gives every existing organization its first
  person (kind `person`, named after the organization), and read the SQL
  before applying it. Then add `organizationHooks.afterCreateOrganization`
  to the organization plugin in `backend/src/lib/auth-server.ts`, creating
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

- [ ] **2.2 The resolution function.**
  `backend/src/lib/resolve-availability.ts` exports `resolveAvailability(
  organizationId, resourceId | null, now)`. It reads the business's row and,
  when `resourceId` is set and that person has a row, the person's row. Both
  queries filter on `organizationId` first. It returns
  `ResolvedAvailabilityType` (Data / contracts), or `null` when the
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
  `now` is a parameter so the horizon is testable.
  **Done when:** called from a throwaway `tsx` one-liner against seeded
  rows, it returns: a person's own week for a person who has one; the
  business's week for a person with no row; the business's week plus their
  date for a person with only a one-off date; a business closed date as
  closed for a person with their own week; a closed date opened by one
  person's one-off date as open for that person and still closed for
  another; `null` for an organization with no business row; and `null`
  when given a resource id that belongs to another organization. Backend
  build passes.

- [ ] **2.3 The seeds.**
  Extend `packages/shared/scripts/seed-dev.ts` so, idempotently,
  `agency-dev` gets a business row shaped like Primo's live schedule
  (several windows a day, Sunday open) and two booking links with buffers,
  and `test-salon-dev` gets a business row, a person with their own week, a
  person with no week and one one-off date, and a place (a room). The first
  person every business already has from 2.1 is used, never duplicated. Add
  `packages/shared/scripts/seed-booking-link.ts` and a
  `db:seed-booking-link` script: creates a booking link and, only if none
  exists, the business row, for an existing organization found by `--slug`,
  all in one transaction, validated by `availabilityRuleValidationSchema`.
  It refuses any database that is not local and `_dev` unless
  `--allow-remote` is passed, because this is also how a real tenant gets
  hours until item 12.
  **Done when:** `db:seed` run twice leaves the same row counts; the CLI adds
  a link to `agency-dev` and prints its id; the CLI refuses an unknown slug
  by listing real ones; and pointed at a non-`_dev` URL without
  `--allow-remote` it refuses before connecting.

- [ ] **2.4 The public routes.**
  Split `backend/src/server.ts` into `app.ts` (routes, exports `app` and
  `AppType`) and `server.ts` (only `serve`), so importing the type never
  starts a server. Add `backend/src/routes/public-booking-links.ts` with the
  two routes in Data / contracts, mounted under `/public` with a public CORS
  rule: origins from `WIDGET_ORIGINS` plus the dashboard origin,
  `credentials: false`, `GET` only. Add `WIDGET_ORIGINS` to `.env.example`.
  The org is found by slug, and the link only by
  `(organizationId, bookingLinkId)`, never by id alone.
  **Done when:** with the API running, `curl` shows the documented shape for
  both routes with no `organizationId` anywhere; an unknown slug, an unknown
  link, an inactive link, another business's link under this slug, and a
  business with no business row all return the identical `404` body; a
  browser `fetch` from an allowed origin succeeds and from a disallowed
  origin is blocked; and the response never carries
  `Access-Control-Allow-Credentials`.

- [ ] **2.5 The typed seam, proved.**
  Declarations for `AppType` are emitted by the backend build and exposed as
  a type-only entry of the `api` workspace; the frontend depends on the
  workspace (`"api": "*"`) and on `hono`, for `hono/client` (needs a yes,
  Open question 1). `frontend/lib/api-client.ts` builds one
  `hc<AppType>(API_URL)`; `fetchMe` moves onto it and `MeType` becomes a
  type inferred from the route; the dashboard home lists the business's
  active booking links from `GET /public/:slug/booking-links`, with its
  loading, empty and unreachable states. Correct the `AppType` line in
  `coding-standards.md`.
  **Done when:** signed in as `admin@example.com`, the home lists
  `agency-dev`'s two links; then the list route is renamed on purpose and
  `npm run build --workspace=frontend` **fails with a type error** in
  `api-client.ts`, and passes again once restored. Paste both outputs into
  the step's log. Lint passes.

- [ ] **2.6 Statutory holidays.**
  Resolve `holidayCountry` (ISO 3166-1 alpha-2) and `holidayRegion` (the
  province, from ISO 3166-2) into the public holidays that fall inside the
  horizon, in the business's time zone, and add them to the closed dates in
  `resolveAvailability`, where a one-off date opens them like any closed
  date. Canada's holidays differ by province, which is why the province is
  stored. How the dates are produced depends on Open question 2. Seed both
  dev businesses with `CA` / `AB`, like every real tenant.
  **Done when:** the public detail route for an Alberta business lists
  Family Day on the third Monday of February and Canada Day on July 1; the
  function called for a `CA` / `QC` business leaves Family Day out; a
  one-off date on Canada Day removes it from that person's closed dates; and
  a business with no country lists only its own closed dates. Both builds
  pass.

## Files / areas

- `packages/shared/src/db/drizzle-schema.ts` - three tables
- `packages/shared/drizzle/` - one generated migration, plus the backfill
- `packages/shared/src/zod-validation/availability/` - three validation
  schemas, exported from `zod-validation/index.ts`
- `packages/shared/scripts/seed-dev.ts`, new `seed-booking-link.ts`,
  `packages/shared/package.json` script
- `backend/src/lib/auth-server.ts` (the first-person hook),
  `backend/src/app.ts` (new), `backend/src/server.ts` (reduced),
  `backend/src/routes/public-booking-links.ts`,
  `backend/src/lib/resolve-availability.ts`, `backend/package.json`,
  `backend/tsconfig.json`
- `frontend/lib/api-client.ts`, `frontend/app/page.tsx`,
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
| `horizonDays` | integer | business's row only; check `> 0`; no default, a writer sets it |
| `closedDates` | jsonb | business's row only; `YYYY-MM-DD` list |
| `holidayCountry` | text, nullable | business's row only; ISO 3166-1 alpha-2; null = no holidays |
| `holidayRegion` | text, nullable | business's row only; the province, e.g. `AB`; needs a country |
| `createdAt`, `updatedAt` | timestamptz, not null, default now | |

One check keeps the two kinds of row honest: when `resourceId` is null,
`weeklyHours`, `timezone`, `minimumNoticeMinutes`, `horizonDays` and
`closedDates` are all set; when it is set, `timezone`,
`minimumNoticeMinutes`, `horizonDays`, `closedDates`, `holidayCountry` and
`holidayRegion` are all null. A person's row therefore holds only their own
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

**`ResolvedAvailabilityType`** (from `resolveAvailability`)

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
  `packages/shared/src/api/booking-link-contract.ts`, and
  `backend/scripts/seed-booking-link.ts`. What changed: slug-keyed routes,
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
- **Holidays depend on Open question 2.** Build 2.1 to 2.5 first; 2.6 waits
  for the answer.
- **No new packages without Frank's yes.** `hono` in `frontend` and any
  holiday source are both asks.

## Open questions

1. **Add `hono` to the frontend's dependencies?** `hono/client` ships inside
   the `hono` package, which the backend already uses; the frontend imports
   from it, so it must be declared there, at the same version. No new
   library enters the repo. Needed by 2.5.
2. **Where do statutory holidays come from?**
   Recommended: the `date-holidays` package. It covers Canada by province,
   including Family Day in Alberta, and Easter-based dates, and it is
   maintained. The alternative is a hand-written table per province,
   maintained forever. Needed by 2.6.
3. **Answered 2026-09-25: yes.** `/tests` ran before 2.1 and installed
   Vitest in `packages/shared`, with a first test on the subscription
   limits that was shown to fail when the old `in` bug is put back. See
   Testing.
