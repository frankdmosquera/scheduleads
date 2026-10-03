# Independent Review

**Status:** passed
**Target commit:** aa237dabd7f89d8af22946db59d2b96227adcf12
**Base commit:** 12a21d6b803c700faa23a29df7d974039481a115
**Base ref:** main
**Spec hash:** 4c582853935f3105a12f919875125ebf58816774f2ac835fde36f434e6d1f13d
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-02T23:58:14Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-03T00:07:52Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `12a21d6b803c700faa23a29df7d974039481a115..aa237dabd7f89d8af22946db59d2b96227adcf12` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (target, base and spec hash match; only review.md differed)
- `npm run test --workspace=@scheduleads-app/shared`: pass (11 files, 90 tests)
- `npm run test --workspace=backend`: pass (36 files, 356 tests, against the local migrated and seeded scheduleads_dev)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass
- `npm run format:check`: pass
- `npm run db:generate --workspace=@scheduleads-app/shared`: pass ("No schema changes, nothing to migrate"; tree unchanged after)
- Scratch mutation runs, each reverted with `git checkout` and the tree confirmed clean: pass (every guarded rule re-examined below made its test fail)
- Scratch race probe (a temporary test file, deleted after): ran; showed F-92

## Evidence

- Whole delta read: migrations 0013 to 0015 and their tables, the executor-taking writers (holdTime in a savepoint per try, releaseTime, findOrCreateContact, recordActivity), isRoomFree and appointmentSpan, orderAnyAvailable, bookTime and holdFirstFreeChoice, getFreshAccessToken, writeBookingEvent and the Google createEvent, the public bookings route, the CORS change, the times route's 503, and every new or changed test.
- Tenant scoping: every query in bookTime, findBookedByRequestKey, writeBookingEvent and the route filters by organizationId, taken only from the slug through findBookableOrganizationId; every new foreign key is a composite same-business key; another business's service or person is the one identical 404 (route and bookTime tests).
- Customer data: the 201 body carries only ids, times, zone, service and person names (asserted against name, email, phone, address and words); both new log lines carry a resource or booking id and safeErrorReason, which reduces database errors to their Postgres code; the activity payload holds ids and the start only.
- Concurrency: the two-bookings-at-once test gives one booked and one time_taken with nothing left behind; the two-copies-at-once test fails with the request-key clash handling disabled; the deadlock retry inside a caller's transaction test fails with ATTEMPTS = 1; no query inside the booking transaction uses the pool.
- Decisions 1 to 16 checked against the code: owner membership check, appointment-only startsAt/endsAt with buffers in commitments, a new lead per booking, decision 5's order and retry, Google after commit with failures kept, request keys with isSameRequest, decision 9 on both routes, 16 KB bodyLimit before validation, decision 11's owner rules, decision 12's message, in_the_past for the owner, decision 14's event, decision 15's phone, decision 16's phone-or-email refine.
- Fixed findings re-examined and closed with scratch evidence: F-75, F-76, F-77, F-78, F-84, F-85, F-86, F-87, F-88, F-89, F-90, F-91.
- F-92 probe: with the second copy's check held until the first copy booked, the second answered time_taken for the same key, service, person and start.

## Findings

- F-92 [P2] open: a resent form whose check runs after its first copy committed answers time_taken (or unavailable) instead of that booking
- F-93 [P3] open: the customer's answer waits for Google's event write, up to 10 seconds (20 with a key renewal)
- Closed this pass: F-75, F-76, F-77, F-78, F-84, F-85, F-86, F-87, F-88, F-89, F-90, F-91
- No P0 or P1 is open or fixed in the ledger

## Remaining risk

- Check was not required and was not run; no browser exercised the route (feature 9 builds the widget).
- Migrations 0013 to 0015 were not replayed on a fresh database in this review (the dev database holds a real Google connection); db:generate found no drift and the backend tests ran against the migrated schema.
- Google itself was never called: createEvent and token renewal are proven only against faked responses.
- Concurrency is proven for the interleavings the tests and the probe force; other timings rely on the database constraints (commitment_no_overlap, booking_request_key_unique, the contact email index).
- Rate limiting of the public route remains out of scope (feature 9, F-62).
