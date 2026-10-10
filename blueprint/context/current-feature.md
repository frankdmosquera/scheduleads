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
