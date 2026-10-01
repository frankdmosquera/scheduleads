# Feature: People's time

**From build-plan:** feature 5a

**Branch:** feature/05a-peoples-time

**Status:** verified. Whole feature seen and agreed by Frank 2026-10-01;
steps 5a.1 and 5a.2 built, tested and reviewed step by step; every blocking
review finding fixed, F-51 last on 2026-10-01; F-52 (P3) carried to 5d.
The checkpoint for the final review.

Branch named in the workspace's `feature/NN-name` form, so one number finds the
branch, the archive (`05a-peoples-time.md`) and the tag (`item-05a-done`).
The first of feature 5's four parts (split 2026-10-01, Frank).

## Goal

One table that says when each person and each place is taken, and a database
that refuses to let two things take the same one at the same time. Every
booking (5d) writes a row per person, and per place when the service needs
one, with its buffers inside its time; every stretch of time off writes a row
too. The database refuses two overlapping active rows for the same person or
place, so two customers can never both take 3pm and no code path can forget
the check. A cancelled row stops blocking. No double booking, the owner
included (project plan decisions 21 and 27).

With it, the three backend functions every later part uses: hold time (all of
a booking's people and places at once, or none), release it, and read who is
taken over a stretch of time, which 5c's free times subtract.

Nothing is visible yet. Time off is entered on screen in feature 12b.

## In scope

- The `commitment` table and its migration, with the no-overlap rule as a
  database exclusion constraint, which needs Postgres's standard `btree_gist`
  add-on switched on in the same migration.
- `holdTime`, `releaseTime` and `findCommitments` in `backend/lib/scheduling/`.
- Tests for every rule and function against the local database, including two
  holds for the same time at the same instant.

## Out of scope

- `lead` and `booking` (5d). `commitment.bookingId` is a plain column here;
  5d adds its link to `booking` and the rule that a booking's row names one.
- Who does what, standby (5b). Free times (5c). Writing to Google (5d).
- A screen for time off (12b) and any web route: these are backend functions,
  as in feature 4.
- Recurring time off, travel time between jobs (named, not planned).
- Applying the migration to Railway (at deploy, Frank's line).

## Build loop

`workflow.stepReview` is `every` and `workflow.checkpointCommits` is
`enabled`.

Each step's plan (Part 1, what it builds; Part 2, Done when) is gone through
with Frank and gets its own yes just before it is built. After that yes the
step runs straight through without asking: build, tests and checks, tick the
box here, write the build log entry and push buildlogs, commit
(`feat: 5a.N <what>`) and push to the feature branch, `/audit` scoped to the
step, then the independent review. The one planned stop is after the review,
where its findings are talked through. P0/P1 are fixed before the next step,
or Frank accepts them with a reason; P2/P3 are recorded and carried.

Only three things stop a step earlier: the agreed plan turns out wrong while
building, a line only Frank crosses (a package, Railway or real data, `main`,
a merge, a force push, deleting anything), or blocking review findings.

`/complete` runs its own final review over the already-reviewed steps, then
merges with a merge commit on Frank's yes.

## Build steps

- [x] **5a.1 The commitments table and its rule.**
  - **Blocker for this step's plan, Frank's yes:** switching on `btree_gist`
    (see Open questions).
  - `packages/shared/db/scheduling-tables/commitment-table.ts` and migration
    `0009_commitment`, generated, then hand-written at its end: `create
    extension if not exists btree_gist` (placed first) and the exclusion
    constraint, which Drizzle cannot express.
  - **Done when** backend tests prove, by inserting rows directly: two
    overlapping active rows for one person are refused by the exclusion
    constraint by name; two people can be taken at the same time; back to
    back (one ends at 3pm, the next starts at 3pm) is allowed; a cancelled
    row no longer blocks; a row whose end is not after its start is refused;
    a row cannot name another business's person; deleting a person who still
    holds time is refused, while deleting the whole business takes its rows;
    and `db:migrate` applies cleanly to the local database. The backend
    builds.

- [x] **5a.2 Hold, release and read time.**
  - `backend/lib/scheduling/hold-time.ts`: all the people and places of one
    booking or one stretch of time off, in one transaction: all held, or none
    and the answer says the time is taken.
  - `backend/lib/scheduling/release-time.ts`: marks rows cancelled, inside
    the business only.
  - `backend/lib/scheduling/find-commitments.ts`: the active rows for some
    people and places that touch a stretch of time, for 5c.
  - **Done when** backend tests prove: a booking's person and place are held
    together; if either is taken, neither is held and the answer is "taken";
    two holds for the same time at the same instant give one held and one
    taken; a released hold frees the time; release and find never reach
    another business's rows; find returns exactly the active rows touching
    the stretch (not ones that only meet its edge, not cancelled ones); and
    no error carries more than a safe reason. The backend builds.

## Files / areas

- `packages/shared/db/scheduling-tables/` (new), `packages/shared/db/index.ts`
- `packages/shared/migrations/0009_commitment.sql`, generated from
  `packages/shared` and finished by hand
- `backend/lib/scheduling/` (new): one function per file, tests beside them

## Data / contracts

**commitment**

- `id` (text), `organizationId` (FK organization, cascade).
- `resourceId` (text, not null): FK `(organizationId, resourceId)` to
  `resource(organizationId, id)`, **no action** on delete: a person or place
  with any row here, cancelled or past included, cannot be deleted (feature
  12 decides what deleting one does), while deleting a whole business
  removes its rows through `organizationId`. Indexed as
  `commitment_resource_index` for those checks (F-49).
- `kind` (text, not null, check `booking` | `time_off`).
- `bookingId` (text, nullable): which booking holds it. Its link to `booking`
  and the rule "a booking row names its booking" arrive with 5d.
- `startsAt`, `endsAt` (`timestamptz`, not null), check `endsAt > startsAt`.
  Half-open, `[startsAt, endsAt)`: one ending at 3pm and another starting at
  3pm do not overlap. A booking's buffers are inside its time (the caller
  passes the widened range; 5c and 5d own the buffer arithmetic).
- `status` (text, not null, default `active`, check `active` | `cancelled`).
- `createdAt`, `updatedAt`.
- **The rule:** `exclude using gist ("organizationId" with =, "resourceId"
  with =, tstzrange("startsAt", "endsAt", '[)') with &&) where (status =
  'active')`, named `commitment_no_overlap`. The business is compared too
  (F-48): without it, a row naming another business's busy person was
  refused as busy, which tells the caller that person's schedule; with it,
  that row never meets their time and is refused by `commitment_resource_fk`
  as not theirs, busy or free. Two inserts that clash at the same instant
  can deadlock inside Postgres, which cancels one (`40P01`, F-51); nothing
  of it was saved, and holdTime tries it again.

**holdTime(organizationId, { resourceIds, startsAt, endsAt, kind, bookingId? })**

- One row per resource, one transaction. Answers `{ held: true, ids }` or
  `{ held: false }` when the exclusion rule refused any of them (Postgres code
  `23P01`). A deadlock (`40P01`) is tried again, up to three attempts in all;
  by then the other hold is saved, so the answer is "taken". Anything else is
  rethrown as `Holding time failed: <safe reason>`.
- `resourceIds` non-empty, without duplicates; times as `Date`s.

**releaseTime(organizationId, ids)** sets `status = 'cancelled'` on those rows
of that business; answers how many it changed.

**findCommitments(organizationId, resourceIds, from, to)** answers the active
rows of those resources whose time overlaps `[from, to)`, ordered by start:
`{ id, resourceId, kind, bookingId, startsAt, endsAt }`.

## Testing

Backend tests against the local `scheduleads_dev` with the existing guard,
each making its own throwaway business, people and places so every test passes
on its own (the lesson of F-53 and F-54). Database rules are proved by
expecting Postgres to refuse the bad row with the named constraint. Each new
test shown able to fail once. No frontend change.

## Notes for the AI

- Drizzle has no exclusion constraints: declare the table and its checks in
  the schema, and add the extension and the exclusion constraint by hand at
  the end of the generated SQL, as 0004 and 0006 added their backfills. A
  later `db:generate` must not try to drop it; check that it produces no
  change after 0009.
- `btree_gist` ships with Postgres as a standard contrib module; it still has
  to be created in each database. Check `pg_available_extensions` on the local
  database in 5a.1 and say so if it is missing.
- The time zone never matters here: everything is `timestamptz` instants.

## Open questions

- **Switching on `btree_gist`** (5a.1's blocker). The plan's rule, that the
  database itself refuses overlaps so no code path can forget, needs an
  exclusion constraint over a person's id and a time range together, and
  Postgres needs this standard add-on for that. Recommended: switch it on, in
  the migration; on Railway it is switched on when the migration runs at
  deploy. The alternative, a check in our own code under a lock, is exactly
  what the plan rules out.
