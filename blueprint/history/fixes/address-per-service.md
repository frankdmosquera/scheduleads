# Fix: Address on or off per service

**Type:** Fix

**Size:** light: one setting and the places that read the address; one step, reviewed at
`/complete` (`AGENTS.md`, "Each feature is heavy or light").

**Status:** verified 2026-10-10: backend 894, shared 172 and booking component 79 tests pass, the frontend builds, and the preview pages were checked in the browser.

**Branch:** `fix/address-per-service`

**Fixes:** F-304, F-305, F-306

## The problem

The booking window asks every customer for an address and refuses to book without one
(`createBookingValidationSchema.location`, `booking.location` is `not null`). A painter
needs it; a video or phone call with AgentsWeb does not, so a visitor booking a call on the
agency site is forced to type an address. Found while booking AgentsWeb's first call in
feature 10.

Carried from feature 10's review, all in `packages/shared/client-setup/`:
F-304 (P2) the setup command does not report a hand change to a person's own hours, their
worker texts or an added who-does-what tick; F-305 (P3) a setup file's `hours` are typed
`unknown`, so the editor checks nothing in them; F-306 (P3) `run-client-setup.test.ts` has
type errors the editor shows.

## The fix

**Each service says whether it asks for the address** (the client decides, plan decision
30): `booking_link.asksAddress`, a boolean with no default.

- Migration: the column added, every existing service set to `true` (they all asked until
  now), no default left; `booking.location` becomes nullable.
- Setup file and seed: `asksAddress` required on every service. Summit Painting and
  Riverbend keep `true`, as today; AgentsWeb's two calls are `false` (its two services on the
  dev database are switched by hand once, since the command never changes a row).
- Public API: each service carries `asksAddress`. A booking for a service that asks needs an
  address ("Enter the address.", as today); for one that does not, any address sent is not
  stored and the booking keeps `null`.
- The window shows the address field only when the service asks.
- Every reader of the address copes with none: the customer's and the business's emails, the
  calendar invite (`.ics`), the Google event and the worker's texts leave the address line
  out.
- F-304: the differences also cover each person's own hours, worker texts and ticks.
  F-305: `hours` typed as the business hours input. F-306: the test's types fixed.

Must not break: every booking that has an address today reads exactly as before.

## Build steps

- [x] **Address per service, and feature 10's three findings.** All of the above.
  **Done when:** tests show a service that asks still refuses a booking without an address,
  one that does not books with `null`, and every email, invite, event and worker text renders
  without one; the setup command reports each newly covered difference; the shared editor
  typecheck (`tsc -p packages/shared/tsconfig.json`) passes; all suites pass; on the
  preview page an AgentsWeb video call books with no address field, and Summit Painting's
  window still asks for one.

## Verify

http://localhost:3400/admin/booking-preview/agentsweb: book a video call, no address asked.
http://localhost:3400/admin/booking-preview/painting-dev: the address is still asked.

## Implementation walkthrough

One step, as the spec planned (light).

### packages/shared: the setting and the rules

Migration 0025 adds `booking_link.asksAddress` with `true` for every existing service (they all
asked until now), then drops the default, so a new service must say (decision 30); and
`booking.location` becomes nullable. Its check, a non-blank address, still holds for any address
stored. The booking form's schema takes `location` as optional: whether a service needs one is
the API's call, because only the API knows the service. A setup file's service must carry
`asksAddress`; the seed keeps Summit Painting and Riverbend at `true`, and AgentsWeb's two calls
are `false` (switched by hand once on the dev database, since the setup command never changes a
row).

F-304: the setup command's differences now also read each person's own hours, their worker
texts and every tick, naming ticks added by hand. F-305: the setup file's `hours` schema restates
its input type, so the editor checks a file's hours. F-306: the test counts rows with
`db.$count` per table, and `tsc -p packages/shared/tsconfig.json` is clean.

### backend: asked only when the service asks

`bookTime` reads the service's `asksAddress`. A customer booking a service that asks without an
address is refused with "Enter the address." (`address_needed`, a 400); the owner, booking from a
phone call, may leave it for later, as with the questions. For a service that asks none, an
address sent anyway is never stored. Each service in the public list and detail carries
`asksAddress`. Every reader of the address copes with none: the five emails leave their Where or
Address line out, the calendar invite has no LOCATION line, the Google event leaves location
unset, and the worker's text ends on the service.

### packages/booking-component: no box when not asked

The form's choice carries the service's `asksAddress`. When false, the Address box is not drawn
and no address is sent; when true, an empty one is said under Address before sending.

### Tests

Route tests book on the day after the shared test day, so they never take a time a later test
needs. They show a service that asks refusing no address and booking nothing, one that asks none
booking with none and keeping none even when one is sent (shown able to fail), and the list
naming each service's choice. Render tests cover all six emails, the invite and the worker text
without an address; the window shows no box and sends none. Every test that makes a service by
hand now says `asksAddress: true`.

## Findings

### address-per-service/F-304 [P2] closed - The setup command lists differences only for business hours, questions, services and a person's kind, so a hand edit to a person's own hours, worker texts or extra ticks is kept without a word

**File:** packages/shared/client-setup/run-client-setup.ts:143-150 (and apply-business-shape.ts:98-131, 165-177)
**Found:** 2026-10-10 by independent review of feature 10 (scope: current, c786f7e..d9e4709; lenses: quality, security, performance, tests)
**Why it matters:** Step 10.3 says the command "lists every difference between the file and the database so a hand edit is seen, not overwritten". findDifferences compares the business hours row, the questions, each service's own fields and a person's kind, but for people it reads only `kind`. applyBusinessShape skips a person whose hours row exists (line 131), adds worker-text settings only while none exist (onConflictDoNothing) and adds missing ticks without reading extra ones. So when a person's week, date hours or worker-text settings in the file differ from the saved row, or a tick was added by hand, the command prints "nothing to add" and no "differs, kept" line: the file and the database disagree and the output says they agree. Not reachable with today's only setup file (agentsweb.ts has `people: []` and no ticks); it is reachable on the first setup file for a business with people, such as Primo Painters or Face and Body. Nothing is lost: every row is kept.
**Suggested fix:** In findDifferences, for each listed person that exists, compare their own hours row (weeklyHours, dateHours) and their worker-text settings with the file, and for each service report ticks in the database that the file does not list; add one test case that changes a person's hours by hand and expects the difference.
**Resolution:** Fixed 2026-10-10 on fix/address-per-service: the differences now cover each person's own hours, their worker texts and ticks added by hand, each shown by run-client-setup.test.ts ("keeps a row changed by hand and reports the difference"). Closed 2026-10-10 by the independent review of the address fix (2428dbd..0e8fbb1): findDifferences now compares each listed person's own hours row and worker-text row and names ticks added by hand; the test's hand edits each show, and a second apply of an unchanged file still reports nothing. A row the file says a person has none of is a separate gap, F-307.

### address-per-service/F-305 [P3] closed - A setup file's hours are typed unknown, so `satisfies ClientSetupInputType` checks nothing inside them

**File:** packages/shared/zod-validation/admin-validation-schemas/client-setup-validation-schema.ts:261-265 (seen in packages/shared/client-setups/agentsweb.ts:295 and run-client-setup.test.ts:102)
**Found:** 2026-10-10 by independent review of feature 10 (scope: current, c786f7e..d9e4709; lenses: quality, security, performance, tests)
**Why it matters:** `hours` is `z.preprocess(fn, businessAvailabilityRuleValidationSchema)`, and Zod 4 types a preprocess's input as `unknown` (`ZodPreprocess<U, B = unknown>`). A type probe compiled with the repo's tsc accepts `{ totally: "wrong", horizonDays: "x" }` as `ClientSetupInputType["hours"]`, while a wrong `personChoice` is refused (TS2322). So agentsweb.ts's `satisfies ClientSetupInputType`, and the seed's businesses typed through the same input type, get no editor check on the hours block: a misspelt field or a string horizon shows only when the command or the seed runs and the parse refuses it. It is also the cause of one of the test file's type errors (line 102, TS2698: spread of an unknown). The runtime parse is intact, so nothing wrong reaches the database.
**Suggested fix:** Type the input explicitly, for example `z.preprocess<unknown, typeof schema, Omit<z.input<typeof businessAvailabilityRuleValidationSchema>, "resourceId">>(...)`, or drop the preprocess and use `businessAvailabilityRuleValidationSchema` with `resourceId` made optional-null for the file, so the setup files are checked as they are written.
**Resolution:** Fixed 2026-10-10 on fix/address-per-service: setupHoursValidationSchema restates the input type as the business hours input without resourceId, so `satisfies ClientSetupInputType` checks a setup file's hours. Closed 2026-10-10 by the independent review of the address fix (2428dbd..0e8fbb1): a type probe compiled against the package tsconfig now refuses `horizonDays: "x"` and a `resourceId` in `ClientSetupInputType["hours"]`; the cast used for it is F-309.

### address-per-service/F-306 [P3] closed - run-client-setup.test.ts has type errors the editor shows and no command catches

**File:** packages/shared/client-setup/run-client-setup.test.ts:71-77, 102
**Found:** 2026-10-10 by independent review of feature 10 (scope: current, c786f7e..d9e4709; lenses: quality, security, performance, tests)
**Why it matters:** `tsc -p packages/shared/tsconfig.json` (the editor's view, which coding-standards.md says type-checks everything in the package) fails with six errors, all in this new file and none elsewhere in the package: five TS2345 because countRows' helper constrains its table to `{ organizationId: typeof organization.id }`, the organization table's own id column, which no other table's organizationId column matches; one TS2698 at line 102 from F-305. Vitest strips types and the build's tsconfig.build.json excludes tests, so the tests pass and the build is green while the file is red in the editor; a later wrong call in this test would not be caught by types either.
**Suggested fix:** Constrain the helper to the column type it needs (for example `<T extends { organizationId: AnyPgColumn }>` from drizzle-orm/pg-core) or pass the column itself (`inBusiness(bookingQuestion.organizationId)`); line 102 is fixed with F-305. Then `tsc -p packages/shared/tsconfig.json` passes.
**Resolution:** Fixed 2026-10-10 on fix/address-per-service: the test counts rows with db.$count per table; `tsc -p packages/shared/tsconfig.json` is clean. Closed 2026-10-10 by the independent review of the address fix (2428dbd..0e8fbb1): `npx tsc -p packages/shared/tsconfig.json` exits 0, and the test file counts rows with db.$count.

## Independent review

**Status:** passed
**Target commit:** 0e8fbb127bc9ad0b49562e4c5050850bbf0474b9
**Base commit:** 2428dbd3274cc3dcec02e28df714b56160042a52
**Base ref:** main
**Spec hash:** 9e078cc17fe1df97bfa4e14ef1fe5645d0bd2af6f56df5d1606bfcd2f5cbb509
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** runtime default (exact model not known until reviewer starts)
**Requested execution:** automatic
**Requested at:** 2026-10-10T04:47:30Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-10T04:52:28Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `2428dbd3274cc3dcec02e28df714b56160042a52..0e8fbb127bc9ad0b49562e4c5050850bbf0474b9` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `npx tsc -p packages/shared/tsconfig.json`: pass (exit 0, no errors)
- `npm run test --workspace=@scheduleads-app/shared`: pass (23 files, 172 tests)
- `npm run test --workspace=@frankdmosquera/booking-component`: pass (16 files, 79 tests)
- `npm run test --workspace=backend`: pass (78 files, 894 tests, against the local scheduleads_dev)
- `npm run build --workspace=backend`: pass (tsc)
- `npm run build --workspace=@frankdmosquera/booking-component`: pass (dist imports only react, react-dom, hono, zod)
- `npx prettier --check` on every .ts/.tsx file in the delta: pass
- A type probe of `ClientSetupInputType["hours"]` against the package tsconfig (scratchpad, deleted): a string horizonDays and a resourceId are refused

### Evidence

- HEAD, merge base with main and the spec SHA-256 match the request; only review.md differs from the target among tracked paths (plus the personal untracked blueprint/ai-voice-proposal.md, outside the product).
- Migration 0025: `location` drops NOT NULL; `asksAddress` is added NOT NULL DEFAULT true, so every existing service keeps asking, then the default is dropped; 0025_snapshot.json has asksAddress notNull with no default, location nullable, prevId equal to 0024 id. `booking_location_check` (length(btrim(location)) > 0) passes for NULL, shown by the 201 test that saves null.
- Every reader of a booking location found by `git grep location` copes with null: the five booking emails (field left out), booking-ics.ts (no LOCATION line), google-calendar-provider.ts (`?? undefined`, dropped by JSON.stringify), render-worker-text.ts (no address words), and the typed pass-throughs in find-booking-email-context.ts, write-booking-event.ts, find-worker-text-context.ts and send-*-emails.ts. The frontend and the public booking page routes read no booking location.
- book-time.ts: `address_needed` only when source is not manual and the service asks and no location came; the saved location is `service.asksAddress ? input.location : null`, so an address sent for a service that asks none is never stored (route test asserts null). The refusal comes before admitNewBooking, so no rate-limit slot is taken. bookTime has one caller (public-bookings-routes.ts, source widget).
- Shared schema: location optional but still trimmed, min 1, max 300 when sent; the component sends it only when `choice.asksAddress`, so an empty box for a service that asks still shows "Enter the address." under Address (read-booking-form.test.ts). The public service list and single service both carry asksAddress (one column set).
- F-304, F-305, F-306 re-examined in run-client-setup.ts, client-setup-validation-schema.ts and run-client-setup.test.ts: each defect is gone; closed in findings.md.
- Security: no new trust boundary; asksAddress is a public, harmless flag; ownership of the booking link is still checked by organizationId in bookTime. Performance: findDifferences adds bounded per-person and per-service queries in a local CLI run; no hot-path change.

### Findings

- F-307 [P3] open, F-308 [P3] open, F-309 [P3] open, F-310 [P3] open
- F-304, F-305, F-306 closed

### Remaining risk

- The frontend build and the preview pages named in the spec Verify section were not run by this review (Check not required); the frontend consumes the component through the same typed client the component build checked.
- If AgentsWeb's two services already exist on a database other than dev (Railway), migration 0025 sets them to asksAddress true; the setup command reports the difference but never changes a row, so they need the same one-time hand switch the spec records for dev.
- blueprint/ai-voice-proposal.md is untracked and differs from the target; it is a personal file outside the product and was ignored as instructed.
