# Fix: Busy label on the Calendar

**Type:** Fix

**Size:** light - one label in two languages; proved by the frontend build, lint and the Calendar's
week view.

**Status:** verified

**Branch:** fix/busy-label

## The problem

Frank's look-around note 4 (2026-10-25): the Calendar's Day and Week views show a person's time
taken in their connected calendar as "Busy in Google" ("Ocupado en Google"), in each block, its
hover text and the legend. The label should not name Google: the time may be taken somewhere
else (another calendar later), and the person reading it only needs to know the time is not free.
The event's own title stays hidden on purpose: reading titles needs a wider Google scope and would
show private events to whoever opens the calendar. Frank's yes, 2026-10-26.

- `frontend/lib/dashboard-words/schedule-words.ts`
- `frontend/components/schedule/schedule-time-grid.tsx`, `schedule-screen.tsx`

## The fix

The word `busyInGoogle` becomes `busy`: "Busy" in English, "Ocupado" in Spanish, in the block, its
hover text and the legend. Left as they are, on purpose: the page's lede and the "Google could not
be read" warning, which describe where the busy times come from, and the API's refusal message
("busy in Google"), which says why a time cannot be booked.

## Build steps

- [x] 1. **Busy.** **Done when:** the frontend build and lint pass, and on
  http://localhost:3400/calendar a person with a connected calendar shows "Busy" blocks and a
  "Busy" legend in the Week view, with no console errors.

## Verify

On app.booking-crm.com, open the Calendar's Week view for a person with Google connected: their
taken times read "Busy".

## Implementation walkthrough

One step, as the spec planned (light), and one review round that passed with nothing found.

### frontend/lib/dashboard-words/schedule-words.ts

The word `busyInGoogle` becomes `busy`: "Busy" in English, "Ocupado" in Spanish. Both lists are
typed by `ScheduleWordsType`, so a missing or leftover key fails the build.

### frontend/components/schedule/schedule-time-grid.tsx and schedule-screen.tsx

The time grid, which draws the Day and Week views, uses the word for each block's text and its
hover text; the screen uses it for the legend. The Month view never draws busy blocks, so it has
no label to change; its legend still shows the Busy swatch, as before.

### left as they are

The page's lede and the "Google could not be read" warning say where the busy times come from,
and the API's refusal message ("busy in Google") says why a time cannot be booked; Google is the
only source today. When a second calendar source arrives, those three get the same rewording.

### checked

On http://localhost:3400/calendar, signed in as the dev admin, Summit Painting (dev)'s connected
calendar showed 10 blocks in the week of Oct 26, each "Busy", and in Español each "Ocupado"; the
legend read Booking, Time off, Busy (Reserva, No disponible, Ocupado).

## Findings

None: the independent review found nothing, and no carried finding was resolved here.

## Independent review

**Status:** passed
**Target commit:** 259d124a60dc08a93357755f84cbb7490f261a77
**Base commit:** 75eb5a37ad34eb13f4e7f3ffbdaa07072189f90d
**Base ref:** main
**Spec hash:** 5ff89c552e93ed7f645cea2df4692b34c7227b20089bfaa13de4e3b97e581c02
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-26T14:49:46Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-26T14:51:54Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `git rev-parse HEAD`, `git merge-base HEAD main`, `sha256sum blueprint/context/current-feature.md`, `git status --short`: pass (HEAD, base and spec hash match the request; only `review.md` differs from the target)
- `npm run build --workspace=frontend`: pass
- `npm run lint --workspace=frontend`: pass
- `npm run format:check`: pass
- `npm run test --workspace=@scheduleads-app/shared`: pass (32 files, 214 tests, including the Spanish messages completeness test)

### Evidence

- Delta 75eb5a3..259d124 touches four files: the spec, `frontend/lib/dashboard-words/schedule-words.ts` (type key `busyInGoogle` to `busy`, English "Busy", Spanish "Ocupado"), `frontend/components/schedule/schedule-time-grid.tsx` (block text and its `title` hover text) and `frontend/components/schedule/schedule-screen.tsx` (legend).
- `git grep -i -E "busyInGoogle|busy in google|ocupado en google"` at the target outside `blueprint/` finds only the API refusal in `backend/routes/schedule-routes.ts:205` and its Spanish entry in `packages/shared/helpers/spanish-messages.ts:157-158`, both left on purpose by the spec; no code reads the old key.
- Every place a `google_busy` item is labelled is covered: the time grid (Day and Week share `ScheduleTimeGrid`) block and hover text, and the one legend under every view. The Month grid filters `google_busy` out (`schedule-month-grid.tsx:50`) and never labels it.
- `englishScheduleWords` and `spanishScheduleWords` are both annotated `ScheduleWordsType`, so a missing or leftover key fails the build; the build passed.
- The lede and the `googleUnreadable` warning name Google as the source of the busy times and the refusal names it as the reason; Google is today the only source, so leaving them matches the spec's stated reason (the block label is what should not name a source).
- Security and performance: a text-only change with no data, route, auth or rendering-cost change. Tests: no logic added, so no new test is owed under the light size; the build's type check is the guard for the word lists.

### Findings

- None

### Remaining risk

- The legend (including the "Busy" swatch) shows under the Month view too, which never draws busy blocks; this predates the delta, which only changed the word.
- The spec's Done when browser walk (http://localhost:3400/calendar, Week view, a connected person) was not repeated here: Check was not required and no dev servers were running.
- When a second calendar source arrives, the lede, the "Google could not be read" warning and the API refusal ("busy in Google") will need the same rewording.
