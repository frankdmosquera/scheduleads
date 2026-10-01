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

### F-48 [P2] fixed - Another business's person answers "taken" when busy and a key error when free

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

### F-49 [P3] fixed - Nothing indexes commitment by business and person, so its two foreign key checks scan the whole table

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

### F-50 [P3] fixed - "A person who still holds time cannot be deleted" is really "a person who ever held time"

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
