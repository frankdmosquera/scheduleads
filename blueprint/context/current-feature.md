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
