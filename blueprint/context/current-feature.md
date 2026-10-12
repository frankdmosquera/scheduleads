# Feature: Calendar pick

**From build-plan:** feature 12h

**Size:** light - one piece of logic (which of a person's Google calendars count as busy); the rest is wiring: one more Google permission, one column, and the calendar card moved onto Settings.

**Branch:** feature/12h-calendar-pick

**Status:** verified 2026-10-12: 12h.1 built, shared 188 and backend 1010 tests pass, the frontend builds and lints; the check against a real Google calendar moved to 10b (Amendments). Then the final review of the whole feature.

## Goal

A person connects their Google calendar from Settings, and picks which of their Google calendars
count as busy. Today only the main one is read (feature 3), so an appointment kept in a second
calendar ("Work", "Family") is offered to customers as free. After this, every ticked calendar
blocks the booking window, and the pick is theirs.

## In scope

- **Calendar page**: `/settings/calendar`, "Calendar" last in the Settings section list. It holds
  the connection card as it is today (Connect, Disconnect, Reconnect, the outcome line), moved off
  the dashboard home, and under it, once connected, the list of the person's Google calendars, each
  a tick box, with one Save. Google sends the browser back to this page after a connect.
- **Your own calendar only**, as today: any member with a person on the business connects and picks
  for themselves; the business and the person always come from the session.
- **The permission**: the consent asks for `calendar.calendarlist.readonly` with the two it asks
  today. A new connect needs all three, or ends as `missing_permission`, its words changed to
  "leave every box ticked". A connection made before this has two: it keeps working on the main
  calendar, and the page says "Reconnect to choose which calendars count".
- **What counts**: the busy read asks Google for every ticked calendar in one call. Any ticked
  calendar Google cannot read makes the person's times unreadable, as one unreadable calendar does
  today (never read as free). None ticked reads nothing from Google.
- **The pick's life**: a new connection starts with the main calendar ticked (Decisions, 1). A
  reconnect with the same Google account keeps the pick; with another account it starts again at
  the main one. Disconnect deletes it with the connection.
- **A ticked calendar that left the account** (deleted, or unsubscribed at Google) shows on the list
  as "no longer in your Google account", ticked, so the owner can untick it and save.

## Out of scope

- Writing bookings into any calendar but the main one (unchanged since 5d).
- An owner picking for another person; other providers (Microsoft, Apple).
- The in-app calendars (12b) and opening hours for the public.
- Google's app verification for production (every calendar permission needs it; 10b).

## Build loop

Light: one step, one plan yes. After the yes it runs straight through: build, tests and checks,
tick the box, write the build log entry and commit it to buildlogs, commit and push to
`feature/12h-calendar-pick`, report. No step review; the review comes once, at `/complete`, which
merges on Frank's yes.

## Build steps

- [x] **12h.1 Calendar pick.** "Summit's admin opens Settings, Calendar, connects Google, ticks
  'Work' as well as the main calendar and saves: an event in 'Work' tomorrow at 10:00 disappears
  from Summit's booking window. Unticking it brings 10:00 back. Disconnecting removes the pick."
  - Shared: migration adding `busyCalendarIds text[] not null default '{primary}'` to
    `calendar_connection` (existing rows keep reading the main calendar); the save's schema.
  - Backend: the third scope and the renamed scope check; the seam gains `listCalendars` and
    `findBusyBlocks` takes the ids; `getBusyTimes` passes the connection's pick; the save keeps or
    resets the pick by account; two routes (Contracts); the callback lands on `/settings/calendar`.
  - Frontend: the Calendar page and section entry, the card moved from the dashboard home, the
    pick list with its Save.
  - Check in the build whether Google shows the new permission for the OAuth client as it is; if
    it refuses, the scope is added to the client's Data Access in Google Cloud, which is Frank's.

  **Done when:** the tests below pass, the frontend builds and lints, and by hand on localhost the
  scene above works with Frank's own Google account (he presses Connect and passes Google's
  consent; the event is read with `calendar:check`).

## Files / areas

- `packages/shared/db/booking-tables/calendar-connection-table.ts`, a new migration,
  `packages/shared/zod-validation/` (the save's schema), `packages/shared/calendar/`
- `backend/lib/calendar/` (`google-oauth-client.ts`, `calendar-provider.ts`,
  `google-calendar-provider.ts`, `get-busy-times.ts`, `get-fresh-access-token.ts`,
  `save-calendar-connection.ts`, `finish-google-connect.ts`, a new `list-calendars` and
  `save-busy-calendars`), `backend/routes/calendar-routes.ts` and its test
- `frontend/app/(dashboard)/settings/calendar/page.tsx`, `frontend/components/settings/`
  (section list, the calendar screen), `frontend/components/calendar/calendar-connection-card.tsx`,
  `frontend/components/dashboard/dashboard-home-screen.tsx`, `frontend/lib/api-client/calendar/`

## Data / contracts

Both routes sit beside `/calendar/connection`, under the same dashboard CORS, CSRF, no-store and
`booking` module middleware; any member, own person only (`409 no_person` otherwise, as today).

**`GET /calendar/calendars`** `200 { calendars: { id, name, isMain, counts }[], missing: string[] }`:
Google's calendar list, the main one first with id `primary`, `counts` true when ticked; `missing`
the ticked ids no longer on the list. `409 no_connection`; `409 reconnect_needed` when the
connection needs reconnecting or lacks the list permission; `503 calendar_unreachable` when Google
does not answer. Names are rendered by React as text.

**`PUT /calendar/busy-calendars`** `{ calendarIds: string[] }`, strict: no repeats, at most 50
(Google's free/busy limit), each id 1 to 1024 characters. Every id must be on the person's Google
list as read at the save, or already ticked (so a calendar that left can stay until unticked):
`400 { error, field: "calendarIds" }` otherwise. `200` with the GET's answer. Same 409s and 503.

**Stored**: `calendar_connection.busyCalendarIds`, Google's ids, the main calendar as `primary`.
Reset to `{primary}` when a reconnect brings another Google account.

## Testing

`npm run test --workspace=@scheduleads-app/shared`, `npm run test --workspace=backend` (local
Postgres, migrated and seeded), `npm run build` and `npm run lint` for the frontend. One test per
rule that would hurt if broken:

- the busy read asks for every ticked calendar and joins their times; one unreadable calendar
  throws; none ticked asks Google nothing
- the consent asks for the three permissions; a connect without the list permission is
  `missing_permission` and saves nothing
- a reconnect with the same account keeps the pick, with another account starts at `primary`
- the list marks ticked and missing calendars; the save refuses an id not on the list and keeps a
  missing one already ticked; one person's save never touches another's connection
- the schema refuses repeats and more than 50

## Decisions (made while planning, Frank's to overrule)

1. **A new connection starts with the main calendar ticked.** Connecting has meant "read my main
   calendar" since feature 3; starting with nothing would let customers book over the person's
   appointments from the moment they connect.
2. **One unreadable ticked calendar makes the person unreadable**, never free: a picked person shows
   "try again", "any available" leaves them out, as today.
3. **None ticked is allowed** (the client decides): the page says that then nothing in Google stops
   a customer booking. Bookings still go into the main calendar.
4. **Another Google account starts again at the main calendar**; its old ids mean nothing there.

## Notes for the AI

- 12g's patterns for the page: a client component through `dashboardApiClient`, each error under its
  field, read-only nothing (every member edits their own).
- The card's `?calendar=` outcome handling moves with it unchanged.
- `calendar:check` follows the pick through `getBusyTimes`; no change there.

## Amendments

- **2026-10-12, 12h.1's Done when:** the check by hand with Frank's own Google account could not
  run: Google's OAuth client still lists only the old `localhost:3001` callback, because the Oct 3
  port move never reached Google, so Connect ends in `redirect_uri_mismatch`. Frank decided not to
  go to Google Cloud for it now: the new address, the list permission and this check go into 10b's
  one trip to Google Cloud. The step stands on its saved tests (Google faked) and the page checked
  on localhost without a connection.
