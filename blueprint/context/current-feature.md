# Feature: Booking links, resources and availability rules

**From build-plan:** feature 2

**Branch:** `feature/booking-links-resources-and-availability-rules`

**Status:** draft

## Goal

Give every business the three scheduling primitives the rest of the product
reads: its booking links (one per service), its resources (the people who do
the work), and its availability (when it can be booked). Serve them on a
public, read-only route a stranger's browser can call, resolve availability
through one function every later item reuses, and make the frontend call the
API through `hc<AppType>` so a broken contract stops the build instead of
failing at runtime.

## In scope

- Three tables in `packages/shared`: `resource`, `booking_link`,
  `availability_rule`, with one migration.
- `availability_rule` unique per organization **and** resource. A null
  `resourceId` is the business's own hours; a set one is that person's. The
  null-safe uniqueness is enforced by the database, not by code (see
  Data / contracts).
- A resource's rule can only point at a resource of the **same**
  organization, enforced by a composite foreign key.
- Several windows per day, minimum notice, buffer, a booking horizon,
  blackout dates, and statutory holidays resolved from a country code.
- Zod validation schemas for a weekly-hours value and a whole rule, in
  `packages/shared`, used by every writer (the seeds now, settings in item 12).
- `resolveAvailability`: the one function that picks the rule for an
  organization and optional resource (the resource's own row, else the
  organization's) and returns its effective values, including the closed
  dates within the horizon.
- Two public routes, keyed by organization slug:
  `GET /public/:slug/booking-links` and
  `GET /public/:slug/booking-links/:bookingLinkId`.
- A public CORS rule for those routes, separate from the dashboard's, that
  never allows credentials, with origins from `WIDGET_ORIGINS`.
- The seed CLI: seeds a booking link and availability rule for an existing
  organization by slug. Plus the dev seed extended so both dev businesses
  have bookable data, including one resource with its own hours.
- The typed seam: the backend exports `AppType`, the frontend builds its
  client with `hc<AppType>` from `hono/client`, `fetchMe` moves onto it (its
  hand-written types go), and the dashboard home lists the business's active
  booking links through the public list route.
- Correcting the coding standard that says `AppType` lives in
  `packages/shared`. It cannot: see Notes for the AI.

## Out of scope

- Computing bookable slots, and `GET /public/:slug/availability`. Items 5
  and 9.
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

- [ ] **2.1 The three tables and their validation schemas.**
  Add `resource`, `booking_link` and `availability_rule` to
  `packages/shared/src/db/drizzle-schema.ts` exactly as in Data / contracts,
  with a comment on the two uniqueness indexes saying why they are two (a
  future reader will otherwise "simplify" them into the broken single
  constraint). Add `weeklyHoursValidationSchema` and
  `availabilityRuleValidationSchema` under
  `packages/shared/src/zod-validation/availability/`, exported through the
  existing `index.ts`. Generate the migration from `packages/shared` and read
  the SQL before applying it.
  **Done when:** `db:generate` produces one migration whose SQL contains the
  partial unique index `WHERE "resourceId" IS NULL`, the composite unique
  index, and the composite foreign key; `db:migrate` applies it to
  `scheduleads_dev`; and by hand in `psql`, three inserts are refused: a
  second org-wide rule for one organization, a second rule for one resource,
  and a rule naming another organization's resource. Both builds pass.

- [ ] **2.2 The resolution function.**
  `backend/src/lib/resolve-availability.ts` exports `resolveAvailability(
  organizationId, resourceId | null, now)`. It reads the resource's own rule
  when `resourceId` is set and that row exists, otherwise the organization's
  row, and returns `ResolvedAvailabilityType` (Data / contracts) or `null`
  when the organization has no rule. Both queries filter on
  `organizationId` first. `closedDates` in this step is the blackout dates
  inside the horizon; 2.6 adds holidays. `now` is a parameter so the horizon
  is testable.
  **Done when:** called from a throwaway `tsx` one-liner against seeded rows,
  it returns the resource's own rule for a resource that has one, the
  organization's rule for a resource that has none, `null` for an
  organization with no rule, and `null` when given a resource id that
  belongs to another organization. Backend build passes.

- [ ] **2.3 The seeds.**
  Extend `packages/shared/scripts/seed-dev.ts` so, idempotently,
  `agency-dev` gets an org-wide rule shaped like Primo's live schedule
  (several windows a day, Sunday open) and two booking links, and
  `test-salon-dev` gets an org-wide rule, one resource with its own rule,
  and one resource without. Add `packages/shared/scripts/seed-booking-link.ts`
  and a `db:seed-booking-link` script: creates a booking link and, only if
  none exists, the org-wide rule, for an existing organization found by
  `--slug`, all in one transaction, rule validated by
  `availabilityRuleValidationSchema`. It refuses any database that is not
  local and `_dev` unless `--allow-remote` is passed, because this is also
  how a real tenant gets hours until item 12.
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
  business with no rule all return the identical `404` body; a browser
  `fetch` from an allowed origin succeeds and from a disallowed origin is
  blocked; and the response never carries `Access-Control-Allow-Credentials`.

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
  Resolve `holidayCountry` (ISO 3166-1 alpha-2) into the public holidays
  that fall inside the horizon, in the rule's timezone, and add them to
  `closedDates` in `resolveAvailability`. How the dates are produced depends
  on Open question 2. Seed `agency-dev` with `US` and `test-salon-dev` with
  `CO`.
  **Done when:** the public detail route for a `CO` business lists a
  holiday that Colombia moves to a Monday (for example Saint Joseph's day)
  on the moved date, a `US` business lists Thanksgiving on the fourth
  Thursday of November, and a business with no country lists only its
  blackout dates. Both builds pass.

## Files / areas

- `packages/shared/src/db/drizzle-schema.ts` - three tables
- `packages/shared/drizzle/` - one generated migration
- `packages/shared/src/zod-validation/availability/` - two validation schemas,
  exported from `zod-validation/index.ts`
- `packages/shared/scripts/seed-dev.ts`, new `seed-booking-link.ts`,
  `packages/shared/package.json` script
- `backend/src/app.ts` (new), `backend/src/server.ts` (reduced),
  `backend/src/routes/public-booking-links.ts`,
  `backend/src/lib/resolve-availability.ts`, `backend/package.json`,
  `backend/tsconfig.json`
- `frontend/lib/api-client.ts`, `frontend/app/page.tsx`,
  `frontend/package.json`
- `.env.example`, `blueprint/context/coding-standards.md`

## Data / contracts

Ids are text from `randomUUID()`, as in `seed-dev.ts`. Timestamps are
`timestamptz`. Every table cascades on organization delete.

**`resource`** - a crew, a practitioner, an estimator.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | |
| `organizationId` | text, not null | FK `organization.id` |
| `name` | text, not null | |
| `active` | boolean, not null, default true | |
| `createdAt`, `updatedAt` | timestamptz, not null, default now | |

Unique `(organizationId, id)`, which exists only so `availability_rule` can
reference both columns.

**`booking_link`** - an event type; the handle a host site stores as
`Service.bookingId`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | |
| `organizationId` | text, not null | FK `organization.id` |
| `name` | text, not null | |
| `slug` | text, not null | unique per organization, same rule as the org slug |
| `description` | text, nullable | |
| `durationMinutes` | integer, not null | check `> 0` |
| `active` | boolean, not null, default true | inactive reads as absent publicly |
| `createdAt`, `updatedAt` | timestamptz, not null, default now | |

**`availability_rule`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | |
| `organizationId` | text, not null | FK `organization.id` |
| `resourceId` | text, nullable | null = the business's own hours |
| `timezone` | text, not null | IANA name; every minute below is local to it |
| `weeklyHours` | jsonb, not null | shape below |
| `minimumNoticeMinutes` | integer, not null | check `>= 0` |
| `bufferMinutes` | integer, not null | check `>= 0` |
| `horizonDays` | integer, not null | check `> 0`; no default, a writer sets it |
| `holidayCountry` | text, nullable | ISO 3166-1 alpha-2; null = no holidays |
| `blackoutDates` | jsonb, not null, default `[]` | `YYYY-MM-DD`, local to `timezone` |
| `createdAt`, `updatedAt` | timestamptz, not null, default now | |

Uniqueness, both indexes required (`resource-model-proposal.md` section 4):
a partial unique index on `(organizationId) WHERE "resourceId" IS NULL` for
the org-wide row, and a unique index on `(organizationId, resourceId)` for
per-resource rows. A single `unique(organizationId, resourceId)` would allow
two org-wide rows, because Postgres treats NULLs as distinct.
Foreign key `(organizationId, resourceId)` -> `resource(organizationId, id)`,
cascading, so a rule can never name another business's resource.

`weeklyHours` - keys `mon` to `sun`, each an array of
`{ startMinute, endMinute }`, integers `0` to `1440`, `endMinute >
startMinute`, windows within a day not overlapping. A missing or empty day is
closed.

```json
{ "sun": [{ "startMinute": 570, "endMinute": 1020 }],
  "mon": [{ "startMinute": 1020, "endMinute": 1170 }],
  "wed": [{ "startMinute": 450, "endMinute": 510 }] }
```

Validation also requires `timezone` accepted by `Intl.DateTimeFormat` and
`holidayCountry` matching `^[A-Z]{2}$`.

**`ResolvedAvailabilityType`** (from `resolveAvailability`)

```ts
{
  source: "resource" | "organization"; // which row answered
  timezone: string;
  weeklyHours: WeeklyHoursType;
  minimumNoticeMinutes: number;
  bufferMinutes: number;
  horizonDays: number;
  closedDates: string[]; // blackouts and holidays within the horizon, sorted, unique
}
```

**`GET /public/:slug/booking-links`** - public, no cookie, read-only.

```json
{ "bookingLinks": [{ "id": "...", "slug": "estimate", "name": "Painting estimate",
                     "description": "...", "durationMinutes": 60 }] }
```

Active links only, ordered by name. An existing business with no active links
returns `{ "bookingLinks": [] }`.

**`GET /public/:slug/booking-links/:bookingLinkId`**

```json
{ "bookingLink": { "id": "...", "slug": "...", "name": "...", "description": null,
                   "durationMinutes": 60 },
  "availability": { "timezone": "America/Denver", "weeklyHours": { },
                    "minimumNoticeMinutes": 240, "bufferMinutes": 15,
                    "horizonDays": 60, "closedDates": ["2026-12-25"] } }
```

The availability is the organization's own (`resourceId` null); resource
choice arrives with bookings.

Errors on both: `404 { "error": { "code": "not_found", "message": "..." } }`,
identical for an unknown slug, unknown or inactive link, a link of another
business, and a business with no rule, so a stranger cannot tell them apart.
`400` with the same shape for a malformed slug or id. This extends the
existing `refuse` shape and `RefusalCodeType` rather than adding a second
error shape. Neither route ever returns `organizationId`, `source`, or
anything about members or users.

## Testing

No unit test runner is configured today, so as written no test gate applies.
But the build log records a decision from Sep 19, "a test runner goes in
before item 2", so this item's logic (the rule validation, the resolution
fallback, holidays) lands with a harness already there. That is Open
question 3. If `/tests` runs first, 2.1, 2.2 and 2.6 gain focused tests and
their `Done when` includes them. Otherwise each step is proved by its own
`Done when`: real SQL against
`scheduleads_dev`, real HTTP against the running API, a real browser for
CORS (curl does not enforce it), and the deliberate broken build for the
typed seam. Final gate: `npm run build --workspace=backend`,
`npm run build --workspace=frontend`, `npm run lint --workspace=frontend`.

## Notes for the AI

- **Plans over overview.** `project-overview.md` still says "the two tables",
  puts `resource` in item 4, and calls `availability_rule` one per
  organization. The build plan and project plan moved `resource` here and made
  the rule unique per organization and resource on 2026-09-22; the overview
  body was not regenerated. Build to the plans. `/overview` should be rerun.
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
  `startMinute`/`endMinute`, a resource dimension, horizon and holidays,
  `timestamptz`, this repo's `refuse` error shape and naming.
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
   Recommended: the `date-holidays` package. It covers the US and Colombia,
   including Colombia's Emiliani rule that moves most holidays to a Monday,
   and Easter-based dates, and it is maintained. The alternative is a
   hand-written table per country, which is small for the US and genuinely
   tricky for Colombia, and must be maintained forever. Needed by 2.6.
3. **Run `/tests` before 2.1?** The build log's Sep 19 decision says a test
   runner goes in before item 2, and it has not happened. `/tests` would add
   a runner (a new dev dependency, so your yes) and turn on the test gate.
   Recommended: yes, because the resolution fallback and the rule validation
   are pure logic that a test proves in milliseconds and a hand check proves
   once. Skipping it is workable; every step still has a real check.
