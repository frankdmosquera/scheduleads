# Feature: A calendar on the site's own page

**From build-plan:** feature 13c

**Size:** heavy. Two separate risks with real logic: open days read on a site's server and kept a day, with a tapped day's times read live (dates, time zones, a day that filled since), and a time picked on the page handed into the booking window and the corner chat opened from the page.

**Branch:** `feature/13c-a-calendar-on-the-site-s-own-page`

**Status:** specced

## Goal

A visitor on Primo's home page sees the real month in the hero card, with his open days marked, taps a day and sees its free times right there, picks one and books: "Book now" opens the booking window straight on its form with that time already chosen, and "Ask us" opens the corner chat. The month is built into the page (fast, and Google reads the dates); only a tapped day's times are read live. Built once in the booking package, so any site can put it on a page.

## In scope

- **Open days on the site's server.** A server-only entry of the booking package reads a service's open days for this month and the next from Booking CRM's existing public routes, with the business's time zone, kept for a day by the site (Next `revalidate: 86400`), as the plan says ("built into the page once a day").
- **The page calendar.** A client component that draws that month (open days marked, today in the business's zone, past days never pickable), its arrows reading later months live, a tapped day's times read live and shown as buttons, a day that filled since the page was built said plainly with the next open day offered.
- **A time handed to the window.** `open(bookingId, startsAt)` opens the window on that service's form with the time chosen; a time taken meanwhile goes through the window's existing "taken" path.
- **Like a book on a computer, under on a phone.** On a wide screen the service's details sit beside the picked day's times; on a phone the times open under the month.
- **"Ask us" opens the chat.** The site chat package gains a way for a page to open it; the floating "Ask us" button stays.
- **Primo first.** His hero card becomes this calendar, in his blue, the same size as today's "Pick a day" card, a little bigger, larger on a big screen. On a branch off his `main`, in the worktree.
- **Live on Frank's yes** at the end of 13c.2.

## Out of scope

- A calendar on Face and Body's pages (any site can use it; she is not asked for here).
- A service picker inside the page calendar: a site names the one service it shows (Primo has one).
- Any change to Booking CRM's API or database: the calendar uses the existing public booking routes.
- ~~Booking on the page without the window: the form stays the window's.~~ Amended 2026-10-31 (Frank): the card books on the spot with the window's own form (13c.3); every other booking button on the site still opens the window.

## Build loop

Heavy: each step's plan gets Frank's yes, then runs straight through without stopping: build, its tests, tick the box, the build log entry, commit (not pushed: Frank, Oct 29, push once per feature), `/audit` scoped to the step, then an independent review. The one planned stop is after the review. Installing a package, touching a client's live site, Vercel or real data stops for his yes.

## Build steps

- [x] **13c.1 The real month on Primo's card.** The package's server read of open days (this month and the next, kept a day), the page calendar drawing them, a tapped day's times read live, `open(bookingId, startsAt)` in the window, and Primo's hero card using them, on his laptop site. **Done when:** on http://localhost:3403 the hero card shows this month with his open days dated and marked; the page's HTML holds those dates (view source); tapping an open day shows its times; picking one and "Book now" opens the window on his form with that time chosen, and booking there lands a lead on the laptop; a day emptied after the page was built says so and offers the next open day; the API unreachable at build time leaves today's card, still opening the window; the package's tests pass.
- [x] **13c.2 Beside, under, "Ask us", then live.** The wide layout (service details beside the times, like a book), the phone layout (times under the month), "Ask us" opening the corner chat, then both packages packed into his site and live on Frank's yes. **Done when:** on http://localhost:3403 at desktop width the details and times sit side by side, at phone width the times open under the month and nothing scrolls sideways; "Ask us" in the card opens the chat and the floating button still works; both packages' tests pass; on Frank's yes his site is merged and deployed and the card works on www.primopainters.ca.
- [x] **13c.3 The card books on the spot** (added 2026-10-31, Frank: a Book Now button defeated booking right there). Next on a picked time shows the window's own form in the card, Back to the times, a time taken meanwhile back on the day with the form and its key kept, then "You're booked" in the card and the site's onBooked and afterBooking as after the window. Primo drops Book Now (Ask us stays) and zooms: 16rem at rest on a phone, the screen less 1rem each side once a day opened (at most 32rem below a computer), days 16px; on a computer the book layout is 42rem. **Done when:** on http://localhost:3403 at 412px the card is 256px at rest and 380px once a day is tapped; a time shows the form in the card and Book makes a lead on the laptop and says booked in the card; at 1280px the card is 42rem with the form beside the month; the header's Book Now still opens the window; tests prove one send per Book, a taken time back on the day with the key kept, onBooked once.

## Files / areas

- `packages/booking-component/`: a new server entry beside `site-colours.ts` for the open days (exported in `package.json` like `./site-colours`); the page calendar under `booking-window/` reusing `month-calendar/` (month grid, names, bookable months, group times by day) and `api-client/fetch-free-times.ts`; `booking-provider/` and `use-booking.ts` for `open(bookingId, startsAt)`; the window starting on its form with a time; `booking-component.css`; tests beside the code; a new `version`.
- `packages/site-chat/`: a way for a page to open the chat (export from `index.ts`); a new `version`.
- Primo's repo (worktree off his `main`): `components/heros/HeroCalendarImage.tsx` and its server caller, `vendor/`.
- Read only: `backend/routes/public-booking-links-routes.ts` (the service and its times), the window's month layout under `booking-window/screens/month-layout/`.

## Data / contracts

- The open days come from `GET /public/:slug/booking-links` (the service by its slug, or the business's only one) and `GET /public/:slug/booking-links/:id/times?from&to&language` (31 dates at most per call), as the window reads them. The server read returns `{ timeZone, today (YYYY-MM-DD on the business's clock when built), horizonDays, service (the service as the route gives it), theme (its Look colours), months, openDays: string[] }` or `null` when anything fails; `null` keeps the site's own card.
- Called from a server component with `{ next: { revalidate: 86400 } }`; no Origin header, as `fetchSiteColours` already reads the public routes.
- `open(bookingId?: string, chosen?: { startsAt, date, time })`: the picked time as the times route gave it (the ISO instant, and its date and clock time on the business's clock, which the form shows). Without it the window opens as today. (Amended in 13c.1: the form needs the date and time words, not only the instant.)
- The page calendar books on the spot (13c.3, amended Oct 31) with the window's own form view, so the form, its checks and the request key are still the window's; a booking made there reaches the site through the provider's same onBooked and afterBooking (`reportBooked`, shared with the window). A site's Book button, if it gives one, still opens the window.
- Times shown in the business's zone with the zone's name, as the window shows them.

## Testing

- `npm run test --workspace=@frankdmosquera/booking-component`: the open-days read (two months split into calls of 31 dates or fewer, the business's zone, a failed read giving `null`, a named service missing), past days never pickable, the filled-since day, `open` with a time.
- `npm run test --workspace=@frankdmosquera/site-chat` for the opener.
- By hand on http://localhost:3403 for each Done when; view source for the dates; live only on Frank's yes.

## Notes for the AI

- His card today is deliberately abstract ("real dates would need date logic that can disagree between server and client, or they go stale"): the server's `readOn` and the business's zone decide today, so server and client draw the same month; the client only drops days that have passed since `readOn`.
- Reuse the window's month code; do not write a second calendar.
- His main checkout is on `design-pass-2` with his uncommitted work: never touch it; work in `primo-painters/.claude/worktrees/booking-crm` on a new branch off his `main`.
