# The resource model, and the businesses it has to fit

**Status: approved and applied, 2026-09-22.**

Frank approved section 5 the same day it was written. All seven plan edits and
all three drift fixes in section 8 are now in `build-plan.md` and
`project-plan.md`. This file stays as the record of why, because the reason a
uniqueness constraint has two columns is not visible from the constraint.

The proposed text in section 5 is kept verbatim rather than rewritten into past
tense: it shows what was replaced and what replaced it, which is the part worth
reading back. Section 6 still holds what this deliberately did **not** decide,
and section 7 still holds three open questions.

Written 2026-09-22, during a review of the whole plan against three business
shapes Frank named: one person working alone, a few people cutting hair in a
shop that also sells products, and a painter with crews who go out to jobs. The
review was prompted by `store-and-retail-proposal.md`, which is a separate
question and stays separate.

One finding is structural and cheap to fix today. Everything else it turned up
is additive and can wait. Telling those two apart is the point of this file.

---

## 1. The finding

The plan contradicts itself about per-person hours, in two lines describing the
same table.

From `project-plan.md` section 4:

> `availability_rule`: one per organization, **enforced unique**.

From the same section, under "Locked, carried from the first repo":

> `availability_rule` is org-scoped, not per booking link. **Per-resource hours
> are a later addition on top of it**, not a replacement.

The second line has the right intention. The first makes it impossible. A
uniqueness constraint on `organizationId` alone means the database rejects the
second row, so per-resource hours is not an addition on top, it is a migration
of the table underneath.

The same shape applies to `calendar_connection`, which section 4 also declares
"one per organization."

**Why this matters more than a normal constraint choice:** these are the two
tables every booking in the system validates against. Changing their shape once
bookings are live is a migration on the hot path of the product's core loop.

**Why it is nearly free right now:** neither table has been written. They are
items 2 and 3, and the repo is mid-item-1. Today this is a sentence in a plan.

---

## 2. Three modes, not two

Naming them, because the plan currently has vocabulary for only the first and
the review kept having to invent words for the others.

| Mode | Who chooses the person | Who needs it |
|---|---|---|
| **1. Business-level** | Nobody. Book a service; capacity is how many can run at once | What the plan has today. The painter's estimate slots. A clinic with one practitioner |
| **2. Person-level, system assigns** | Nobody. Each person has their own hours and calendar; the system picks whoever is free | A clinic the moment it has a second practitioner. The case Frank raised |
| **3. Person-level, customer chooses** | The customer, by name | Barbers, dentists, stylists, tattooists. "I see Dr. Chen" |

Two things follow, and both change what is worth building.

**Mode 2 carries almost all of the cost, and none of it is visible.** Per-person
hours, per-person calendars, and a booking that knows who it belongs to are all
plumbing. Mode 3 adds a dropdown and a filter on top of mode 2. So the thing to
get right now is the part nobody sees, and the visible feature can wait for a
tenant who asks.

**The painter needs none of it.** A customer books an estimate, which is mode 1.
The job is then assigned to a crew internally, which is item 19 and already
planned. The customer never picks a painter and should not. This is the reason
the fix stays narrow rather than becoming a redesign.

Cal.com has industry vocabulary for the same distinction, worth borrowing
because it is what any future hire will already know: **collective** (everyone
must be free), **round-robin** (rotate among staff, which is mode 2), and
**managed** event types. Read it for the taxonomy only. Cal.com is AGPLv3, so
copying code into this product would oblige open-sourcing it or buying their
commercial licence. Ideas yes, code no.

---

## 3. Structural versus additive

The whole review reduces to this table. The left column is a shape change to a
table that will hold live data. The right column is a new table, or a new column
on a table, which can land any time.

| Structural. Decide now, free now | Additive. Defer at no cost |
|---|---|
| `availability_rule` uniqueness | The customer-facing picker (mode 3) |
| `calendar_connection` uniqueness | Which staff can perform which service |
| Where `resource` is created | Staff logins, and per-seat pricing |
| | No-show handling and deposits held |
| | Recurring appointments |
| | Multiple locations |
| | Travel time between jobs |

Two consequences of the structural change worth stating, because they are free
and were not asked for:

- **Per-resource buffers and timezones come with it.** Both are columns on
  `availability_rule`, so once that table can hold a per-resource row, a
  practitioner with a longer turnaround or a second shop in another timezone is
  already expressible.
- **Nothing in mode 1 changes.** A business with no per-resource rows behaves
  exactly as the plan describes today.

---

## 4. The trap in the fix

`unique(organizationId, resourceId)` with a nullable `resourceId` does **not**
do what it looks like. In Postgres, NULLs are distinct in a unique index by
default, so that constraint permits two org-wide rows for the same organization,
which is the exact thing the current `enforced unique` exists to prevent.

Two ways out:

1. `UNIQUE NULLS NOT DISTINCT`, which needs Postgres 15 or later. Drizzle
   supports it through `.nullsNotDistinct()`. **Verify the Railway instance's
   version before relying on this**; it was not checked when this was written
   because the tunnel was down.
2. Two indexes, which works on any version: a partial unique index on
   `(organizationId) WHERE resourceId IS NULL` for the org-wide row, plus a
   plain `unique(organizationId, resourceId)` for the per-resource rows.

Option 2 is the safer default. Whichever is used, the reason belongs in a
comment on the table, because a future reader will otherwise "simplify" it back
into the broken version.

---

## 5. Proposed plan edits

Exact text, so review is reading rather than guessing. **Do not apply before
approval.**

### 5a. `build-plan.md` item 2, replacing the first sentence

Current:

```markdown
- [ ] 2. **Booking links and availability rules** - the two tables, the
  public read route, the seed CLI, and the shared-package layout. Several
  windows per day, a booking horizon, and statutory holidays resolved from
  a country code.
```

Proposed:

```markdown
- [ ] 2. **Booking links, resources and availability rules** - the three
  tables, the public read route, the seed CLI, and the shared-package layout.
  Several windows per day, a booking horizon, and statutory holidays resolved
  from a country code. `availability_rule` is unique per organization **and
  resource**, with a null resource meaning the business's own hours and a set
  one meaning that person's: a resource with its own row uses it, one without
  falls back to the organization's. One resolution function, written here and
  called by every later item. Null-safe uniqueness is not automatic in
  Postgres; see the trap in `resource-model-proposal.md` section 4
```

The rest of item 2, the paragraph fixing the typed front-to-back seam, is
unchanged.

### 5b. `build-plan.md` item 3, replacing it whole

Current:

```markdown
- [ ] 3. **Calendar connection** - the table, the cipher, OAuth connect and
  disconnect, the provider seam, and the free/busy query verified against a
  real event
```

Proposed:

```markdown
- [ ] 3. **Calendar connection** - the table, the cipher, OAuth connect and
  disconnect, the provider seam, and the free/busy query verified against a
  real event. Unique per organization **and resource**, same shape and same
  reasoning as `availability_rule`: null is the business calendar, set is that
  person's. Only the business calendar is connected in this item; nothing
  builds a per-person connection screen until a tenant has two people
```

### 5c. `build-plan.md` item 4, removing `resource`

Current:

```markdown
- [ ] 4. **CRM spine** - `contact`, `pipeline_stage` seeded with the four
  defaults at provisioning, `resource`, and `activity` carrying both the
  timeline and the next-step queue. The tables and the API routes the loop
  writes to. Nothing visible yet
```

Proposed:

```markdown
- [ ] 4. **CRM spine** - `contact`, `pipeline_stage` seeded with the four
  defaults at provisioning, and `activity` carrying both the timeline and the
  next-step queue. The tables and the API routes the loop writes to.
  `resource` moved to item 2, because availability is defined per resource and
  cannot reference a table that arrives two items later. Nothing visible yet
```

### 5d. `project-plan.md` section 4, replacing the `availability_rule` bullet's first sentence

Current:

```markdown
- `availability_rule`: one per organization, enforced unique. Timezone,
```

Proposed:

```markdown
- `availability_rule`: unique per organization and resource. A null resource is
  the business's own hours; a set one is that person's, and a resource without
  its own row falls back to the organization's. Timezone,
```

The remainder of that bullet, including the paragraph about several windows per
day and Primo's real schedule, is unchanged and still correct.

### 5e. `project-plan.md` section 4, replacing the `calendar_connection` bullet's first sentence

Current:

```markdown
- `calendar_connection`: one per organization. Provider discriminator,
```

Proposed:

```markdown
- `calendar_connection`: unique per organization and resource, same shape as
  `availability_rule`. Provider discriminator,
```

### 5f. `project-plan.md` section 4, replacing the `resource` bullet

Current:

```markdown
- `resource`: per organization. A crew, a practitioner, an estimator. Name
  and active flag; working hours of its own come later. A booking and a job
  point at one. Capacity is how many resources are free at a time, so a
  clinic with three practitioners takes three bookings at 2pm and a painter
  with one estimator takes one. An organization with no resources behaves as
  one.
```

Proposed:

```markdown
- `resource`: per organization, built in item 2 beside availability rather than
  with the CRM spine, because it is a scheduling primitive and not a CRM one.
  A crew, a practitioner, an estimator, a chair. Name and active flag. A
  booking and a job point at one. Its own hours, buffer and timezone are
  expressible from the first migration through `availability_rule`, and nothing
  builds a screen for them until a tenant has two people.
  Capacity is how many resources are free at a time, so a clinic with three
  practitioners takes three bookings at 2pm and a painter with one estimator
  takes one. An organization with no resources behaves as one.
  **Which resources are free, not merely how many**, is what the booking check
  answers, so the same query serves a capacity pool and a named person.
```

### 5g. `project-plan.md` section 4, replacing the second "Locked" bullet

Current:

```markdown
- `availability_rule` is org-scoped, not per booking link. Per-resource hours
  are a later addition on top of it, not a replacement.
```

Proposed:

```markdown
- `availability_rule` is scoped to an organization and optionally a resource,
  never to a booking link. Per-resource hours are a row in the same table, not
  a second table and not a migration. This was a contradiction in the first
  draft: it promised per-resource hours "on top of" a table declared unique per
  organization, which the database would have refused.
```

### 5h. `build-plan.md`, appending to "Named, not planned"

`Per-resource working hours` comes **off** that list, since 5a makes the shape
part of item 2. These go **on** it:

```markdown
- Customer-facing choice of practitioner or staff member at booking
- Which staff member can perform which service
- No-show handling: a card on file, a fee, or a deposit held
- Recurring appointments, weekly or every few weeks
- Multiple locations for one business
- Travel time between jobs, as distinct from a flat buffer
```

Each is additive per section 3. None needs deciding before a business asks.

---

## 6. What this does not decide

- **Whether mode 3 is ever built.** Every current tenant is mode 1. This
  proposal only stops mode 2 and 3 from requiring a migration.
- **Anything about the retail proposal.** Separate file, separate decision. The
  two touch only where a sale records which staff member made it, which is
  additive in both.
- **Anything in flight.** Item 1 step 1.5 is built and unproven; none of these
  edits touch it.
- **Per-seat pricing.** See the question below; it is a commercial decision, not
  a schema one.

---

## 7. Three things this needs from outside the code

1. **Does the clinic take deposits at booking?** This is already open question
   16, and the review found it is bigger than it reads. A deposit is her
   customer paying **her**, which is the same money flow as Stripe Connect in
   the retail proposal's item 31. If the answer is yes, Connect moves from item
   31 to before item 17, which is the largest single relocation of work in the
   plan. Ask before retail is scheduled, not after.
2. **Is per-seat pricing still the intent?** `project-plan.md` section 6
   promises "per-seat tiers on Stripe hosted checkout" for Phase 9, but staff
   logins are unplanned and item 1 put invitations out of scope. One login per
   business means there is nothing to charge per seat for. Either the pricing
   model changes or staff logins need an item.
3. **What Postgres version is the Railway instance?** Decides which of the two
   null-safe uniqueness options in section 4 is available. One query, once the
   tunnel is up.

---

## 8. Smaller drift found in the same review

Not part of the resource model, and **all three were applied on 2026-09-22
alongside section 5**:

- `build-plan.md` item `0b` was unticked while the ten mockups existed in
  `prototypes/` and the published build log showed it Done. Ticked.
- `project-plan.md` numbered three things twice. "Decided 2026-09-18" runs 1 to
  13 and "Open questions" ran 11 to 16, so **11, 12 and 13 each named two
  different things**: decided 12 was quotes as item 16, open 12 was the
  browser-to-API question; decided 13 was reminders, open 13 was the clinic's
  deposits. Open questions renumbered to 14 to 19, continuing the single
  sequence the two lists were evidently once part of. Both proposals' references
  were updated in the same edit, and `store-and-retail-proposal.md` carries a
  note recording its question's old number.
- Section 8's environment list omitted `APP_ORIGIN` and `COOKIE_DOMAIN`, both
  added by item 1. Added, marked as coming from item 1. Step 1.6 still owns
  `.env.example` itself.

---

## 9. State of this repo when this was written

- Branch `feature/multi-tenant-auth-with-the-org-fix`, item 1, steps 1.1 to 1.4
  committed and step 1.5 written but uncommitted: its gate is a live sign-in and
  the API and the Postgres tunnel were down.
- This file and `store-and-retail-proposal.md` were the only non-code additions
  at the time of writing. Section 5 was approved and applied within the same
  session, so `build-plan.md` and `project-plan.md` now carry the edits too.
- `store-and-retail-proposal.md` remains an unapplied proposal. Nothing in it
  has been agreed, and the two files must not be read as having the same status.
- All of this shows up in `git status` mid-feature. Committing the plan work
  separately from step 1.5's code, or after item 1 lands, is cleaner than
  folding it into that branch.
