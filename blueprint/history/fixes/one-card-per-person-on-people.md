# Fix: One card per person on People

**Type:** Fix

**Size:** light - one screen rearranged: a person's hours move into their card and save with its
one Save; the saves and their rules already exist and do not change.

**Status:** verified

**Branch:** fix/one-card-per-person-on-people

## The problem

Since feature 12k, each person on Settings, People shows two boxes: their row (name, on or off,
what customers book them for, Change) and, under it, a second row with their name again and
"Bookable whenever the business is open", which opens their hours with a Save of its own (the
F-500 fix, so a card's Save never dropped hours not yet saved). Walking Summit Painting (dev) on
2026-10-25, Frank read the second row as a second card and found it confusing: one person, two
boxes, two Saves. He wants one card per person (his yes, 2026-10-25). Services' "Runs" row has
the same shape but stays as it is: Frank is not sure about it yet.

- `frontend/components/settings/people-screen.tsx` (`hoursCardOf`, the row and the open card)
- `frontend/components/settings/person-hours-card.tsx`, `own-hours-card.tsx`

## The fix

One box per person, closed or open:

- **The closed row** says it all in one place: name, On or Off, "Booked by customers for: ..."
  (or "Not booked by customers"), when they are bookable ("Bookable whenever the business is
  open", or "Own bookable hours · Mon, Tue", and any one-off dates), "Gets texts", and the
  button. No second row under it.
- **Change opens the whole card**: name, work email, on or off, "What they can do", "Bookable
  hours" (whenever the business is open, or their own week, and "+ A day that's different"),
  texts. **One Save** saves all of it; **Cancel** drops all of it. Nothing is ever saved or
  dropped on its own.
- **One Save, in order**: first every part checks its own form (an hours window that ends
  before it starts is caught here, before anything is saved), then what they can do, their
  texts, their hours, and the card itself (name, email, on or off), each through its existing
  route. A refusal from the server at any of them keeps the card open on its error, as skills
  and texts do today (the parts before it stay saved, as now). Hours change only when edited.
- **After the save**, the page says what happened in one notice, and lists the upcoming bookings
  the new hours leave outside (as the hours card did), above the list, until the next save.
- **A member** (who may not change the business) gets "See" instead of "Change": the same card,
  every field read-only, no Save, "Close" instead of Cancel. So members still see each person's
  hours (F-499).
- **An off person** shows no hours part, as today: their hours cannot change until they are on.
  Before the business has hours, "Set the business's hours on Hours first" stays once above the
  list.
- The hours editor (the week and one-off dates) is shared with the Services page's "Runs" card,
  so the two never drift; the Runs card keeps working as it does now.
- New words in English and Spanish ("Bookable hours", "See", "Close", the outside-hours title on
  the page).

It must not break: every save's own checks and refusals (12k's skills rule, the work email, the
last person on, an hours window that ends before it starts), the outside-hours list, the Services
page's Runs card, and the Spanish screens.

## Build steps

- [x] 1. **One card per person.** The hours part joins the person's card and its one Save; the
  second row goes; the closed row carries the hours line; members get the card read-only.
  **Done when:** on http://localhost:3400/settings/people (Summit Painting (dev), then Riverbend
  Clinic (dev)) every person shows one box; changing Carlos's skills and his own week in one
  open card and pressing Save saves both (read back after a reload), and Cancel drops both; an
  hours error (a window ending before it starts) keeps the card open on it and saves nothing
  else; a booking left outside new hours is listed on the page; the Services page's Runs card
  still saves; every new word reads in Spanish; builds, lint and every suite pass.

## Verify

Open Settings, People. Each person is one box that says what they do and when they are bookable.
Press Change on one person, tick a service and give them their own week, press Save once: the row
now shows both. Open it again and Cancel after changing something: nothing changed. As a member,
each person has "See", which opens the card with nothing to change.

## Implementation walkthrough

One step, as the spec planned (light), then three review rounds. Frank asked for it on
2026-10-25 while walking Summit Painting (dev) right after feature 12k merged: each person showed
their row and, under it, a second row for their hours with a Save of its own.

### frontend/components/settings: the person's card

`people-screen.tsx` draws one box per person. The closed row says on or off, what customers book
them for, when they are bookable (`ownHoursLine`: "Bookable whenever the business is open", or
"Own bookable hours" with its days and any one-off dates) and "Gets texts"; the second row
(`hoursCardOf`) is gone. Change opens `change-resource-form.tsx`, which now holds three parts
beside its own fields: what they can do, `person-hours-part.tsx` (new) and `person-texts-part.tsx`.
Each part exposes a handle through `forwardRef`; the card's one Save calls `beforeSave`, which
first runs `check()` on the hours and texts parts (F-506), so a window ending before it starts or
texts with no phone stop the Save before anything is sent, then saves skills, texts and hours in
turn through their existing routes, then the card itself. A refusal keeps the card open on its
error; the parts before it stay saved. An off person gets no hours part, as before.

### frontend/components/settings: the hours editor, shared

`own-hours-fields.tsx` (new) holds the week and one-off dates fields and `useOwnHoursWatch`, used
by the person's hours part and by `own-hours-card.tsx`, the Services page's "Runs" card, so the
two never drift. `person-hours-card.tsx` is removed. What bit: react-hook-form keeps `isDirty`
current only when it is read while the screen draws, so the hours part reads it in render; read
only inside Save, it stayed false and hours never saved. After an ok save the part resets its
form to the saved hours (F-504), so "edited" is measured from what the server holds.

### frontend/components/settings: what the page says after a save

The hours save's answer (the upcoming bookings the new hours leave outside) is parked in
`nowOutside` until the card closes. `hoursSaved` merges each answer by booking id, so a second
hours save in the same card never drops the first one's bookings (F-510). Every way the card
ends says it: `saved()` after a full save, and `reportUnfinished()` when a refused card is left by
Cancel (F-505) or by opening another person's card or Add (F-509), with the nobody-offers line in
the same notice. The list sits above the people, under "Bookings now outside <name>'s hours".

### frontend/lib/dashboard-words

`people-words.ts` gains "Bookable hours", "See", "Close", the outside-hours title and notice in
English and Spanish (one booking reads "se muestra abajo", F-507). `hours-words.ts` loses the two
words only the removed card read (F-508).

### not changed

No backend, shared or API change: every save keeps its own route, checks and refusals. A member
gets "See": the same card inside a disabled fieldset, no Save, Close. Services' "Runs" row keeps
its own Save; Frank has not decided on it.

### carried

F-511 (P3, unverified): clicking another person's Change while a Save is still between two parts
can hand the rest of the first card's chain to the new card's parts. Stays in the ledger.

## Findings

### one-card-per-person-on-people/F-504 [P2] closed - A person's hours part keeps its first values as the baseline after its save, so a later Save in the same open card can skip a change

**File:** frontend/components/settings/person-hours-part.tsx:44, 48, 57-70
**Found:** 2026-10-25 by /audit independent current (scope: a2efedb..e2c0f72; lenses: quality, security, performance, tests)
**Why it matters:** The part decides "edited" from react-hook-form's `isDirty`, measured against `defaultValues`, and never calls `form.reset` after `savePersonHours` succeeds. Its two siblings compare against their props, which `onSaved` updates (person-skills-part.tsx `unchanged`, person-texts-part.tsx `unchanged`). So when the hours save in the chain and the card itself is then refused (a taken work email, the last person on), the card stays open with the hours part still measuring from the values it opened with. If the owner then puts the hours back the way they were, `isDirty` reads false, `save()` returns true without sending, the card saves and closes, and the closed row shows the hours that were saved a moment earlier, not the ones the card showed at Save. Reasoned from the code path; not run in a browser (no login available to this reviewer).
**Suggested fix:** On an ok save, `form.reset({ weeklyHours, dateHours })` with the saved values (as `OwnHoursCard.saveHours` does), so the baseline follows what the server holds.
**Resolution:** Fixed 2026-10-25 in 9dedc67: person-hours-part.tsx resets its form to the saved hours as soon as they save, so "edited" then compares with what is stored. Checked on http://localhost:3400/settings/people: Mei given her own week with a work email at gmail.com; the hours saved, the card was refused on the email; set back to whenever open and saved again, the hours were saved back (read from the API), not skipped.
Closed 2026-10-25 by /audit independent current (round 2, a2efedb..9dedc67): `form.reset({ weeklyHours, dateHours })` runs inside the ok branch (person-hours-part.tsx:70) before `onSaved`, so `isDirty` is measured from what the server holds. react-hook-form 7.88.0's `handleSubmit` (dist/index.esm.mjs:3231-3236) only sets isSubmitted, isSubmitting, isSubmitSuccessful, submitCount and errors after `onValid`, so it never undoes the reset. Same pattern as OwnHoursCard.saveHours (own-hours-card.tsx:75). No new defect from the repair.

### one-card-per-person-on-people/F-505 [P2] closed - Hours saved in the chain, then the card refused and cancelled: the bookings the new hours leave outside are never listed

**File:** frontend/components/settings/people-screen.tsx:145, 151-155, 224
**Found:** 2026-10-25 by /audit independent current (scope: a2efedb..e2c0f72; lenses: quality, security, performance, tests)
**Why it matters:** `hoursSaved` only parks the outside list in `nowOutside`; it reaches the page in `saved()`, after the card itself saves. If the card is refused after the hours were saved (the spec keeps earlier parts saved) and the owner presses Cancel, `close()` never reads `nowOutside`, and the next `openForm` clears it. The hours are changed on the server, but the list of customers whose bookings now sit outside them, which the old hours card always showed right after its save and which the spec keeps ("lists the upcoming bookings the new hours leave outside"), is lost with no notice. Reasoned from the code path; not run in a browser.
**Suggested fix:** On Cancel (and on opening another card), flush a non-empty `nowOutside` into `held` with its title, or list it as soon as `hoursSaved` runs.
**Resolution:** Fixed 2026-10-25 in 9dedc67: Cancel now goes through `cancelled()` in people-screen.tsx, which lists the bookings the saved hours left outside and says which services nobody offers now, as a full save does.
Closed 2026-10-25 by /audit independent current (round 2, a2efedb..9dedc67): the card's Cancel calls `cancelled(resource)` (people-screen.tsx:246), which reads `nowOutside` and `nobodyOn` before clearing them, puts a non-empty outside list in `held` under `outsideHoursOf` with the business's zone, and says it and any nobody-offers line in one info notice (:160-177). For a member's Close, or a Cancel with nothing saved, both refs are empty and nothing is said. The Cancel case this finding describes is gone. Leaving the card by opening another one is a separate path, recorded as F-509.

### one-card-per-person-on-people/F-506 [P3] closed - The texts part's own checks run only after what they can do is already saved, though the spec says every part checks before anything is saved

**File:** frontend/components/settings/people-screen.tsx:151-155; frontend/components/settings/person-texts-part.tsx (`save`, the missing-phone and pick-yes-or-no checks)
**Found:** 2026-10-25 by /audit independent current (scope: a2efedb..e2c0f72; lenses: quality, security, performance, tests)
**Why it matters:** The spec's One Save reads "first every part checks its own form ... before anything is saved". `beforeSave` calls `check()` on the hours part only; the texts part has local checks (no phone, a choice not picked) that run inside its `save()`, after `skillsPart.save()` has sent. Ticking a service and turning texts on without a phone saves the service, then stops on the phone. The ordering is the one from before this fix and the outcome matches "the parts before it stay saved", so the harm is small, but the code and the spec's line disagree.
**Suggested fix:** Give the texts part a `check()` running the same local checks and call it with the hours check before any save, or narrow the spec's line to the hours check.
**Resolution:** Fixed 2026-10-25 in 9dedc67: person-texts-part.tsx has a `check()` (the missing phone or choice), and the card runs the hours and texts checks before skills or anything else is sent.
Closed 2026-10-25 by /audit independent current (round 2, a2efedb..9dedc67): `beforeSave` (people-screen.tsx:151-156) now runs `hoursPart.check()` then `textsPart.check()` before `skillsPart.save()`, and the card's own fields are validated earlier still by its `handleSubmit` (change-resource-form.tsx:93). `check()` (person-texts-part.tsx:79-89) holds the same rules the old inline block did and passes for an unchanged or off part; `save()` reruns it, which is harmless. Off and unchanged texts are not checked, as before. No new defect.

### one-card-per-person-on-people/F-507 [P3] closed - The Spanish notice for one booking now outside their hours mixes singular and plural

**File:** frontend/lib/dashboard-words/people-words.ts:148-149
**Found:** 2026-10-25 by /audit independent current (scope: a2efedb..e2c0f72; lenses: quality, security, performance, tests)
**Why it matters:** For a count of one it reads "Una reserva queda fuera de su horario; se muestran abajo.": one booking, then "se muestran" (plural). An owner reading the Spanish screen sees a grammar slip on a new word this fix adds.
**Suggested fix:** Use "se muestra abajo" for one and "se muestran abajo" for more, as the English line already does with "sits" and "sit".
**Resolution:** Fixed 2026-10-25 in 9dedc67: one booking reads "Una reserva queda fuera de su horario; se muestra abajo."
Closed 2026-10-25 by /audit independent current (round 2, a2efedb..9dedc67): people-words.ts:148-149 gives "se muestra abajo" for one and "se muestran abajo" for more; the leading space the saved notice needs is kept, and `cancelled()` trims it.

### one-card-per-person-on-people/F-508 [P3] closed - Two hours words lost their last reader with the person hours card and are left in both languages

**File:** frontend/lib/dashboard-words/hours-words.ts:44, 54, 116, 131, 192, 207
**Found:** 2026-10-25 by /audit independent current (scope: a2efedb..e2c0f72; lenses: quality, security, performance, tests)
**Why it matters:** `hoursWords.savePersonHours` and `hoursWords.savedPersonHours` were read only by the deleted person-hours-card.tsx; a search of `frontend/components`, `lib` and `app` finds no other reader (the `savePersonHours` matches left are the API call of the same name). Dead words in the type and in English and Spanish.
**Suggested fix:** Remove both from `HoursWordsType` and the two word lists.
**Resolution:** Fixed 2026-10-25 in 9dedc67: savePersonHours and savedPersonHours removed from hours-words.ts, type and both languages.
Closed 2026-10-25 by /audit independent current (round 2, a2efedb..9dedc67): both are gone from `HoursWordsType` and the English and Spanish lists; `grep savePersonHours|savedPersonHours` over frontend finds only the API call of that name (person-hours-part.tsx:20, 67; lib/api-client/settings/save-person-hours.ts:16). The frontend build type-checks.

### one-card-per-person-on-people/F-509 [P2] closed - Hours saved in the chain, then the card refused and another card opened: the bookings the new hours leave outside are never listed

**File:** frontend/components/settings/people-screen.tsx:142-147, 224, 309
**Found:** 2026-10-25 by /audit independent current (round 2, scope: a2efedb..9dedc67; lenses: quality, security, performance, tests)
**Why it matters:** F-505's repair lists the parked outside list on Cancel, but Cancel is not the only way out of a refused card. While a card is open, every other person's row still shows its Change button (:299-312) and the Add button stays on the page (:222-227); both call `openForm`, which empties `nowOutside` and `nobodyOn` (:144-145) without reading them, and the refused card unmounts. So: Carlos given his own week (the hours save answers with two bookings now outside), his work email refused on the same Save, then the owner presses Change on Mei. Carlos's hours are changed on the server and the two customers are never listed or mentioned, the same loss F-505 described. The nobody-offers notice from a skills save is lost the same way (that half predates this fix: base a2efedb's `openForm` already cleared `nobodyOn`). Reasoned from the code path; not run in a browser (no login available to this reviewer).
**Suggested fix:** Have `openForm` flush what the open card parked the way `cancelled()` does (one helper both call), or list the outside bookings as soon as `hoursSaved` runs instead of parking them until the card closes.
**Resolution:** Fixed 2026-10-25: opening another card goes through `reportUnfinished()` in people-screen.tsx, as Cancel does, so the bookings the saved hours left outside and the nobody-offers line are said before the other card opens. Checked on http://localhost:3400/settings/people: a test booking for Mei on Wed Oct 28 at 10:00, her Wednesday closed and a gmail work email; the hours saved, the card was refused; opening Ana's card listed it under "Bookings now outside Mei's hours" with the notice. Mei put back, the test booking cancelled.
Closed 2026-10-25 by /audit independent current (round 3, a2efedb..7cb575c): `openForm` (people-screen.tsx:147-152) finds the card being left in `people` by `open` and calls `reportUnfinished` (:166-183), the same helper Cancel now uses (:184-187), which reads and empties `nowOutside` and `nobodyOn`, holds a non-empty outside list under that person's name with the business's zone, and says both in one info notice; the earlier notice is cleared only when it said nothing. Both ways out of a refused card (another row's Change, and Add, which shows while a person's card is open, :224-238) go through it. Leaving the Add form or nothing open finds no person and only clears the notice, as before; the refs are empty then, because every path that ends a card (`saved`, `reportUnfinished`) empties them. A member's See and Close never save, so they say nothing. No new defect from the repair; a race when another card is opened while the Save is still running is recorded separately as F-511.

### one-card-per-person-on-people/F-510 [P3] closed - A second hours save in the same open card replaces the first save's outside list, so bookings the first save left outside drop off it

**File:** frontend/components/settings/people-screen.tsx:86-93; backend/lib/settings/save-person-hours.ts:90-100
**Found:** 2026-10-25 by /audit independent current (round 2, scope: a2efedb..9dedc67; lenses: quality, security, performance, tests)
**Why it matters:** `outsideHours` is only the bookings that were inside the stored hours and are outside the new ones (`outsideHoursOf(before, after, ...)`, with `before` the row the save replaced). `hoursSaved` overwrites `nowOutside.current` with each answer. When the hours save and the card is then refused (the case F-504 repaired), the part now starts from the saved hours, so if the owner edits the hours again before the next Save, the second answer compares against the first save's hours: a Tuesday booking the first save put outside is already outside, is not in the second list, and the page never lists it. Needs a refusal and then a second hours edit in the same open card, so narrower than F-505 or F-509. `nobodyOn` behaves the same way across two skills saves (predates this fix). Reasoned from the code path; not run in a browser.
**Suggested fix:** Merge each answer into `nowOutside` by booking id rather than replacing it (a booking a later save brings back inside would then still be listed; drop those by asking the API, or accept the extra line), and the same for `nobodyOn`; or leave it and note it in the spec.
**Resolution:** Fixed 2026-10-25: `hoursSaved` adds a later save's outside bookings to the earlier ones (each booking once, by id) instead of replacing them.
Closed 2026-10-25 by /audit independent current (round 3, a2efedb..7cb575c): `hoursSaved` (people-screen.tsx:86-98) keeps what is parked and appends only bookings whose `bookingId` is not already in it, reading the ref at call time, so no stale closure. The list is emptied by `saved` and `reportUnfinished` only, so it spans exactly one open card. The count in the notice (`nowOutsideHours(outside.length)`) and the held list read the same merged array. The trade the suggested fix named is taken, not said in the code comment or spec: a booking the first save put outside and a second save in the same card brings back inside stays listed as outside (one extra line to call about, never a missing one). The `nobodyOn` half named in the finding is unchanged (`skillsSaved` still replaces it, :76-79); it predates this fix and needs the same refusal-then-second-edit path, so it stays a note, not a reopen.

## Independent review

**Status:** passed
**Target commit:** 7cb575c4d25853e5cd3d56dbbf1edff0e939f720
**Base commit:** a2efedb5c2e9f417cfcead1b840d27fb49a5224c
**Base ref:** main
**Spec hash:** 4a02260034b72dbb385bfc86810fbe791ef9f29298780aa41b601fe6b455dfc3
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-25T14:18:18Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-25T14:22:29Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `npm run test --workspace=@scheduleads-app/shared`: pass (32 files, 214 tests)
- `npm run test --workspace=backend`: pass (95 files, 1098 tests, local scheduleads_dev)
- `npm run test --workspace=@frankdmosquera/booking-component`: pass (18 files, 98 tests)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass (type-checks the frontend; /settings/people builds)
- `npm run lint --workspace=frontend`: pass
- `npm run format:check`: pass

### Evidence

- Freshness: HEAD equals the target, `git merge-base main HEAD` equals the base, the spec's SHA-256 matches, and only `review.md` and `findings.md` differ from the target.
- Whole delta read (10 files): people-screen.tsx, change-resource-form.tsx, own-hours-fields.tsx, own-hours-card.tsx, person-hours-part.tsx, person-texts-part.tsx, the removed person-hours-card.tsx, hours-words.ts, people-words.ts, and the spec. No backend, shared or API change, so no new trust boundary; members still get the card inside a disabled fieldset with no Save, and every save still goes through its existing server route and checks.
- F-509: `openForm` (people-screen.tsx:147-152) now reports what a refused card parked through `reportUnfinished` (:166-183), shared with Cancel (:184-187); closed.
- F-510: `hoursSaved` (:86-98) merges by `bookingId` for one open card; closed, with the extra-line trade and the unchanged `nobodyOn` half recorded in its Resolution.
- The removed card has no reader left (`grep PersonHoursCard|person-hours-card` over frontend finds none); the Services page's Runs card still renders through `OwnHoursCard` and the shared `OwnHoursFields` (service-hours-card.tsx:9, 30).

### Findings

- F-509 [P2] closed
- F-510 [P3] closed
- F-511 [P3] unverified (new): opening another card while a Save is still running hands the rest of the first card's chain to the new card's parts
- No open or fixed P0 or P1

### Remaining risk

- Nothing was run in a browser: this reviewer has no login, so F-509, F-510 and F-511 are judged from the code path; the builder's own browser check of F-509 is recorded in its Resolution.
- The frontend has no test script, so the page's merge and report logic in people-screen.tsx has no automated test; the suites above cover the server rules it calls, not this screen.
