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

### F-53 [P3] closed - The deadlock test's comment carries a finding number, which the standards keep out of code

**File:** backend/lib/scheduling/hold-time.test.ts:111
**Found:** 2026-10-01 by /audit independent (scope: current, c01dd9c..da22890; lens: quality)
**Why it matters:** The comment above the stress test reads "can deadlock
inside Postgres (F-51)". `coding-standards.md` (Comments, the balance) says no
history in code comments, naming "finding numbers" explicitly: that lives in
the build log. It is the only finding number in backend or shared code apart
from the older migration 0000, and test files are the pattern later steps copy
(4/F-53 and 4/F-54 were exactly that). Once `/complete` archives this ledger,
a bare `F-51` in code points at nothing.
**Suggested fix:** Drop "(F-51)" from the comment; the sentence already says
why the test exists.
**Resolution:** Fixed 2026-10-01 in step 5b.1: the comment above the deadlock test no longer names a finding.
Closed 2026-10-01 by the step 5b.1 review (059cf0f..27d3d52): line 111 now reads "can deadlock
inside Postgres; one is killed", no finding number is left, and the one-line change introduced
nothing new in the file.

### F-54 [P2] closed - Deleting the last ticked person or room quietly opens a service to anyone, or drops its room check

**File:** packages/shared/db/scheduling-tables/booking-link-resource-table.ts:30
**Found:** 2026-10-01 by /audit (scope: step 5b.1, 059cf0f..27d3d52; lens: quality)
**Why it matters:** Both foreign keys cascade, as the spec says ("ticks are
settings, not history"), and the rules test proves deleting a person takes
their ticks. But the rule 5b.3 reads is "nobody ticked means anyone, no place
ticked means no room check". So when Laser Hair Removal ticks only Mei and
Room 5, deleting Mei (a person with no bookings yet, which `commitment` does
not block) leaves no person ticked and any practitioner is offered; deleting
Room 5 leaves no place ticked and laser is booked with no room at all. 5b.3
deliberately says all ticked people inactive gives nobody, "never anyone";
deleting reaches exactly the "anyone" answer it rules out for deactivating.
Nothing deletes a person or a service outside tests today, so it becomes
reachable with feature 12's settings screen.
**Suggested fix:** Decide before 5b.3 builds on it, with Frank. Smallest
options: make `booking_link_resource_resource_fk` `no action`, so a ticked
person or room cannot be deleted and is deactivated instead, as `commitment`
already forces (0010 is applied nowhere real, so it can be regenerated); or
keep cascade and write into feature 12 that removing someone refuses, or
warns, when it would leave a service with no person or no room ticked.
**Resolution:** Fixed 2026-10-01 in 5b.1's review-fix commit, without asking, since it only
makes the agreed rule hold (ticked but gone means nobody, never anyone):
`booking_link_resource_resource_fk` is now `no action`, edited into 0010 (local only) and
rebuilt. A ticked person or place cannot be deleted until unticked; a deleted service still
takes its ticks; deleting the business still clears everything. The test "a ticked person or
room cannot be deleted until unticked" failed against the cascade and passes now. Spec
corrected. Feature 12 decides how Settings removes a ticked person (untick first, or
deactivate).
Closed 2026-10-01 by the step 5b.2 review (27d3d52..0c90b64): the table, 0010 and the 0010
snapshot all say `no action`, and the local database holds it (`confdeltype` `a`). A
rolled-back probe confirmed a ticked person is refused by `booking_link_resource_resource_fk`
(their standby rows stay), and deleting the business in one statement still clears resource,
ticks and standby rows. All migrations 0000 to 0011 apply cleanly to a fresh schema (rolled
back). `db:generate` reports no changes. Nothing new introduced. (This resolution and F-55's
had been written into F-32's Resolution by mistake; moved here, F-32 restored.)

### F-55 [P3] closed - The new table's header comment names step 5b.3, which the standards keep out of code

**File:** packages/shared/db/scheduling-tables/booking-link-resource-table.ts:3
**Found:** 2026-10-01 by /audit (scope: step 5b.1, 059cf0f..27d3d52; lens: quality)
**Why it matters:** The header ends "(decided where it is read, 5b.3)".
`coding-standards.md` (Comments, the balance) keeps step numbers out of code
comments, the same rule F-53 was fixed for in this very commit. Once the
feature is archived, "5b.3" points at nothing; the function name would not.
**Suggested fix:** Say "(decided where it is read, findServiceResources)", or
drop the parenthesis.
**Resolution:** Fixed 2026-10-01: the header names `findServiceResources` instead of a step.
The same commit also clears the older "step 3.3" comment the reviewer saw in
`backend/lib/calendar/save-calendar-connection.ts`.
Closed 2026-10-01 by the step 5b.2 review (27d3d52..0c90b64): line 3 now ends
"(findServiceResources reads it)", and save-calendar-connection.ts:38 names `getBusyTimes`,
which does set `lastCheckedAt` (get-busy-times.ts:93). No step or finding number is left in
any comment the range adds, and nothing new was introduced.

### F-56 [P3] unverified - A database that applied the first 0010 fails on db:migrate after the regenerated one

**File:** packages/shared/migrations/meta/_journal.json:78
**Found:** 2026-10-01 by /audit (scope: step 5b.2, 27d3d52..0c90b64; lens: quality)
**Why it matters:** 0010 was regenerated in place, so its journal `when` moved from
1790903639726 to 1790904391831. The migrator runs every migration whose `when` is later than
the newest `created_at` in the ledger (drizzle-orm 0.45.2 `pg-core/dialect.js:62`). A database
that applied 27d3d52's 0010 (pushed to the feature branch) therefore re-runs 0010 on the next
`db:migrate`, fails at the unique that already exists, and never reaches 0011. This laptop's
`scheduleads_dev` was repaired by hand (its ledger holds the new 0010 and 0011 hashes), and
Railway never had 0010. Not observed elsewhere; it bites only if another machine migrated
between the two commits.
**Suggested fix:** Nothing in code. On any other machine that migrated in that window, rebuild
the dev database (or drop `booking_link_resource`, `booking_link_organization_id_unique` and
the 0010 ledger row), then `db:migrate` and `db:seed`.
**Resolution:**

### F-57 [P2] fixed - No standby test puts a date before the range, so a dropped lower bound passes every test

**File:** backend/lib/scheduling/find-standby-dates.test.ts:55
**Found:** 2026-10-01 by /audit (scope: step 5b.3, 3db43e2..a96ee29; lens: tests)
**Why it matters:** The Done when asks the tests to prove "exactly the asked people's dates
inside the range, both ends included". The fixture's earliest date is 2026-10-12 (line 39) and
the range test starts on 2026-10-12 (line 55); the other tests ask for 2026-10-01 to 2026-10-31.
No row ever sits before `fromDate`, so deleting `gte(standbyDate.date, fromDate)` at
find-standby-dates.ts:29 leaves all four tests green. The upper end is proven (2026-10-26 is
left out of a range ending 2026-10-19), the lower end only for inclusion. 5c reads this per
week, so a lost lower bound would also hide a person on dates before the week asked about.
**Suggested fix:** Give Sofia one more standby date before the range, say 2026-10-05, which the
range test must not return. The other tests ask for Ana and Luis, or for Sofia under another
business, so they need no change. Test only, no code change.
**Resolution:** Fixed 2026-10-01 in 5b.3's review-fix commit: Sofia also has 2026-10-05, before the range the test asks for. With the lower bound removed from findStandbyDates the range test now fails; with it back, all four pass.
