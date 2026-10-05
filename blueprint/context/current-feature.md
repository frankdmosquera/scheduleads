# Feature: The background runner

**From build-plan:** feature 8a

**Branch:** feature/08a-the-background-runner

**Status:** verified. Feature 8 split into 8a, 8b and 8c on Frank's yes;
steps 8a.1 to 8a.3 built, tested and reviewed step by step, each with its
re-reviews; no P0 or P1 left open or fixed; decisions 5 and 6 amended with
Frank along the way. The checkpoint for the final review.

## Goal

Work that has to happen after a booking is saved (its emails, its event in
the booked person's Google) stops living in the API's memory. Today it is a
promise started after the save: a deploy or a crash in that moment loses it,
and a failure is logged once and never tried again, though eight places in
the code say "feature 8 retries". After this feature each piece of that work
is a job, a row in the same Postgres, added in the same transaction as the
booking, cancel or move that needs it. A runner inside the API works the
jobs, retries a failure with growing waits, and survives a restart. Nothing
changes for Jane or the business when everything works; when Resend or
Google fails for a while, the email arrives and the event lands anyway. The
texts (8b, 8c) are later jobs on this runner.

## In scope

- The runner: started with the API, stopped cleanly on a deploy, its jobs
  kept in the database. One way to add a job, inside the caller's
  transaction. One way for tests to run every due job to the end.
- The booking emails as jobs: the confirmation and notification (feature 6),
  the cancellation pair (7a) and the move pair (7b), one job per email.
- The Google event as jobs: the write when a booking is made (5d), the
  removal when it is cancelled (7a), the update when it moves (7b).
- The six in-memory trackers removed (F-156), and the carried Google leftovers
  closed: a move that gives up on the first person's calendar (F-149), two
  moves inside one follow (F-150), a failed write into the new person's
  calendar skipping the old event's removal (F-169).

## Out of scope

- Texts: the customer's confirmation and reminder (8b), the worker's text
  (8c).
- Refreshing Google tokens on a schedule, and follow-ups: later features that
  will use this runner; nothing in 8a needs them.
- A screen showing failed jobs: the owner's leads screens (feature 11) can
  show them; 8a logs them.
- Any change to what an email or an event says.

### Decisions made in the spec

1. **A job is added in the same transaction as the change that needs it.** A
   booking that rolls back leaves no job; a committed one always has its
   jobs, even if the API stops the next moment. Nothing is started "after
   the save" any more.
2. **One job per email and one per calendar change.** A customer email that
   fails is retried without sending the business's notification again. Each
   email keeps the idempotency key it has today, so a retry is never a second
   email.
3. **A job does what is still true when it runs.** It reads the booking
   afresh, as the senders already do. A confirmation still waiting when the
   booking was moved or cancelled is not sent (the move or cancel email tells
   her); this also settles 7b's note that a retried confirmation would carry
   the new times under its old Resend key. A calendar write for a cancelled
   booking writes nothing.
4. **Every failure is retried, with growing waits, then given up.** Up to 10
   attempts, the waits growing from seconds to about two hours, about three
   and a half hours in all; never once the appointment has started, when an
   email or an event change is no use. Giving up logs one line naming the job and the
   booking, never a customer's details; the job stays in the database, failed.
   Outcomes that are not failures are not retried: no calendar connected, no
   email set up, a cancelled booking.
5. **A booking's calendar jobs run one at a time, never in a set order.**
   Amended with Frank, 2026-10-05, planning 8a.3: they run in one of 16 fixed
   lanes, the lane named by the last character of the booking's id, so two of
   one booking's jobs never run at once and two moves close together can no
   longer race (F-150). A queue per booking was dropped: graphile-worker warns
   against that many queue names, which would need a cleanup on a schedule,
   and a failed job's retry waits while a later job of the same lane runs
   first, so no order holds anyway. Each job does what is still true when it
   runs (decision 3), which makes the order not matter. Emails need no lane.
   After the step's review (F-189, Frank, 2026-10-05): 256 lanes, named by
   the last two characters of the booking's id. A crash mid-job holds its
   lane for 4 hours, and with it every booking sharing the lane; 256 makes
   that about 1 booking in 256 instead of 1 in 16, for a few tens of
   kilobytes of queue rows and no noticeable cost.
6. **A removal carries what it removes.** When a move changes the person, or
   a booking is cancelled, the job is given the person and the event id at
   that moment, read inside the transaction (F-149). Writing the new
   person's event and removing the old one are separate jobs, so one failing
   never skips the other (F-169).
7. **The runner lives in the API process.** Railway's backend is a persistent
   Node process (the reason the backend is separate, settled 2026-09-19).
   `server.ts` starts it before listening and stops it on a deploy, letting
   running jobs finish; importing `app.ts` never starts it, so tests and the
   route types stay inert.
8. **Tests run the jobs themselves.** One helper works every due job to the
   end, replacing the 79 `settled()` waits; a test that wants a failure fakes
   it as today.
9. **The runner is graphile-worker** (Frank, 2026-10-04, open question 1).
   A job is added with one SQL call inside our own Drizzle transaction; named
   queues keep a booking's calendar jobs in order (decision 5); a job key can
   replace a waiting job, which 8b's reminder will use. Rejected: pg-boss,
   which needs an adapter to add jobs inside a postgres-js transaction and
   has no ordered queue per booking; our own table, which would rebuild the
   locking, waits and crash recovery the library already has. Its one cost:
   a job left mid-run by a crash (not a deploy, which stops cleanly) is
   picked up again only after its lock times out.

## Build loop

Steps are built one at a time on `feature/08a-the-background-runner`. Each
step's plan gets Frank's yes just before it is built. After that yes nothing
stops until the review: build, tests, tick the box, the build log entry,
commit with the step number and push to the feature branch, `/audit` scoped
to the step, then the independent review (`workflow.stepReview: "every"`,
`workflow.checkpointCommits: "enabled"`). Findings are talked through after
the review; P0/P1 are fixed before the next step. `/complete` makes the merge
commit, on Frank's yes.

One package: graphile-worker, installed in `backend` on Frank's yes
(2026-10-04, decision 9). It brings its own `pg` driver.

## Build steps

- [x] **8a.1 The runner.**
  - graphile-worker, in `backend` (decision 9, installed on Frank's yes).
  - `backend/lib/jobs/`: `enqueueJob(tx, name, payload, options)` that adds a
    job inside the caller's transaction (options: run after, a queue to run
    in order, attempts), its payload values ids and numbers only; the
    runner's start and stop; and a test helper that runs every due job to the
    end. The job names and their payload types arrive with the jobs that use
    them, in 8a.2 and 8a.3 (amended after 8a.1's review, F-174).
  - The runner's own tables installed by the API when its runner starts
    (once a job is defined), and by the test helper, never by hand.
  - `server.ts` starts the runner before listening and stops it on `SIGTERM`
    and `SIGINT`, letting running jobs finish.
  - Retries as decision 4: the attempt limit, the growing waits, the one log
    line when a job gives up.
  - **Done when** saved tests, against the local database, with a task only
    the tests register: a job added in a transaction that rolls back never
    runs; one that commits runs once; a task that fails twice then succeeds
    runs three times with growing waits; one that always fails stops at its
    limit with one log line and stays failed; a job added while no runner is
    running is worked by the next one started; jobs in one queue run one at
    a time in order; a runner that stops by itself takes the API down so
    Railway restarts it, while a stop the API asked for does not (F-173). The
    backend build passes; the API starts by hand and says the runner is not
    started while no job is defined (its workers would poll for nothing), so
    the runner's first start in the API is checked in 8a.2.
- [x] **8a.2 The emails as jobs.**
  - `bookTime`, `cancelBooking` and `moveBooking` add their email jobs inside
    their transactions, one per email, in place of the three email trackers,
    which are removed.
  - Each email job reads the booking afresh and sends one email under the key
    it has today, recorded on the timeline as today; a confirmation for a
    booking moved or cancelled meanwhile is not sent (decision 3); nothing
    after the appointment has started.
  - The email tests wait with the helper instead of `settled()`.
  - The API started by hand shows the runner working, now that jobs exist.
  - **Done when** saved tests: a booking, a cancel and a move each leave their
    email jobs and send exactly today's emails; a send that fails once is
    sent on the retry, under the same key, recorded once; the customer's
    email failing never resends the business's; a confirmation still waiting
    after a move or a cancel is not sent; no email after the start. Every
    existing email test passes unchanged in what it checks.
- [x] **8a.3 The Google event as jobs.** Planned with Frank, 2026-10-05.
  - A booking adds a write, every move adds a move, inside the transactions,
    in the booking's lane (decision 5), in place of the three event
    trackers, which are removed (F-156 closed).
  - A write or a move reads the booking when it runs: nothing for a booking
    gone or no longer confirmed, for a person with no calendar, once the
    appointment has started, or once a later move has its own job. It saves
    the event's id only while the booking still has the person and the move
    number it read, so a change landing during its Google call never gets
    the wrong calendar's id (F-150).
  - A move to another person, and a cancel, add a take-out carrying the
    person and the event id at that moment, read inside the transaction
    (decision 6, F-149). A take-out runs even after the appointment has
    started, since the event it removes can be at another time, and it is
    independent of the write, so one failing never skips the other (F-169).
    A move to the same person stays an update in place when an id is saved.
    Amended after the step's review (F-187, Frank's yes, 2026-10-05): with
    no id saved, the move or cancel adds a take-out of the id the write
    just before it would have used, and the move writes the event afresh
    under its own id. Narrowed after the re-review (F-190, Frank's yes):
    any earlier unsaved write was already taken out by its own change, so
    one id per change is enough and fast moves cost one call each.
  - The Google tests work the jobs with the helper instead of `settled()`.
  - **Done when** saved tests: a move whose first calendar needs reconnecting
    removes the old event once it is reconnected, within the attempts
    (F-149); two moves close together, with the middle person's write held
    mid-call, leave one event, at the last time, in the last person's
    calendar, with its id saved (F-150); a failed write into the new
    person's calendar still lets the old event be removed, and the write
    lands on its retry (F-169); a cancel right after booking, before the
    event's id is saved, still removes it; two of one booking's jobs never
    run at the same time; every existing Google test passes unchanged in
    what it checks. The full backend suite passes several runs in a row,
    and the API started by hand works a booking's calendar job.

## Files / areas

- `backend/lib/jobs/` (new): the job names and payload types, `enqueueJob`,
  the runner's start and stop, the test helper.
- `backend/server.ts`: start and stop.
- `backend/lib/booking/book-time.ts`, `cancel-booking.ts`, `move-booking.ts`:
  jobs added inside the transactions.
- `backend/lib/booking/booking-*-emails.ts`, `booking-event-*.ts`: the six
  trackers, removed.
- `backend/lib/email/send-and-record-emails.ts`, `send-booking-emails.ts`,
  `send-cancellation-emails.ts`, `send-move-emails.ts`: one email per job.
- `backend/lib/calendar/write-booking-event.ts`, `remove-booking-event.ts`,
  `move-booking-event.ts`: called by the jobs; the removal takes the person
  and event id it is given, and the move no longer removes anything.
- The 15 backend test files that wait with `settled()`.

## Data / contracts

- **A job**: a name, a payload of ids, when it may run, an optional queue
  name, attempts made and allowed, its last error (a reason, never the
  database's own message or a customer's details). Kept in the runner's own
  tables in the same database; the app's Drizzle schema and migration ledger
  are untouched.
- **Job names**: `booking_email` (`{ organizationId, bookingId, kind,
  sequence }`, kind as `BookingEmailKindType`), `booking_event_write`
  (`{ organizationId, bookingId, sequence }`), `booking_event_move`
  (`{ organizationId, bookingId, sequence }`), `booking_event_remove`
  (`{ organizationId, bookingId, personId, eventId }`, eventId the saved
  one, or the id the last write would have used when none is saved). The calendar ones run in the
  lane `booking-event-<last two characters of bookingId>` (decision 5); the names
  and payloads are settled in 8a.3's plan.
- **No new environment variable** for the API: the runner uses
  `DATABASE_URL`. `JOBS_SCHEMA` is set only by the tests (8a.2).
- **No route changes** and no change to any answer.

## Testing

Backend Vitest against the local database, as 7b: businesses of the test's
own, Google and Resend faked, nothing real sent. Tests run jobs with the
helper; the runner itself is never started in a test except by the runner's
own tests. Each test removes the jobs it made. The frontend is untouched.

## Notes for the AI

- The API's queries use `postgres` (postgres-js) through Drizzle; adding a job
  must use the caller's transaction, whatever driver the runner itself uses.
- Never put a customer's details, a token or a key in a job's payload, its
  stored error or a log line.
- The idempotency keys today: `booking-confirmation/<id>`,
  `booking-notification/<id>`, `booking-moved/<id>/<sequence>`,
  `booking-moved-notification/<id>/<sequence>` and the cancellation pair as
  7a made them. Keep every one.
- The Google ids: `calendarEventIdOf(id, sequence)`; a write that finds its id
  already there treats it as written (409), which makes a repeated write
  safe.
- F-153 (unverified, from 7b): a PATCH of an event deleted by hand may answer
  200. Not this feature's work; it stays in the ledger.
- At deploy (Frank, 2026-10-05): set `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=30`
  on the Railway backend service before the deploy that ships 8a (F-176):
  Railway's default gives an old API about 0 to 3 seconds after SIGTERM, so a
  job in flight is cut and then waits about 4 hours for its lock. Check the
  restart limit at the same time (F-179). Changing Railway is Frank's.
- `npm run db:migrate` builds a fresh database without the runner's tables;
  the API's start and the test helper install them.
- From building 8a.1, settled planning 8a.3: graphile-worker's documentation
  warns against queue names with many values (one per booking), so decision 5
  uses fixed lanes instead (256 since F-189), and no queue cleanup is needed.
- From building 8a.1, settled in 8a.2: backend test files run in parallel,
  and working the due jobs takes every due job with a known name. Each Vitest
  worker now keeps its jobs in a schema of its own (`JOBS_SCHEMA`, set only
  by `backend/vitest.setup.ts`; the API uses the library's), cleared before
  each file, so files still run side by side and never take each other's
  jobs or the dev API's. Running the files one at a time was tried first: the
  suite went from 13 to 107 seconds; with a schema per worker it takes 24.
- From building 8a.2: the jobs judge "has the appointment started" by
  `jobClock` (`backend/lib/jobs/job-clock.ts`); the tests pin it to Friday
  2026-10-02, since they book on the fixed Monday after. The setup reads only
  `DATABASE_URL` from the `.env`, never loading the rest: a test checks the
  API refusing to start without a setting.
- From building 8a.2: decision 3's rule covers the business's notification
  as well as Jane's confirmation: once the booking has moved (its sequence
  above 0) or been cancelled, neither goes; the move or cancel emails tell
  both. A failed send is now thrown, one line per failed try naming the job
  and its booking. After 8a.2's review (F-181), a move's emails are not sent
  once a later move replaced it: the later move's emails say the time that
  holds.
- After 8a.2's review (F-180): every backend test starts with no job waiting
  (`vitest.setup.ts` clears the worker's jobs after each test), and the
  tests' fetch can only reach this machine, whatever a file stubs or
  unstubs. A job is added with its payload cast through text, so it is
  stored as an object whichever Postgres driver adds it.
- From building 8a.3: within one run the library looks for its next job
  before the last job's end (which unlocks its lane) is written, so a job
  waiting behind another in its lane is left for the next run. The tests'
  helper runs again while any job of its list is due; in the API the runner
  takes it on its next poll, about 2 seconds later.
- From building 8a.3: six existing Google tests changed what they check,
  where the jobs change the facts: the two tests of a move
  to another person's write and removal are compared without their order.
  "A booking still confirmed keeps its event" now moves the booking to the
  same person and sees no removal, since the removal no longer reads the
  booking's status. The answer-does-not-wait tests now see Google asked only
  once the jobs are worked.
- After 8a.3's review (F-187): two more tests changed what they check. "An
  event never written gets written" now sees a removal and a write instead
  of an update and a write, and "an event found but never saved gets its id
  saved" became "an event written but never saved is replaced, never left
  behind". The move tests' fake Google now keeps each calendar's live
  events and takes a held write before answering, so tests check the events
  a calendar holds, not only the calls. After F-188, every test also starts
  with every lane in its worker's schema unlocked.
- On Windows a stop signal cannot be sent to a process, so the API's stop on SIGTERM is
  first seen on Railway; the runner's own stop is proved by the tests.

## Open questions

1. **Which runner?** Answered by Frank, 2026-10-04: graphile-worker
   (decision 9).
