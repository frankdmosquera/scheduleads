# Feature: CRM spine

**From build-plan:** feature 4

**Branch:** feature/04-crm-spine

Branch named in the workspace's `feature/NN-name` form, so one number finds the
branch, the archive (`04-crm-spine.md`) and the tag (`item-04-done`).

## Goal

The three tables every later module writes to, built before anything reads
them, so the CRM fits later without a rewrite (project plan, decision 5):

- `pipeline_stage`: a business's own ordered stages. Every business has the
  four defaults, New, Contacted, Booked and Done: existing businesses get
  them by migration, new ones when they are set up.
- `contact`: the people a business deals with, one timeline each.
- `activity`: one table for the timeline (what happened) **and** the
  next-step queue (what is still owed), the Pipedrive idea.

With them, the small backend functions the booking loop (features 5 to 8)
calls to use them: the business's first stage, find or create a contact,
and record a timeline entry. Nothing is visible yet; the screens are
feature 11.

## In scope

- The three tables, each with its migration, organization-scoped like every
  app table, and the database rules that keep one business's rows away from
  another's.
- The four default stages: a migration backfill for every existing business,
  the `afterCreateOrganization` hook for every new one (so `POST
  /admin/clients` gives a client their stages), and the dev seed.
- Backend functions in `backend/lib/crm/`: `seedPipelineStages`,
  `findFirstPipelineStage`, `findOrCreateContact`, `recordActivity`.
- The shared lists both sides will read: the default stage names and the
  activity types.
- Tests for every function and every database rule, against the local
  database.

## Out of scope

- **HTTP routes.** See Notes for the AI and Decisions: the build plan's "API
  routes the loop writes to" is read as the server-side functions the loop
  calls. Routes arrive with the screens that need them (feature 11 for
  leads, contacts and next steps, feature 12 for stages).
- `lead`, `booking`, `commitment`: feature 5. A stage is pointed at by a lead,
  which does not exist yet.
- Renaming, reordering, adding or deleting stages: features 12 and 14.
- Completing a next step, listing a timeline, adding a contact by hand: the
  screens of feature 11. The table already holds next steps; nothing writes
  one yet.
- Merging duplicate contacts, importing contacts, contact search.
- Any screen.

## Build loop

`workflow.stepReview` is `every` and `workflow.checkpointCommits` is
`enabled`.

Each step's plan (Part 1, what it builds; Part 2, Done when) is gone through
with Frank and gets its own yes just before it is built. After that yes the
step runs straight through without asking: build, tests and checks, tick the
box here, write the build log entry and push buildlogs, commit
(`feat: 4.N <what>`) and push to the feature branch, `/audit` scoped to the
step, then the independent review. The one planned stop is after the review,
where its findings are talked through. P0/P1 are fixed before the next step,
or Frank accepts them with a reason; P2/P3 are recorded and carried.

Only three things stop a step earlier: the agreed plan turns out wrong while
building, a line only Frank crosses (a package, Railway or real data, `main`,
a merge, a force push, deleting anything), or blocking review findings.

`/complete` runs its own final review over the already-reviewed steps, then
merges with a merge commit on Frank's yes.

## Build steps

- [x] **4.1 Pipeline stages.** Every business has its four stages.
  - **Plan approved by Frank 2026-09-30, with one tightening:** stage names
    are unique in a business ignoring capitals ("New" and "new" are the
    same name), a unique index on `(organizationId, lower(name))`.
  - `packages/shared/crm/default-pipeline-stages.ts`: the four, in order:
    New, Contacted, Booked, Done. A new code folder: added to both
    `tsconfig` include lists and given its own subpath export
    (`@scheduleads-app/shared/crm`), as the standards require.
  - `packages/shared/db/crm-tables/pipeline-stage-table.ts` and migration
    `0006_pipeline_stage` (generated, then a hand-written backfill at its end
    that gives every existing business the four, as 0004's backfill did).
  - `backend/lib/crm/seed-pipeline-stages.ts`: gives a business the four if
    it has none; running it twice changes nothing.
  - `backend/lib/crm/find-first-pipeline-stage.ts`: the business's first
    stage, where feature 5 puts a new lead.
  - The `afterCreateOrganization` hook calls `seedPipelineStages` after the
    first person. If it fails, `provision-client.ts` removes the half-made
    business as it already does.
  - `packages/shared/scripts/seed-dev.ts` gives both dev businesses the four.
  - **Done when** `npm run test --workspace=backend` and the shared tests
    pass, with tests proving: a business set up through `POST /admin/clients`
    has exactly New, Contacted, Booked, Done in that order; running the seed
    function again adds nothing; `findFirstPipelineStage` gives New, and
    nothing for a business with no stages; two businesses can both have a
    stage named New, one business cannot have two, nor "New" and "new"; and after `db:migrate` and
    `db:seed`, Summit Painting (dev) and Riverbend Clinic (dev) each have the
    four. The backend builds.

- [ ] **4.2 Contacts.** The people a business deals with.
  - **Blocker for this step's plan, Frank's call:** how contacts are matched
    (see Open questions). Built as the recommended answer unless he chooses
    otherwise.
  - `packages/shared/db/crm-tables/contact-table.ts` and migration
    `0007_contact`.
  - `packages/shared/zod-validation/crm-validation-schemas/contact-validation-schema.ts`:
    name (trimmed, 1 to 120), email (the shared email rule, optional), phone
    (trimmed, up to 40, optional).
  - `backend/lib/crm/find-or-create-contact.ts`, the function feature 5
    calls for every booking.
  - **Done when** the backend and shared tests pass, with tests proving the
    matching rule Frank picks; that a contact is only ever found inside its
    own business (the same email in two businesses is two contacts); that two
    calls at the same moment with the same email make one contact; that an
    email is stored lowercased; and that a contact with no email is always a
    new one. The backend builds.

- [ ] **4.3 The activity table: timeline and next steps.**
  - `packages/shared/crm/activity-types.ts`: the eight types, `booking_created`,
    `stage_changed`, `email_sent`, `email_received`, `note`, `sms_sent`,
    `call`, `task`, one list both sides import.
  - `packages/shared/db/crm-tables/activity-table.ts` and migration
    `0008_activity`.
  - `backend/lib/crm/record-activity.ts`: records something that happened on
    a contact's timeline.
  - **Done when** the backend tests pass, with tests proving: an entry is
    recorded with its type, payload, actor and time; an entry cannot name
    another business's contact (refused by the database, not only the code);
    a row is either something that happened (`occurredAt`) or something
    still to do (`dueAt`, later `doneAt`), never both and never neither; a
    type outside the list is refused; and deleting a contact takes its
    timeline with it. The backend builds.

## Files / areas

- `packages/shared/crm/` (new): `default-pipeline-stages.ts`,
  `activity-types.ts`, tests beside them; `packages/shared/package.json`
  (the `./crm` export), `tsconfig.json` and `tsconfig.build.json` (the folder)
- `packages/shared/db/crm-tables/` (new): one table per file;
  `packages/shared/db/index.ts`
- `packages/shared/migrations/0006` to `0008`, generated from
  `packages/shared` only
- `packages/shared/zod-validation/crm-validation-schemas/` (new) and
  `zod-validation/index.ts`
- `packages/shared/scripts/seed-dev.ts`
- `backend/lib/crm/` (new): one function per file, tests beside them
- `backend/lib/auth/auth-server.ts` (the hook)

## Data / contracts

Every table carries `organizationId` (FK to `organization`, cascade), text
ids (`randomUUID()`), `createdAt` and `updatedAt` as `timestamptz`. The
business always comes from the caller on the server (a session, or the slug
lookup of a public route), never from anything a client sends; every
function takes `organizationId` as its first argument and every query
filters on it.

**pipeline_stage**

- `id`, `organizationId`, `name` (text, not null), `position` (integer, not
  null).
- Unique `(organizationId, lower(name))`: one business cannot have two
  stages with the same name, capitals ignored (Frank, 2026-09-30). Unique `(organizationId, id)`, so feature 5's `lead` can
  point at a stage of its own business only, as `availability_rule` does
  with `resource`.
- Order is `position` ascending, ties broken by `createdAt` then `id`.
  `position` is not unique, so reordering later (features 12, 14) needs no
  juggling.
- Defaults: New 1, Contacted 2, Booked 3, Done 4. "First stage" means the
  lowest position.

**contact**

- `id`, `organizationId`, `name` (text, not null), `email` (text, nullable,
  always stored lowercased: a check refuses anything else), `phone` (text,
  nullable, stored as typed, trimmed).
- Unique `(organizationId, id)`, so `activity` (and feature 5's `lead`) can
  point at a contact of its own business only.
- Matching (recommended answer, see Open questions): unique `(organizationId,
  email)` where `email` is not null. `findOrCreateContact(organizationId,
  { name, email?, phone? })` returns `{ contact, created }`: with an email it
  inserts with `on conflict do nothing` and then reads the row, so two
  bookings at the same moment cannot make two contacts; the existing
  contact's name and phone are kept, not overwritten. Without an email it
  always creates.
- No rule that a contact must have an email or a phone: the forms that make
  contacts (features 5 and 11) decide what they require.

**activity**

- `id`, `organizationId`, `contactId` (not null; FK `(organizationId,
  contactId)` to `contact(organizationId, id)`, cascade), `type` (text, not
  null, checked against the eight types), `payload` (jsonb, not null,
  default `{}`), `actorUserId` (nullable, FK `user`, set null: the login that
  did it; null when a customer or the system did), `occurredAt`, `dueAt`,
  `doneAt` (all `timestamptz`, nullable).
- A check: exactly one of `occurredAt` and `dueAt` is set; `doneAt` only
  when `dueAt` is. A row with `occurredAt` happened; a row with `dueAt` is a
  next step, done once `doneAt` is set.
- Indexes: `(organizationId, contactId, occurredAt)` for a timeline, and
  `(organizationId, dueAt)` where `doneAt` is null for the next-step queue.
- `recordActivity(organizationId, { contactId, type, payload?, actorUserId?,
  occurredAt? })` writes a happened row, `occurredAt` defaulting to now.
- The payload's shape belongs to the feature that writes each type (feature
  5 defines `booking_created`'s). Anything from a customer in a payload is
  rendered as text, never HTML, when feature 11 shows it.

**The types are text, never a Postgres enum** (project plan: stages, resources
and the timeline are tables, never enums). The list lives once in
`packages/shared/crm/activity-types.ts`; the database check repeats it, and a
new type is one migration and one line.

## Testing

- Backend: one test file per function in `backend/lib/crm/`, against the
  local `scheduleads_dev` with the existing local-dev-database guard, each
  making and removing its own throwaway businesses. Database rules (the
  composite foreign key, the checks, the unique indexes) are proved by
  inserting the bad row and expecting Postgres to refuse it.
- Shared: the two lists and the contact schema.
- Each new test shown able to fail once, as in earlier features.
- No frontend change, so no browser check.

## Notes for the AI

- "The API routes the loop writes to" (build plan) is read as backend
  functions, not HTTP routes: every write in features 5 to 8 happens inside
  the API (the public booking route, the job runner), and no screen calls
  these until feature 11. An HTTP route with no caller is a route to secure
  and test for nothing. Frank confirms this reading in the whole-feature
  pass.
- Migrations: generate from `packages/shared` only, read the SQL before
  committing (the standards), and the 0006 backfill is hand-written at the
  end of the generated file, as 0004's was. Apply to the local database only;
  Railway gets them at deploy.
- The hook runs outside Better Auth's writes; `provision-client.ts` already
  removes a business when anything after its save fails, the stages
  included.
- The overview's data model passage lists `contact.email` without saying
  whether it is required; this spec makes it optional on purpose (owner-made
  phone bookings in feature 5).

## Open questions

- **How contacts are matched** (step 4.2's blocker). Recommended: the same
  email in the same business is the same contact, so a repeat customer's
  bookings all land on one timeline; a contact without an email is always
  new; the first name given is kept. The alternative: every booking makes a
  new contact, and duplicates are merged by hand later, which no screen
  plans for.
