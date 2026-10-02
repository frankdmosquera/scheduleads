# Feature: Who does what

**From build-plan:** feature 5b

**Branch:** feature/05b-who-does-what

**Status:** verified. Whole feature seen and agreed by Frank 2026-10-01;
steps 5b.1 to 5b.3 built, tested and reviewed step by step; every review
finding fixed, F-57 last on 2026-10-01. The checkpoint for the final review.

Branch named in the workspace's `feature/NN-name` form, so one number finds the
branch, the archive (`05b-who-does-what.md`) and the tag (`item-05b-done`).
The second of feature 5's four parts (split 2026-10-01, Frank).

## Goal

The data the free-time check (5c) reads to know who may be offered for a
service: which people can do it (skills), which places it can be done in
(rooms), and which people are on standby on a given date (at work, hidden from
customers, still placeable by the owner). Project plan decision 26: who does
what is skills and rooms, checked at booking and ticked in settings; nobody
ticked means anyone can do it, no room ticked means no room check.

Nothing is visible yet. The owner ticks skills and rooms and sets standby on
screen in feature 12; until then the dev seed and the tests write the rows.

## In scope

- `booking_link_resource`: one row per tick, a person who can do a service or
  a place it can be done in. Migration 0010, which also gives `booking_link` a
  unique `(organizationId, id)` so the tick can only name a service of its own
  business.
- `standby_date`: one row per person per date they are on standby. Migration
  0011.
- `findServiceResources` and `findStandbyDates` in `backend/lib/scheduling/`,
  the two reads 5c calls.
- The dev seed: Riverbend Clinic (dev) gets skills, rooms and one standby
  date, shaped like Face and Body, so 5c has real cases to work on.
- F-53's one-line fix (a finding number in a comment of
  `backend/lib/scheduling/hold-time.test.ts`) rides on step 5b.1's commit.

## Out of scope

- Free times, "any available", buffers (5c). Booking (5d).
- Writing ticks or standby from a screen or a route (feature 12, 12b): these
  are tables and backend reads, as in 5a.
- A service that needs two people or two places at once (named, not planned).
- Part-day standby: the plan says standby is dated (see Decisions).
- Applying the migrations to Railway (at deploy, Frank's line).

## Build loop

`workflow.stepReview` is `every` and `workflow.checkpointCommits` is
`enabled`.

Before the first step Frank sees the whole feature once. Each step's plan
(Part 1, what it builds; Part 2, Done when) is gone through with him and gets
its own yes just before it is built. After that yes the step runs straight
through without asking: build, tests and checks, tick the box here, write the
build log entry and push buildlogs, commit (`feat: 5b.N <what>`) and push to
the feature branch, `/audit` scoped to the step, then the independent review.
The one planned stop is after the review, where its findings are talked
through. P0/P1 are fixed before the next step, or Frank accepts them with a
reason; P2/P3 are recorded and carried. A finding that only makes the agreed
plan hold is fixed without asking.

Only three things stop a step earlier: the agreed plan turns out wrong while
building, a line only Frank crosses (a package, Railway or real data, `main`,
a merge, a force push, deleting anything), or blocking review findings.

`/complete` runs its own final review over the already-reviewed steps, then
merges with a merge commit on Frank's yes.

## Build steps

- [x] **5b.1 Skills and rooms.**
  - `packages/shared/db/scheduling-tables/booking-link-resource-table.ts`;
    `booking_link` gains `unique("booking_link_organization_id_unique")` on
    `(organizationId, id)`; migration `0010_booking_link_resource`, generated.
  - The dev seed ticks Riverbend Clinic's services (below), idempotent like
    the rest of the seed.
  - F-53: the finding number leaves the comment in `hold-time.test.ts`.
  - **Done when** backend tests prove, by inserting rows directly: a person
    and a place can be ticked for a service; the same tick twice is refused
    by the primary key; a tick cannot name another business's service or
    another business's person or place (both composite foreign keys, by
    name); deleting a service takes its ticks; a ticked person or place
    cannot be deleted until unticked (F-54); deleting the business takes
    everything; `db:migrate` applies cleanly and `db:seed`
    runs twice without changing anything the second time. The backend builds.

- [x] **5b.2 Standby dates.**
  - `packages/shared/db/scheduling-tables/standby-date-table.ts`; migration
    `0011_standby_date`, generated.
  - The dev seed puts one clinic practitioner on standby on one date.
  - **Done when** backend tests prove: a person can be on standby on a date;
    the same person twice on one date is refused by name; two people on one
    date are fine; another business's person is refused by the composite
    foreign key; deleting the person or the business takes the rows;
    `db:migrate` and `db:seed` as in 5b.1. The backend builds.

- [x] **5b.3 The two reads 5c calls.**
  - `backend/lib/scheduling/find-service-resources.ts` and
    `backend/lib/scheduling/find-standby-dates.ts`, tests beside each.
  - **Done when** backend tests prove `findServiceResources`: with nobody
    ticked, every active person of the business, and no room check; with
    people ticked, only those, inactive ones left out, so all ticked people
    inactive gives nobody (never "anyone"); with places ticked, only the
    active ones, and all inactive gives none (the service cannot be placed);
    a person ticked never shows as a place or the reverse; an inactive,
    missing or other business's service answers `null`. And
    `findStandbyDates`: exactly the asked people's dates inside the range,
    both ends included, never another business's. No error carries more
    than a safe reason. The backend builds.

## Files / areas

- `packages/shared/db/scheduling-tables/` (two new tables),
  `packages/shared/db/booking-tables/booking-link-table.ts` (the unique),
  `packages/shared/db/index.ts`
- `packages/shared/migrations/0010_booking_link_resource.sql`,
  `0011_standby_date.sql`, generated from `packages/shared`
- `packages/shared/scripts/seed-dev.ts`
- `backend/lib/scheduling/`: two reads, tests beside them, and a test file
  for each table's rules, as `commitment-rules.test.ts` does

## Data / contracts

**booking_link_resource** (who does what)

- `organizationId` (text, FK organization, cascade), `bookingLinkId` (text),
  `resourceId` (text), `createdAt`.
- Primary key `(bookingLinkId, resourceId)`: a tick exists or not.
- FK `(organizationId, bookingLinkId)` to `booking_link(organizationId, id)`,
  cascade, named `booking_link_resource_booking_link_fk`; FK
  `(organizationId, resourceId)` to `resource(organizationId, id)`, **no
  action**, named `booking_link_resource_resource_fk`. A deleted service
  takes its ticks; a ticked person or place cannot be deleted until
  unticked (F-54): losing the only tick would turn "only them" into
  "anyone", the very answer an inactive tick is refused (5b.3). Deleting
  the business still clears everything.
- The resource's own `kind` says what the tick means: a person can do the
  service, a place is a room it can be done in. Any one ticked person and any
  one ticked place is enough for one booking.

**standby_date**

- `organizationId` (text, FK organization, cascade), `resourceId` (text),
  `date` (Postgres `date`, read as `YYYY-MM-DD` text, the business's own
  calendar date), `createdAt`.
- Primary key `(resourceId, date)`, named `standby_date_pkey`.
- FK `(organizationId, resourceId)` to `resource(organizationId, id)`,
  cascade, named `standby_date_resource_fk`.
- Meaning, read by 5c: on that date the person is hidden from customers. The
  owner can still place them; off is time off (a `commitment`, 5a). The plan
  says per person; the table does not refuse a place, which 5c reads the same
  way (a room hidden from customers that day).

**findServiceResources(organizationId, bookingLinkId)** answers `null` when
the service is missing, inactive or another business's; otherwise
`{ peopleIds: string[], placeIds: string[] | null }`:

- `peopleIds`: the ticked people who are active; with no person ticked, every
  active person of the business. Ordered by name, then id.
- `placeIds`: the ticked places that are active, ordered the same way; `null`
  when no place is ticked (no room check). An empty array means a room is
  needed and none can be used.

**findStandbyDates(organizationId, resourceIds, fromDate, toDate)** answers
`{ resourceId, date }[]` for those resources with `fromDate <= date <= toDate`
(`YYYY-MM-DD` strings), ordered by date then resource. An empty list of
resources answers `[]` without a query.

Failures in both throw `Reading who does what failed: <safe reason>` and
`Reading standby failed: <safe reason>`, through `safeErrorReason`.

**Dev seed, Riverbend Clinic (dev)**

- Facials (Deep Cleansing, Dermaplaning, Hydra Spa): Sofia, Ana, Mei; Room 3.
- Chemical Peel: nobody ticked (anyone); Room 3.
- Massages (the four): Luis, Ana, Priya, Daniel; Rooms 1 to 4.
- Laser Hair Removal: Mei; Room 5.
- Body Wrap: Priya; Room 4.
- Every clinic service needs a room, so the "no room check" case in dev is
  Summit Painting (dev), whose service ticks nothing.
- Standby: Sofia on the first Monday at least seven days ahead of the seed
  run, a date she would otherwise be bookable.

## Testing

Backend tests against the local `scheduleads_dev` with the existing guard,
each test making its own throwaway business, people, places and services so
it passes on its own. Database rules are proved by expecting Postgres to refuse
the bad row with the named constraint. Each new test shown able to fail once,
by breaking the rule or planting a fault. The seed's second run is checked by
counting rows before and after. No frontend change.

## Notes for the AI

- `booking_link` has no unique `(organizationId, id)` yet; the composite FK
  needs it, as `resource_organization_id_unique` does for `resource`. Check
  `db:generate` writes it before the new table's FK in 0010.
- Drizzle's `date` column with `mode: "string"` keeps `YYYY-MM-DD` and never
  shifts a date through a time zone.
- A later `db:generate` must find no changes after 0011.
- Seed: reuse its find-or-make pattern; insert ticks and standby with
  `onConflictDoNothing` so a second run changes nothing. The standby date is
  computed from the run date, like `sundayAfterDays`.
- Function names: `findServiceResources` reads the words of the table
  (`booking_link_resource`); "who does what" is the feature's name, not a
  code word.
