# Fix: One card per service on Services

**Type:** Fix

**Size:** light - the same rearrangement People got on 2026-10-25, on the Services page: a
service's hours move into its card and save with its one Save; the saves and their rules already
exist and do not change.

**Status:** verified

**Branch:** fix/one-card-per-service-on-services

## The problem

Since feature 12k, each service on Settings, Services shows two boxes: its row (name, length,
Live or Hidden, Change) and, under it, a second row with its name again and "Runs whenever the
business is open", which opens its hours with a Save of its own. It is the shape People had
until the one-card fix merged this morning. Walking Riverbend Clinic (dev) on 2026-10-25, Frank
read it the same way ("cabinet consultation 45 minutes, change, like what the heck is that? And
then there is another runs whenever the business is open"), and asked for one box, as on People
(his yes, 2026-10-25).

- `frontend/components/settings/services-screen.tsx` (`hoursCardOf`, the row and the open form)
- `frontend/components/settings/service-form.tsx`, `service-hours-card.tsx`, `own-hours-card.tsx`
- `frontend/components/settings/person-hours-part.tsx` (the part People's card already uses)

## The fix

One box per service, closed or open, the way People works now:

- **The closed row** says it all in one place: name, length, Live or Hidden, when it runs ("Runs
  whenever the business is open", or "Runs on its own week · Mon, Tue", and any one-off dates),
  and the button. No second row under it.
- **Change opens the whole card**: name, length, live or hidden, who does it and where, and "When
  it runs" (whenever the business is open, or its own week, and its one-off dates). **One Save**
  saves all of it; **Cancel** drops what was not saved. Nothing has a Save of its own.
- **One Save, in order**: first the hours part checks its own form (a window that ends before it
  starts is caught here, before anything is saved), then the service itself (name, length, live),
  who does it, and its hours, each through its existing route. A refusal at any of them keeps the
  card open on its error, the parts before it stay saved (as now), and Cancel then says what was
  saved and lists what those saves left outside. Hours change only when edited. The card holds
  its own parts for the whole Save, so opening another service mid-Save cannot mix two cards (the
  lesson of F-511).
- **After the save**, the page says what happened in one notice and lists the upcoming bookings
  to call about: the ones a new length no longer fits and the ones new hours leave outside, each
  under its own title, until the next save.
- **A new service** gets no hours part: it runs whenever the business is open, and Change gives
  it its own hours afterwards (as a new person on People).
- **A member** (who may not change the business) gets "See" instead of "Change": the same card,
  every field read-only, no Save, "Close" instead of Cancel, so members still see when each
  service runs. The "Your role cannot change the services" line stays above the list.
- **One hours part for both pages**: People's hours part becomes the one both cards use, in each
  page's words, so the two never drift; the separate hours cards (`own-hours-card.tsx`,
  `service-hours-card.tsx`) have no reader left and go.
- New words in English and Spanish only where a page needs one it lacks ("See", "Close", the
  outside-its-hours title on the page).

It must not break: every save's own checks and refusals (a name taken, a length out of range,
nobody to do it while live, an hours window ending before it starts), the list of bookings a
new length no longer fits, People's card and its hours, and the Spanish screens.

## Build steps

- [x] 1. **One card per service.** The hours part joins the service's card and its one Save; the
  second row goes; the closed row carries the hours line; members get the card read-only.
  **Done when:** on http://localhost:3400/settings/services (Riverbend Clinic (dev), then Summit
  Painting (dev)) every service shows one box; changing Body Wrap's length and its own week in
  one open card and pressing Save saves both (read back after a reload), and Cancel drops both;
  an hours error (a window ending before it starts) keeps the card open on it and saves nothing;
  a booking a shorter week leaves outside is listed on the page; People's card still saves its
  hours; every new word reads in Spanish; builds, lint and every suite pass.

## Verify

Open Settings, Services. Each service is one box that says its length and when it runs. Press
Change on one service, give it its own week and a new length, press Save once: the row now shows
both. Open it again and Cancel after changing something: nothing changed. As a member, each
service has "See", which opens the card with nothing to change.
