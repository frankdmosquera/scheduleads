# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-32 [P3] unverified - A pick is the package's display name, so a renamed holiday would take a business's booking page down

**File:** backend/lib/bookable-hours/closed-holidays.ts:58
**Found:** 2026-09-28 by /audit independent (scope: current; lens: quality)
**Why it matters:** `closedHolidays` stores `date-holidays`' English display
names (`"Thanksgiving"`, `"St. Patrick’s Day"` with a typographic apostrophe),
and a name the list no longer has throws, as step 2.6 piece 4 decided. The
throw propagates out of `applyBookableHoursRules` and the public detail route
answers `500` for that business until its row is corrected. The names are not a
stable identifier: the dependency is `^3.37.0`, so a lockfile refresh can pull
a minor release that renames or drops a holiday, and a province can abolish
one, after which every business that picked it loses its public booking page,
not just that one closure. The saved tests pin the nine Alberta names and
National Day for Truth and Reconciliation, so a rename of those would fail the
tests on upgrade; any other name a feature 12 picker offers would not. Not
observed: no rename exists in 3.37.0, and the probe found no name that differs
in date between Alberta's list and the national one in 2026 to 2030, for any
province.
**Suggested fix:** Decide in feature 12, when the picker writes names: either
validate picks against the list at write time and keep a test over every name
the picker can offer, or store a stable key (the package's `rule` string) with
the display name. Worth a note on feature 12 now so it is not rediscovered.
**Resolution:** Carried to feature 12 on Frank's call, 2026-09-28, noted on
item 12 in `build-plan.md`. Stays unverified until then.

### F-47 [P3] open - The spec says accepting an invitation is refused, but Better Auth checks no role for it

**File:** blueprint/context/current-feature.md:328
**Found:** 2026-09-30 by /audit independent (scope: step 3b.2; lens: security)
**Why it matters:** Data / contracts says `invite-member` "(and accepting
one): refused, no role holds an invitation permission". Better Auth 1.7.5's
`/organization/accept-invitation` checks only that the invitation is pending,
unexpired and addressed to the signed-in user (`crud-invites.mjs:264-268`), never
the inviter's or anyone's role. Closing `invitation` stops new invitations, so
accepting is closed in practice only once no pending one exists. An invitation
made before this change stays acceptable until it expires (48 hours by
default), and its acceptance puts a client in a second business. Real clients
cannot reach the product yet, so the live risk is close to nil.
**Suggested fix:** Reword the contract line (accepting is closed because no
invitation can be made any more), and before the first client-facing deploy
confirm the production `invitation` table holds no pending row.
**Resolution:**
Carried on Frank's call, 2026-09-30: checked on the live database before the first client-facing deploy (the `invitation` table must be empty, or its rows cancelled). Nothing in code to change.

### F-48 [P2] closed - Another business's person answers "taken" when busy and a key error when free

**File:** packages/shared/migrations/0009_commitment.sql:22
**Found:** 2026-10-01 by /audit (scope: step 5a.1, 790512c..1def0b9; lens: security)
**Why it matters:** The exclusion constraint is checked as the row enters its
index, before the composite foreign key (an end-of-statement trigger) runs.
Probed in a rolled-back transaction on `scheduleads_dev`: a row from business A
naming business B's person over B's booked time fails with `23P01
commitment_no_overlap`; the same row over B's free time fails with `23503
commitment_resource_fk`. The 5a.1 test only covers the free case, so it passes.
5a.2's `holdTime` contract maps `23P01` to `{ held: false }` and anything else
to an error, so holding another business's person would tell the caller when
that person is busy, and Postgres's `23P01` detail even carries B's existing
range. Not reachable today (no caller, and resource ids are random), but it is
exactly the shape 5a.2 will be built on, and the spec's "the rule needs no
business column" (current-feature.md:132) is what lets it through.
**Suggested fix:** Either add `"organizationId" WITH =` as the first element of
`commitment_no_overlap` in 0009 (applied only locally so far, so editing it is
allowed; ids stay unique, so the rule is no weaker, and the cross-business row
then always fails on the foreign key), or make 5a.2's `holdTime` confirm every
resource id belongs to the business before inserting. Either way add a test:
holding another business's busy person answers the same as a free one, never
"taken". Correct the spec line at 132.
**Resolution:** Fixed 2026-10-01 in 5a.1's review-fix commit: `commitment_no_overlap` now compares `"organizationId"` first, edited into 0009 (local only). A new test holds another business's busy person and expects `23503 commitment_resource_fk`; it failed with `23P01` against the old rule and passes now. Spec corrected.
Closed 2026-10-01 by the independent review of 1def0b9..d5175ae: the live `scheduleads_dev` constraint reads `EXCLUDE USING gist ("organizationId" WITH =, "resourceId" WITH =, tstzrange(...) WITH &&) WHERE status = 'active'`, the ledger row's hash matches the edited 0009, and both the 5a.1 rule test and 5a.2's `holdTime` test (another business's person, busy and free, both `23503`, nothing held) pass. Ids stay globally unique, so the rule is no weaker. No new defect from the repair.

### F-49 [P3] closed - Nothing indexes commitment by business and person, so its two foreign key checks scan the whole table

**File:** packages/shared/db/scheduling-tables/commitment-table.ts:34
**Found:** 2026-10-01 by /audit (scope: step 5a.1, 790512c..1def0b9; lens: performance)
**Why it matters:** Every other table here that points at a parent through
`(organizationId, x)` has an index leading with those columns
(`availability_rule_resource_unique`, `activity_timeline_index`). `commitment`
has only its primary key and the exclusion constraint's GiST index, which is
partial (`where status = 'active'`), so it cannot serve the foreign key checks.
`EXPLAIN` with sequential scans disabled still picks a sequential scan for both
`"organizationId" = $1 and "resourceId" = $2` (the check run on every person
deleted) and `"organizationId" = $1` (the cascade when a business is deleted).
This is the table that grows with every booking, forever. Rare operations, so
small today.
**Suggested fix:** `index("commitment_resource_index").on(table.organizationId,
table.resourceId)` in the table and the migration, in 5a.1's migration while it
is local only, or with 5a.2.
**Resolution:** Fixed 2026-10-01: `commitment_resource_index` on `(organizationId, resourceId)` in the table and 0009. Not proved by a test (an index changes speed, not answers).
Closed 2026-10-01 by the independent review of 1def0b9..d5175ae: the index exists on `scheduleads_dev`, `db:generate` reports no change, and `EXPLAIN` with sequential scans off now gives an index-only scan on `commitment_resource_index` for both the person check and the business cascade. No new defect.

### F-50 [P3] closed - "A person who still holds time cannot be deleted" is really "a person who ever held time"

**File:** packages/shared/db/scheduling-tables/commitment-table.ts:34
**Found:** 2026-10-01 by /audit (scope: step 5a.1, 790512c..1def0b9; lens: quality)
**Why it matters:** The table comment and the spec (current-feature.md:117) say
a person or place that still holds time cannot be deleted. The foreign key
ignores `status` and time, so a cancelled row, or a booking finished years ago
(status stays `active`, there is no "done"), blocks the delete just the same.
Feature 12 decides what deleting a person does, and will read this wording and
expect a person with only past or cancelled bookings to be deletable.
**Suggested fix:** Reword both to "any commitment row, cancelled or past
included, keeps the person or place from being deleted", and add one line on
feature 12 in `build-plan.md` so the choice (deactivate instead, or remove the
rows first) is made there knowingly.
**Resolution:** Fixed 2026-10-01: the table comment and the spec say any row, cancelled or past included, blocks the delete; the delete test now also covers a person with only a cancelled row; feature 12 in build-plan.md carries the decision.
Closed 2026-10-01 by the independent review of 1def0b9..d5175ae: the table comment (commitment-table.ts:35-36), the spec's Data / contracts and build-plan.md item 12 all say any row, cancelled or past included; the delete test loops over a person with an active row and one with only a cancelled row and expects `23503` for both. No stale "still holds time" wording remains. No new defect.

### F-51 [P1] fixed - Two holds at the same instant can deadlock, and the loser gets an error instead of "taken"

**File:** backend/lib/scheduling/hold-time.ts:51
**Found:** 2026-10-01 by /audit independent (scope: step 5a.2, 1def0b9..d5175ae; lens: quality, tests)
**Why it matters:** An exclusion constraint does not serialize concurrent
inserts the way a unique index does. Each statement puts its row into the GiST
index first and then looks for conflicts; when two statements do that at the
same moment, each sees the other's uncommitted row, each waits for the other,
and Postgres's deadlock detector kills one with `40P01` after
`deadlock_timeout` (1 second). `holdTime` maps only `23P01` to `{ held: false }`,
so the killed one throws `Holding time failed: database error 40P01`. Probed on
`scheduleads_dev` with `holdTime`'s exact statement shape (one multi-row INSERT,
seeded clinic-dev resources, every transaction rolled back, nothing left): 400
simultaneous pairs on the same one resource gave 51 deadlocks; 400 pairs on the
same two resources in opposite order gave 121. That breaks step 5a.2's Done
when ("two holds for the same time at the same instant give one held and one
taken"), the claim at hold-time.ts:2-3, and the spec's "Concurrent inserts are
serialized by Postgres itself: the second waits, then fails"
(current-feature.md:136). The saved race test passed 25 of 25 reruns because
its two calls rarely reach the database in the same microseconds, so it cannot
see this. No double booking results; a customer who lost the race sees a
failure instead of "that time was just taken". Sorting the resource ids does
not help: the single-resource case deadlocks too.
**Suggested fix:** In `holdTime`'s catch, retry the same insert on `40P01`
(two or three attempts are plenty): by then the survivor has committed, so the
retry gets a clean `23P01` and answers taken, or succeeds if the survivor was
rolled back. Add a test that runs many simultaneous pairs (for example 100)
and expects every result to be held or taken, never thrown, and show it failing
without the retry. Correct hold-time.ts:2-3 and current-feature.md:136.
**Resolution:** Fixed 2026-10-01: holdTime tries a `40P01` again, up to three attempts in all; the header comment and the spec now say so. A new test runs ten simultaneous pairs on one person and one room in opposite order and expects every pair to answer one held, never an error. With the retry removed it failed five runs in five with `40P01`; with it, it passes (seven to nine seconds, as each deadlock costs Postgres one second to detect). Reproduced first with the real holdTime: 150 pairs failed three runs in three.

### F-52 [P3] open - holdTime and releaseTime cannot join a caller's transaction, which 5d and feature 7 need

**File:** backend/lib/scheduling/hold-time.ts:33
**Found:** 2026-10-01 by /audit independent (scope: step 5a.2, 1def0b9..d5175ae; lens: quality)
**Why it matters:** The declared deviation holds for this step: one
`INSERT ... VALUES` is atomic in Postgres, and its foreign key checks run
inside the same statement, so a refused row takes the whole hold with it (the
cross-business test proves `mine.ana` gets no row). But both functions always
use the global `db`. 5d writes the booking, its commitments and the timeline
entry together, and feature 7's reschedule must release the old time and hold
the new one together; neither can be all-or-nothing through these functions as
written. Inside a transaction, a `23P01` also aborts the whole transaction, so
answering `{ held: false }` there needs a savepoint.
**Suggested fix:** Nothing to change in 5a. Decide in 5d's spec: let both take
an optional executor (`db` or a transaction) and hold inside a nested
transaction (savepoint) so "taken" leaves the caller's transaction usable.
**Resolution:**
