# Feature: Texts

**From build-plan:** feature 12g

**Size:** heavy - two separate risks with real logic: the business's texts (a number that routes every customer's reply to one business, reminders that must reach bookings already made, a reply phone refused if it is any business's texting number), and each person's worker texts (a phone refused if it is any business's texting number, three switches with no default).

**Branch:** feature/12g-texts

**Status:** verified 2026-10-12: both steps built and reviewed, nine findings fixed and one carried; backend 991, shared 184 and booking component 83 tests pass, the frontend builds and lints. Then a final review of the whole feature.

## Goal

The owner sets the business's texts on Settings: whether the confirmation text goes, any number of
reminders each any number of minutes before, and where a customer's reply is passed on (a phone, an
email, or both); and, on People, each person's worker texts: their phone, and whether they hear when
a booking is added to their day, moved, or taken off it. Nothing is on by default. After this nobody
edits `text_settings` or `worker_text_settings` by hand or in a setup file to change any of it.

## In scope

- **The business's texts (12g.1)**: a Texts page, `/settings/texts`, in the section list after
  Booking form. It shows the texting number, the confirmation text on or off, the reminders (add one
  as a number of minutes, hours or days before, remove one), and where replies go (a phone, an
  email, or both, at least one). One Save writes the lot. Saving refuses a reply phone that is any
  business's texting number (8b, F-199), and a reply phone equal to its own number. A reminder added
  also reaches the upcoming bookings already made; one removed stops (see Notes). The yes to later
  texts stays on the Booking form page (12f).
- **The texting number** (Decided): the agency gives a business its number, with the business's
  first text choices, in its setup file; the owner sees the number and changes everything else. A
  business with no texts yet sees "Texts are not set up for your business yet" and nothing to save.
- **Each person's worker texts (12g.2)**: on People, each person (never a place) has a Texts part:
  off, or on with a phone and three yes/no choices (added to their day, moved, taken off), none
  picked until the owner picks. Turning texts off removes the person's row. Saving refuses a phone
  that is any business's texting number (8c, decision 6). Two people may share one phone.
- Read-only for a role that may not change the business, as 12a.

## Out of scope

- The words of the texts (fixed since 8b and 8c), and texts in other languages.
- Buying or moving a Twilio number, and anything on Twilio's side.
- What the business sends to a customer who said yes to later texts (a later feature).
- Worker texts for places, and texts to the owner other than as a reply destination.
- Showing which texts were sent (the lead timeline already lists them).

## Build loop

Approved one step at a time (AGENTS.md). Heavy: `workflow.stepReview` is `every`,
`checkpointCommits` enabled. After a step's plan has Frank's yes, nothing stops until the review:
build, tests and checks, tick the box, write the build log entry and commit it to buildlogs, commit
and push the step to `feature/12g-texts`, `/audit` scoped to the step, then the independent review.
The planned stop is after the review. Blocking findings (P0/P1) are fixed by default; P2/P3 are
recorded and carried. `/complete` makes the final pass and merges on Frank's yes.

## Build steps

- [x] **12g.1 The business's texts.** "Summit's owner turns the confirmation text off, adds a
  reminder 2 hours before and removes the 20-hour one, and sends replies to an email instead of a
  phone: the next booking gets no confirmation, tomorrow's booking already made gets the 2-hour
  reminder and not the 20-hour one, and a customer's reply arrives by email. A reply phone that is
  another business's texting number is refused."
  - Backend: `GET /settings/texts` (any member) answers `{ canEdit, texts }`, `texts` null when the
    business has none; `PUT /settings/texts` (`organization: ["update"]`) saves the confirmation,
    the reminders and the reply destination in one transaction under `lockBusinessResources`;
    `409 no_text_settings` when the business has none; `400` on the reply phone field when it is
    any business's texting number. Reminders added: for each upcoming confirmed booking, the
    reminder's job for the booking's current move, unless its moment has passed. Check in the build
    that a reminder is never sent twice for one booking, move and minutes (removed then added back
    while its first job is still queued); add the guard if the sending job lacks one.
  - Shared: the save's schema (the settings schema without the number and without the yes to later
    texts, which 12f owns); reminders kept in order, soonest last, no repeats, at most 10 (a
    reversible limit, so a page cannot grow without end). The setup
    file gains an optional `texts` block (the full text settings, number included), added only when
    the business has none, and listed as a difference after that.
  - Frontend: `app/(dashboard)/settings/texts/page.tsx`, "Texts" in the section list,
    `components/settings/texts-screen.tsx` and its form.
  **Done when:** the route tests below pass, and by hand on Summit the scene above shows on the page
  and in the database's queued jobs; Summit's texts are put back after.

- [x] **12g.2 Each person's worker texts.** "On Summit's People, Carlos's texts go on with his
  phone, yes to added and moved, no to taken off: a booking added to his day queues his text, a
  cancel does not. Marco's phone set to Summit's texting number is refused. Turning Carlos's texts
  off removes them."
  - Backend: the People read answers each person's `texts` (`{ phone, addedOn, movedOn, removedOn }`
    or null); `PUT /settings/people/:resourceId/texts` with the settings or `null` (off), a person
    of this business only (`404` otherwise, a place `400`), `400` on the phone field when it is any
    business's texting number.
  - Frontend: the Texts part of the person's form on People.
  **Done when:** the route tests below pass, and by hand on Summit the scene above works; Summit's
  people are put back after.

## Files / areas

- `frontend/app/(dashboard)/settings/texts/`, `frontend/components/settings/` (section list, the
  texts screen and form, the person's form), `frontend/lib/api-client/settings/`
- `backend/lib/settings/` (find and save the texts, the worker texts), `backend/lib/text/` (the
  texting-number check), `backend/lib/jobs/enqueue-booking-texts.ts` (reminders for bookings
  already made), `backend/routes/settings-routes.ts` and its test
- `packages/shared/zod-validation/text-validation-schemas/`, `packages/shared/client-setup/` and the
  setup schema, `packages/shared/scripts/seed-dev.ts`

## Data / contracts

All under the dashboard CORS, CSRF and no-store middleware and the `booking` module; reads for any
member, writes need `requirePermissionMiddleware({ organization: ["update"] })`. The business always
comes from the session; every query filters on it first. No migration: both tables exist (8b, 8c).

**`GET /settings/texts`** `200 { canEdit, texts }`: `texts` null, or `{ fromNumber, confirmationOn,
reminderMinutesBefore, replyPhone, replyEmail }`, numbers as stored (`+14035550148`).

**`PUT /settings/texts`** `{ confirmationOn, reminderMinutesBefore, replyPhone, replyEmail }`,
strict: reminders whole minutes, at least 1, no repeats, at most 10; a reply phone or an email or
both; phones typed any common way, stored as Twilio texts them. `200 { texts }` as the GET's.
`409 no_text_settings` without texts. `400 { error, field: "replyPhone" }` for a texting number.

**`PUT /settings/people/:resourceId/texts`** `{ texts: { phone, addedOn, movedOn, removedOn } | null }`
(amended at 12g.2: wrapped, so one strict schema reads both), every switch given. `200 { texts }`
(null when off). `404 not_found` for another business's or an unknown person, `400` for a place,
`400 { error, field: "texts.phone" }` for a texting number. The People read answers `workerTexts`,
`{ personId, phone, addedOn, movedOn, removedOn }[]`, a person not listed having none.

**User text**: phones and emails are rendered by React as text, never HTML.

## Testing

Commands: `npm run test --workspace=@scheduleads-app/shared`, `npm run test --workspace=backend`
(local Postgres, migrated and seeded), `npm run build` and `npm run lint` for the frontend.

One test per rule that would hurt if broken:

- 12g.1: a save keeps the choices; a reply phone that is another business's texting number, or its
  own, is refused and nothing saved; a business with no texts gets 409; a reminder added reaches an
  upcoming booking and not a past one, at the booking's current move; a reminder removed and added
  back sends once; a member without the permission cannot save.
- 12g.2: a person's texts save and turn off; a phone that is any business's texting number is
  refused; another business's person is 404 and a place 400; a member without the permission
  cannot save.

## Notes for the AI

- 12a's and 12f's patterns: client components through `dashboardApiClient`; each error under its
  field with `aria-describedby`; a refused save focuses the first bad field; saved and failed
  messages announced and cleared on the next edit. No TanStack Query (feature 14).
- Nothing pre-filled where the business must choose (decision 30): a person's three switches start
  unpicked; a new reminder's minutes are typed.
- Decided while planning, named so Frank can overrule: a reminder added on Settings also reaches
  upcoming bookings already made (an owner who adds "the evening before" expects tomorrow's
  customers to get it); a removed one stops, as the sending job already re-reads the settings.
- Comments beside the line they explain, one or two lines, no step or finding numbers.

## Decided

- Who sets a business's texting number (Frank, 2026-10-12, at 12g's plan): the agency gives it, with the
  business's first text choices from intake, in the setup file; the owner sees it and changes
  everything else. It is how a customer's reply finds its business, so an owner could otherwise claim
  a number meant for another business and get its replies.

## Implementation walkthrough

Feature 12g was specced heavy with two steps, one per real risk, and kept them: the business's
texts (12g.1, `c1f8281`, review fixes `a4c3038`) and each person's worker texts (12g.2,
`6835829`, review fixes `5bc67a6`). Each step had a fresh independent review; a final review of
the whole feature at `f8391f2` passed, closed nine findings, and left three P3s open (F-404 to
F-406) beside F-396, carried. Frank decided at the plan that the agency gives each business its
texting number, with its first text choices, in the setup file; the owner changes the rest.

### the business's texts (`backend/lib/settings/`, `routes/settings-routes.ts`)

`find-texts-settings.ts` answers the Texts page: the texting number and the choices, or null
before the agency sets texts up. `save-texts.ts` saves the confirmation, the reminders and where
replies go under `lockBusinessResources`; `409 no_text_settings` without texts; a reply phone that
is any business's texting number, its own included, is refused on its field. A reminder added
reaches every upcoming confirmed booking at its current move unless its moment has passed; one
removed stops because each reminder job re-reads the settings when it runs. The owner's save
cannot carry the number: the choices schema is strict.

### reminders (`backend/lib/jobs/`)

`enqueue-booking-reminders.ts` is the one place a reminder job is added, for a booking, a move
or a save, keyed by booking, move and minutes, so a reminder removed and added back while its job
waits is queued once (graphile's job key replaces a waiting job). `enqueue-jobs.ts` adds them all
in one SQL call (F-397). Jobs queued before 12g.1 carry no key; only local dev databases can hold
them, since production has never run.

### each person's worker texts

The People read answers `workerTexts` and `textsSetUp`; `save-worker-texts.ts` saves a person's
phone and three choices, or removes them when turned off, for a person of this business only (404
otherwise, 400 for a place), refusing a phone that is any business's texting number. On People
the texts are a part of the person's card (`person-texts-part.tsx`), saved by the card's one Save
before the person (F-400); every missing piece is marked at once (F-401); "Gets texts" shows only
when a text can actually go, and the part says when none can (F-402).

### shared and setup

`textChoicesValidationSchema` is the owner's save (strict, at most 10 reminders, no repeats, kept
earliest first however given, F-398); the setup file's `textSettingsValidationSchema` is built from
it plus the number and the yes to later texts. A setup file adds texts only when the business has
none and lists a difference after that, and refuses a number or a reply phone already a business's
texting number, and a worker's phone that is a texting number either way round (F-403).

### frontend

Settings > Texts after Booking form: the number shown, the confirmation, reminders listed as
"20 hours before" with Remove and an add row where Enter adds (F-394), the reply phone and email;
read-only for a role that may not change the business. The reminders list is a labelled group
that takes the focus on its error, and adding the tenth moves focus to its own Remove (F-395).

### tests

Route tests cover the Texts save (choices kept, number never, reply phone refusals, no texts yet,
reach to bookings already made at the current move and never past a passed moment, sent once,
another business untouched, permission) and the worker texts (save, change, off, refusals, 404,
400, 403, textsSetUp). Unit tests cover the choices schema; the setup tests cover the texts block
and the worker-phone refusals. Each new rule's test was seen failing against the broken code. At
the end: backend 991, shared 184, booking component 83, and the frontend builds and lints; the
frontend has no test runner, so the pages were checked by hand on Summit and Summit was put back.

### Carried

F-396 (P3): a booking made or moved while a save adds a reminder can miss it (with F-331, F-348).
F-404 (P3): no test covers a reminder queued at booking time being removed and added back.
F-405 (P3): the People read gives every member each worker's phone; Frank's call.
F-406 (P3): the retry limit is copied into `enqueue-jobs.ts` instead of shared.

## Findings

### 12g/F-394 [P2] closed - Enter in the new reminder's box saves the page, and a reminder typed but not added is dropped while "Saved the texts." shows

**File:** frontend/components/settings/texts-form.tsx:147, 216-245, 271
**Found:** 2026-10-12 by independent review of step 12g.1 (scope: 3cb0d0b..c1f8281; lenses: quality, security, performance, tests)
**Why it matters:** The new reminder's number box sits inside the form, whose only submit button is "Save texts"; "+ Add a reminder" is `type="button"`. An owner who types 2, leaves "hours before" and presses Enter (the usual way to add a typed value) triggers the browser's implicit submission: `save` runs with `reminders` as they were, the 2 stays in the box unadded, and the page says "Saved the texts.". The same happens when he types a reminder and clicks Save without pressing "+ Add". Either way he reads a success for a reminder that was never saved, so his customers never get it, which is the one thing the page is for.
**Suggested fix:** Handle Enter in the count box as Add (`onKeyDown` with `event.key === "Enter"`: `preventDefault()` then `addReminder()`), and have `save` refuse while the box holds an unadded value, with the error under the box ("Add this reminder or clear the box") and focus on it.
**Resolution:** Fixed 2026-10-12: Enter in the reminder's number box adds the reminder and never submits the page; Save with a reminder typed but not added is refused with "Add this reminder, or clear it, before saving." under the box, focused, and nothing is saved. Checked in the browser on /settings/texts (no frontend test runner). Closed 2026-10-12 by /audit independent (scope: current; lenses: quality, security, performance, tests): the number box's Enter adds the reminder (onKeyDown, preventDefault) and save() refuses while the box holds an unadded value, with the error under the box and focus on it; no new defect seen.

### 12g/F-395 [P3] closed - The reminders' own error is tied to no field, and adding the tenth reminder drops focus to the page

**File:** frontend/components/settings/texts-form.tsx:105-108, 208-211, 243
**Found:** 2026-10-12 by independent review of step 12g.1 (scope: 3cb0d0b..c1f8281; lenses: quality, security, performance, tests)
**Why it matters:** A refusal on `reminderMinutesBefore` (reachable: 9999999 days passes the page's own check but is past int32, so the API answers "Give each reminder in whole minutes.") is drawn as a bare `<p>` with no id, no `aria-describedby` and nothing marked `aria-invalid`, so `focusFirstInvalid` finds nothing, focus stays on Save and a screen reader hears nothing; the spec's Notes ask for each error under its field, described by it, and the first bad field focused. Separately, adding the tenth reminder hides the whole add row (`reminders.length < TEXT_REMINDERS_MAX`) while focus is on its "+ Add a reminder" button, so focus falls to the document body, where `removeReminder` takes care to move it.
**Suggested fix:** Give the reminders' error an id, tie it to the count box (`aria-describedby`, `aria-invalid`) or to a focusable list heading, and refuse a count past the int32 limit on the page; when the tenth is added, move focus to its Remove button (the same `focusNext` path) and say "At most 10 reminders." where the row was.
**Resolution:** Fixed 2026-10-12: the reminders list is a labelled group whose error has an id and `aria-describedby`; a refused list moves focus to the group. A reminder past the most a reminder can hold is refused on the page ("That is too far ahead."). Adding the tenth reminder moves focus to its own Remove. Checked in the browser. Closed 2026-10-12 by /audit independent (scope: current; lenses: quality, security, performance, tests): the reminders list is a labelled, focusable group with its error id and aria-describedby, a refused list focuses it, a count past the int32 limit is refused on the page, and the tenth reminder moves focus to its own Remove; no new defect seen.

### 12g/F-397 [P3] closed - A reminder added queues one job per upcoming booking, one SQL call at a time, inside the save's locked transaction

**File:** backend/lib/settings/save-texts.ts:43-60; backend/lib/jobs/enqueue-job.ts:26-36
**Found:** 2026-10-12 by independent review of step 12g.1 (scope: 3cb0d0b..c1f8281; lenses: quality, security, performance, tests)
**Why it matters:** The save reads every confirmed booking from now to the end of the horizon, with no limit, then awaits one `add_job` call per booking and per added reminder, in sequence, while holding the business row lock that every other Settings save of that business waits on. A clinic shaped like Riverbend (six practitioners, a 60-day horizon) can hold a few thousand upcoming bookings; adding two reminders is then several thousand round trips to Railway's Postgres in one request. Unverified: no timing taken; local tests use a handful of bookings.
**Suggested fix:** Queue them in one statement: `add_jobs` with an array of job specs built from the upcoming rows, or `select add_job(...) from booking where ...` with the payload, run_at and key computed in SQL, keeping the past-moment filter in the where clause.
**Resolution:** Fixed 2026-10-12: `enqueueBookingReminders` queues every reminder of a save, or of a booking, in one SQL call (`enqueueJobs`, `add_job` over `json_to_recordset`), keys and the passed-moment rule unchanged; one save reaching two bookings with two reminders is tested. Closed 2026-10-12 by /audit independent (scope: current; lenses: quality, security, performance, tests): enqueueBookingReminders builds every reminder first and enqueueJobs adds them in one add_job over json_to_recordset, parameterised, keys and the passed-moment rule unchanged; the route tests' queued jobs confirm it; no new defect seen.

### 12g/F-398 [P3] closed - A setup file's reminders are stored in the file's order, so the page lists them out of order and a later run lists a false difference

**File:** packages/shared/client-setup/apply-business-shape.ts:171; packages/shared/client-setup/run-client-setup.ts:138-150; backend/lib/settings/find-texts-settings.ts:13
**Found:** 2026-10-12 by independent review of step 12g.1 (scope: 3cb0d0b..c1f8281; lenses: quality, security, performance, tests)
**Why it matters:** saveTexts stores reminders the earliest first, and TextsSettingsType says that is what the page gets, but the setup file's `texts` block is inserted as written. A file with `reminderMinutesBefore: [60, 1200]` shows "1 hour before" above "20 hours before" on the Texts page until the owner saves; and once he saves, even with no change, the stored list becomes `[1200, 60]`, so every later run of the same file lists "texts: saved ..., file ..." as a difference when nothing differs, which is noise in the one list the agency reads to see what the owner changed.
**Suggested fix:** Sort the reminders once in the shared schema (a `.transform` on reminderMinutesBefore in textChoicesValidationSchema, the earliest first), so the setup file, the seed and the save all store and compare the same order; saveTexts' own sort can then go.
**Resolution:** Fixed 2026-10-12: `textChoicesValidationSchema` keeps the reminders the earliest first, however given, so a setup file and a page save store the same list and a later run finds no difference. Tested in text-choices-validation-schema.test.ts. Closed 2026-10-12 by /audit independent (scope: current; lenses: quality, security, performance, tests): textChoicesValidationSchema sorts the reminders the earliest first and textSettingsValidationSchema spreads it, so the setup file, the seed (parsed through the schema) and the page store one order; no new defect seen.

### 12g/F-399 [P3] closed - No test fails if a Texts save reaches another business's settings or bookings

**File:** backend/routes/settings-routes.test.ts:1209-1341 ("the Texts settings"); backend/lib/settings/save-texts.ts:39-52
**Found:** 2026-10-12 by independent review of step 12g.1 (scope: 3cb0d0b..c1f8281; lenses: quality, security, performance, tests)
**Why it matters:** The suite sets up texts for two businesses, `booked` and `other`, but never reads `other` after `booked` saves, and never makes a booking for `other`. Dropping `eq(textSettings.organizationId, organizationId)` from the update would rewrite every business's confirmation, reminders and reply destination (the saves still pass the table's checks), and dropping `eq(booking.organizationId, ...)` from the upcoming query would queue reminders for every business's bookings; no test in this suite would fail for either (another file might, only by chance, through the seeded rows it shares). The business-from-the-session rule is the one that hurts most if broken.
**Suggested fix:** In the save test, assert `textsOf(other)` is unchanged after `booked`'s saves; in the reminder test, make one upcoming booking for `other` and assert it gets no job.
**Resolution:** Fixed 2026-10-12: settings-routes.test.ts "a save changes only its own business" checks another business's texts unchanged and another business's upcoming booking gets no reminder; seen failing with either business filter removed. Closed 2026-10-12 by /audit independent (scope: current; lenses: quality, security, performance, tests): settings-routes.test.ts "a save changes only its own business" asserts the other business's texts unchanged and its upcoming booking queued nothing; no new defect seen.

### 12g/F-400 [P2] closed - Saving or cancelling the person's form closes the card and drops the texts typed below it without a word

**File:** frontend/components/settings/people-screen.tsx:74, 126, 129; frontend/components/settings/person-texts-form.tsx:146
**Found:** 2026-10-12 by independent review of step 12g.2 (scope: a4c3038..6835829; lenses: quality, security, performance, tests)
**Why it matters:** The open card holds two forms: the person's form (its filled "Save" and "Cancel") and, under it, the texts form (an outline "Save texts"). The person form's Save calls `saved`, which calls `close`, and its Cancel calls `close`; either sets `open` to null, so PersonTextsForm unmounts and its unsaved state (On, the phone, the three picks) is thrown away. An owner who turns Carlos's texts on, types his phone, picks the three choices and then presses the card's main Save (the filled one, the first he meets) reads "Saved. Carlos (painter) is on." while his texts were never sent to the API, so Carlos gets no texts. The spec calls it "the Texts part of the person's form", which is what an owner sees; nothing tells him it has a Save of its own. Same kind of loss as F-394 on the Texts page.
**Suggested fix:** Lift a "texts changed, not saved" flag from PersonTextsForm (an `onDirtyChange` callback) and have the person form's Save and Cancel refuse while it is set, with the message under the texts form ("Save these texts, or turn them back, first.") and focus on Save texts; or move the texts form out of the Change card into its own "Texts" button and card, so each card has one Save.
**Resolution:** Fixed 2026-10-12: a person's texts are a part of their card on People, saved by the card's one Save: the texts first, then the person; a refused part stays open with its error focused and nothing more is saved; Cancel drops both. Checked in the browser (no frontend test runner). Closed 2026-10-12 by /audit independent (scope: current; lenses: quality, security, performance, tests): the texts are a part of the person's card, saved by the card's one Save through beforeSave before the person; a refused part keeps the card open with focus on the first invalid piece; no separate Save remains to be missed; no new defect seen.

### 12g/F-401 [P3] closed - A save with the choices left unpicked names only the first, so seeing what is missing takes up to four saves

**File:** frontend/components/settings/person-texts-form.tsx:55-77; backend/routes/settings-routes.ts:67-76
**Found:** 2026-10-12 by independent review of step 12g.2 (scope: a4c3038..6835829; lenses: quality, security, performance, tests)
**Why it matters:** The form sends unpicked choices to the API on purpose, and `refuseFirstIssue` answers only `error.issues[0]`. A probe of `saveWorkerTextsValidationSchema` with `{ texts: { phone: "" } }` gives four issues (texts.phone, texts.addedOn, texts.movedOn, texts.removedOn), so an owner who turns texts on and presses Save sees the phone error alone, then "Pick yes or no." under the first choice, then the second, then the third: four round trips for one form. The 12a and 12d forms beside it (change-resource-form.tsx, person-hours-card.tsx) check every field on the page with the shared schema through zodResolver and show all errors at once, so this form drifts from the pattern the spec's Notes name.
**Suggested fix:** Before sending, run `saveWorkerTextsValidationSchema.safeParse` on the page and set one error per issue (the path without `texts.`), then focus the first; keep the API's answer for what only the server knows (the texting number). Or use react-hook-form with zodResolver as the person form does.
**Resolution:** Fixed 2026-10-12: the texts part marks every missing piece at once on the page ("Enter their phone.", "Pick yes or no." on each unpicked choice) before anything is sent, focus on the first. Checked in the browser. Closed 2026-10-12 by /audit independent (scope: current; lenses: quality, security, performance, tests): PersonTextsPart marks the phone and every unpicked choice at once before sending and focuses the first; the API still answers the texting-number refusal; no new defect seen.

### 12g/F-402 [P3] closed - "Gets texts" and "Saved. ... gets texts." show when no text can go: the business has no texting number, or all three choices are No

**File:** frontend/components/settings/people-screen.tsx:156; frontend/components/settings/person-texts-form.tsx:67; backend/lib/text/send-worker-text.ts:149, 168; backend/lib/settings/save-worker-texts.ts:34-53
**Found:** 2026-10-12 by independent review of step 12g.2 (scope: a4c3038..6835829; lenses: quality, security, performance, tests)
**Why it matters:** The People list shows "Gets texts" for any person with a worker_text_settings row, and a save says "Saved. Carlos gets texts." whenever the answer is not null. But a worker text needs the business's own texting number: `sendWorkerText` stops with "the business has no text settings" (line 168), and saveWorkerTexts never looks at text_settings. In a business like the seeded Riverbend (no texts), the owner can turn a person's texts on, is told they get texts, and no text is ever sent; the Texts page of the same business says "Texts are not set up for your business yet". Likewise "On" with all three choices No saves a row, shows "Gets texts", and every job stops at "the person has that text off" (line 149). The owner reads a promise the product does not keep.
**Suggested fix:** Have the People read say whether the business has texts (`textsSetUp: boolean`), and on the person's texts form say "Texts are not set up for your business yet, so none will go" when it has none (saving may still be allowed, so the row is ready); show "Gets texts" and "gets texts" only when texts are set up and at least one choice is yes, and say "Texts on, all three off" otherwise.
**Resolution:** Fixed 2026-10-12: the People read answers `textsSetUp`; "Gets texts" shows only when the business has a texting number and at least one choice is yes; the texts part says "The business has no texting number yet, so no texts go until the agency sets one up." and, when every choice is No, "Every choice is No, so no texts go." Route test: "the page says whether the business has a texting number". Closed 2026-10-12 by /audit independent (scope: current; lenses: quality, security, performance, tests): the People read answers textsSetUp; textsCanGo shows "Gets texts" only with a texting number and at least one yes, and the part says when no text can go; no new defect seen.

### 12g/F-403 [P3] closed - The setup file never checks a worker's phone against the texting numbers, so the People refusal holds in one direction only

**File:** packages/shared/client-setup/apply-business-shape.ts:119-126, 159-170; backend/lib/settings/save-worker-texts.ts:46-48
**Found:** 2026-10-12 by independent review of step 12g.2 (scope: a4c3038..6835829; lenses: quality, security, performance, tests)
**Why it matters:** The People save refuses a phone that is any business's texting number by reading text_settings outside any shared lock. The other two ways the pair can meet are not checked: a setup file giving a business its `texts` checks the new number only against other businesses' `fromNumber`, never against `worker_text_settings.phone`; and a setup file's `workerTexts.phone` is inserted with no texting-number check at all. Either order (and a People save racing a setup run) leaves a person whose phone is a texting number. No text leaks, because sendWorkerText checks `findTextingBusiness` again before sending (line 170), but that person silently gets nothing while the page shows "Gets texts". Reachable only when a number is mistyped or reused, so P3.
**Suggested fix:** In apply-business-shape.ts, refuse a `texts.fromNumber` that any worker_text_settings row holds, and a person's `workerTexts.phone` that any text_settings row holds, with the same error style as the existing check; one setup test for each. The send-time check stays as the last guard for a race.
**Resolution:** Fixed 2026-10-12: a setup file refuses a worker's phone that is any business's texting number or its own file's, and a texting number that is already a worker's phone. Tested in run-client-setup.test.ts. The People page's check and the send-time check stay as they were. Closed 2026-10-12 by /audit independent (scope: current; lenses: quality, security, performance, tests): applyBusinessShape refuses a worker's phone that is the file's texting number or any stored one, and a texting number already a worker's phone, before writing; run-client-setup.test.ts covers all three; no new defect seen.

## Independent review

**Status:** passed
**Target commit:** f8391f250bb1814907f452d0116cbd17b8b3fd10
**Base commit:** 3cb0d0b26cd75f6bf13d4e955b14f18d3d6cdfc3
**Base ref:** main
**Spec hash:** be6a83e44233a12532bc4ace2ea084ca829a899f3732d5ea0d92ccda020eb17d
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-12T17:44:56Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-12T17:50:00Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `3cb0d0b26cd75f6bf13d4e955b14f18d3d6cdfc3..f8391f250bb1814907f452d0116cbd17b8b3fd10` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain`: pass (target, merge base and spec hash match; only review.md differs, plus the owner's untracked draft)
- `npm run test --workspace=@scheduleads-app/shared`: pass (25 files, 184 tests)
- `npm run test --workspace=backend`: pass (88 files, 991 tests, local scheduleads_dev)
- `npm run test --workspace=@frankdmosquera/booking-component`: pass (83 tests)
- `npm run lint --workspace=frontend`: pass
- `npx tsc --noEmit -p .` in `frontend`: pass
- `npm run build --workspace=frontend`: unavailable (not run: dev servers may hold 3400/3401 and the skill does not require it)

### Evidence

- Whole delta read: 32 files, backend settings routes and libs, the jobs batch enqueue, shared schemas and client setup, frontend Texts page, People texts part and api clients.
- Every write route is behind requirePermissionMiddleware(organization: update); the business comes from the session and every query filters on it; PUT /people/:resourceId/texts checks the person in this business (text ids, unknown id is 404) and refuses a place.
- enqueueJobs passes the batch as one parameterised JSON value; reminder job keys are booking, move and minutes, and a reminder whose moment has passed is never queued, so a replaced job is never one already running.
- Reply phone and worker phone are refused against any texting number at save, at setup, and again at send (pass-on-reply.ts:122, send-worker-text.ts:170).
- Route tests cover 409, the texting-number refusals (own and another's), the cross-business isolation, the passed-moment and current-move rules, and the 403 for a member.
- Fixed findings re-examined and closed: F-394, F-395, F-397, F-398, F-399, F-400, F-401, F-402, F-403. F-396 left unverified (carried by Frank with F-331 and F-348; its shape still holds).

### Findings

- F-404 [P3] open: no test covers a reminder queued at booking time being removed and re-added (job key at booking time untested)
- F-405 [P3] open: the People read gives every member each worker's personal phone
- F-406 [P3] open: the retry limit is duplicated in enqueue-job.ts and enqueue-jobs.ts
- No P0 or P1 open or fixed

### Remaining risk

- `npm run build --workspace=frontend` not run; the frontend was type-checked with `tsc --noEmit` and linted instead.
- No browser run by this reviewer: the frontend fixes (F-394, F-395, F-400, F-401, F-402) were closed on code reading; the frontend has no test runner.
- Check not run (not required).
- `blueprint/ai-voice-proposal.md` is untracked in the working tree: the owner's private draft, not part of the target and not reviewed.
- F-396 (a booking made or moved during a save can miss an added reminder) remains as carried.
- The dashboard activity file was not written: this reviewer was limited to findings.md and review.md.
