# Feature: A calendar on the site's own page

**From build-plan:** feature 13c

**Size:** heavy. Two separate risks with real logic: open days read on a site's server and kept a day, with a tapped day's times read live (dates, time zones, a day that filled since), and a time picked on the page handed into the booking window and the corner chat opened from the page.

**Branch:** `feature/13c-a-calendar-on-the-site-s-own-page`

**Status:** verified

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
- In the browser the card reads the next three days once (`times?from=today&to=today+2`) and greys a built-in open day there with no time left (its hours over, or the business's notice); amended Oct 31 (Frank), one read per visit beside the tapped day's.
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

## Implementation walkthrough

**What the spec's top lines miss.** The spec was written for two steps where the window still took the booking. Step 13c.3, added on Frank's word on Oct 31, made the card book on the spot, and a long run of his look-and-feel rounds followed on the same day: read this walkthrough and the 13c.3 entry in the build log as the record. Window 0.2.13 grew to 0.2.38 and the site chat to 0.2.14 along the way.

**13c.1 The real month on Primo's card.** `packages/booking-component/page-calendar/fetch-page-calendar.ts` is a second server entry (`@frankdmosquera/booking-component/page-calendar`, never marked client): it reads a service's open days for this month and the next from the existing public routes, in calls of at most 31 dates, on the business's clock, with the site's own caching (Primo: `revalidate: 86400`), and answers null on any failure so the site keeps its own card. `page-calendar.tsx` draws that month from the page with no call, reads later months live (`useMonthTimes`), and reads a tapped day's times live. `open-days-shown.ts` decides when a built-in month must be read live after all (a page old enough to hide newly bookable days, F-603). The window gained `open(bookingId, { startsAt, date, time })` to open on its form with a picked time.

**13c.2 Like a book, under on a phone, Ask us.** From 768px the open card is a two-page spread (month left, day right, columns as shares so the month never squashes while the card eases wider, F-605); below that the times open under the month. `openSiteChat()` in the chat package opens the corner chat by a page event, so neither package imports the other; Escape returns focus to whatever opened it. The chat panel follows the phone's visible area above the keyboard. The card names itself with `useId`.

**13c.3 The card books on the spot.** Next on a picked time shows the window's own `BookingFormView` inside the card (same checks, request key and send lock), then "You're booked" there. The window's after-booking code moved into `booking-provider/report-booked.ts`, which the provider hands the card as `booked`, so a site's `onBooked` and thank-you redirect run once either way. While a send is on its way or unknown the month is `inert` (F-607); each booking gets a new form and key, a late business read is dropped, and the form names the time zone (F-608). If the business cannot be read at Next, the window opens on the same time.

**Frank's rounds on Oct 31 (all in 13c.3).** On a phone the card is 16rem at rest and grows halfway between 19rem and the screen once a day is tapped (Primo's classes, `sa-pagecal--grown` keeps it through the month arrows); the service line and the day's name stay out of sight under the month until the form (still read out); the times are slimmer, their list 200px; a tapped day's times scroll into view when below the screen; the month arrows are bold drawn chevrons; days 3px apart, grown rows a little shorter than wide. When the page opens, the card reads the next three days once and greys any open day there with no time left (Primo's notice had emptied Saturday after hours), moving on to the next month if that empties it; Next open day and Next month are small links under the line that says why. Primo's card has no buttons: Ask our AI is a pill beside his phone number under it, and the corner chat button is a 56px pill that keeps its words on phones (both sites). His Google badge is drawn from his 5-star rating instead of a picture that said 4.9.

**Proof.** Booking window 154 tests, site chat 221, the dashboard's build; Primo's and Face and Body's builds. On the laptop at 412px, 780px-tall and 1280px: the sizes above, a booking made in the card, the header's Book Now still opening the window. Live on www.primopainters.ca: Saturday Oct 31 grey after hours and the card opening on November; every round pushed on Frank's word.

**Reviewed.** A fresh reviewer per step (13c.1, 13c.2, 13c.3), then two independent reviews of the whole feature (the second after Frank's last round): both passed. Carried P3s: F-604, F-606, F-609, F-610, F-611, F-612.

## Findings

### 13c/F-603 [P2] closed - 13c.1 review: a built-in month could hide bookable days, and an empty month showed nothing

**File:** packages/booking-component/page-calendar/page-calendar.tsx, open-days-shown.ts, fetch-page-calendar.ts
**Found:** 2026-10-31 by independent review of 13c.1 (56af531, Primo 4654569)
**Why it matters:** (1) a month built into the page was never read live, so a page a day or more old hid the days that became bookable since (with a short horizon, a whole month could show closed); (2) a month with no open day showed only disabled days, and a business with none in both months got a dead card instead of the site's own; (3) no test proved the picked time reached the form, or that a page built on an earlier day hydrates without a mismatch.
**Suggested fix:** read a built-in month live once the build's reach falls short of today's; say "No times left in" the month with Next month; answer null with no open day; the two tests.
**Resolution:** Fixed 2026-10-31 in window 0.2.14: `monthIsBuiltIn`, the card opening on its first month with an open day, the empty-month line, null for no open day; tests for each, the form showing "10:00 a.m., Tuesday, November 3", and a page drawn on Nov 1 taken over on Nov 3 with no console error. Also from the review's P3s: Primo's card names his service (`free-estimate`), the import check's dots escaped. 142 tests. Needs a later /audit to close.
Closed 2026-10-31 by /audit independent current (fresh subagent, d51de3f..2cdb9db): `monthIsBuiltIn` (open-days-shown.ts:123-134) reads a month live once the build's reach falls short; the card opens on its first open day's month (page-calendar.tsx:89-91); the empty month says so with Next month (page-calendar.tsx:246-260); no open day answers null (fetch-page-calendar.ts:87); the hydration and picked-time tests exist and pass (153 tests). No new defect from the repair.

### 13c/F-605 [P2] closed - 13c.2 review: the month squashed while the card widens on a computer

**File:** packages/booking-component/booking-component.css
**Found:** 2026-10-31 by independent review of 13c.2 (8f6fdfd..0f2dd66, Primo to 5cf8c85)
**Why it matters:** when a day opens at 768px and wider, the grid switched on at once while the card eased from the site's width to 36rem; the day column took its fixed 15rem first, so the month started at 0px and its title and arrows spilled over the times for that 0.2s (measured on Primo: 0, 112, 288px).
**Suggested fix:** columns as shares, so both shrink together.
**Resolution:** Fixed 2026-10-31 in window 0.2.20: `minmax(0, 1.2fr) minmax(0, 1fr)`, the same 288px | 240px once wide; the month now starts at 131px. 145 tests. Needs a later /audit to close.
Closed 2026-10-31 by /audit independent current (fresh subagent, d51de3f..2cdb9db): booking-component.css keeps `minmax(0, 1.2fr) minmax(0, 1fr)` for the open card at 768px and wider, now at 42rem; no fixed day column remains. Checked in code only, not measured in a browser.

### 13c/F-607 [P1] closed - 13c.3 review: the month stayed clickable while a booking was on its way

**File:** packages/booking-component/page-calendar/page-calendar.tsx
**Found:** 2026-10-31 by independent review of 13c.3 (bf8e9df, Primo 92af715)
**Why it matters:** on a computer the month sits beside the form; a day or arrow pressed while Book was sending or its answer unknown unmounted the form, dropping its send lock while the form and its key stayed, so the same key could go out for another time (refused as used) after the first booking was already made unseen, and a late 409 pulled the visitor back to the old day.
**Suggested fix:** nothing else in the card can be picked while the form is frozen.
**Resolution:** Fixed 2026-10-31 in window 0.2.28: the month is `inert` and its day and month handlers do nothing while frozen; a site's Book button is disabled meanwhile. A test holds a send open and taps another day: the form stays, one send; it fails without the lock. Needs a later /audit to close.
Closed 2026-10-31 by /audit independent current (fresh subagent, d51de3f..2cdb9db): the month is `inert={frozen}` (page-calendar.tsx:288), `pickDateNow` and `changeMonthNow` do nothing while frozen (214-219), the site's Book is disabled (419), Back is hidden while frozen (316); the form view clears the freeze before `onBooked` and `onTimeTaken` (booking-form-view.tsx:128-137), so the lock never outlives a settled answer. The lock test passes. No new defect from the repair.

### 13c/F-608 [P2] closed - 13c.3 review: second booking, a late business read, the zone name

**File:** packages/booking-component/page-calendar/page-calendar.tsx, booking-component.css, Primo components/heros/HeroPageCalendar.tsx
**Found:** 2026-10-31 by independent review of 13c.3
**Why it matters:** (1) the form was never made new after a booking, so a second booking from the card sent the used key and was refused; (2) the business read at the first Next had no latest-ask check, so a day tapped meanwhile left an empty pane or opened the window on a time already left; (3) the card's form named no time zone, and Primo hides the zone line, so a visitor saw no zone before booking.
**Suggested fix:** as named.
**Resolution:** Fixed 2026-10-31 in window 0.2.28: a new form (new key) after each booking, with a test; the business answer dropped when a day or month changed meanwhile (month changes now count as asks); the zone's name under the picked time in the form (seen: "Mountain Time"). Also from the P3s: focus to the day after Back and after a taken time, the old "taken" notice cleared at Next. A test for the business read failing and opening the window. 152 tests.
Closed 2026-10-31 by /audit independent current (fresh subagent, d51de3f..2cdb9db): (1) `setForm(null)` after a booking (page-calendar.tsx:353), new-key test passes; (2) `bookHere` drops a late business answer (195, 201) and month changes bump `latestAsk` (183); (3) the zone's name under the picked time (331-333). No new defect from the repair.

## Independent review

The second of two whole-feature reviews, after Frank's last round; the first, at 2cdb9db (fresh subagent, claude-opus-5-5), also passed and added F-610 and F-611.

**Status:** passed
**Target commit:** 21dc56e20a155dbcb086ea2179962a5db83d6ae3
**Base commit:** d51de3f62b42db2c2cb7c874a9ea8ab15dbeee93
**Base ref:** main
**Spec hash:** 54d265c46d336a3e03f7f15266bebd9ef882cb13d01eea43ffdb4397bd5a54bf
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-31T05:14:24Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-31T05:16:42Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `git rev-parse HEAD`: pass (21dc56e20a155dbcb086ea2179962a5db83d6ae3)
- `git merge-base main 21dc56e20a155dbcb086ea2179962a5db83d6ae3`: pass (d51de3f62b42db2c2cb7c874a9ea8ab15dbeee93)
- `sha256sum blueprint/context/current-feature.md`: pass (matches Spec hash)
- `git status --porcelain -uall`: pass (only blueprint/context/review.md differed before the review, and still only it after the test builds)
- `npm run test --workspace=@frankdmosquera/booking-component`: pass (build, dist import check over 11 files, 26 files, 154 tests)
- `npm run test --workspace=@frankdmosquera/site-chat`: pass (build, dist import check over 14 files, 15 files, 221 tests)
- `npm run build --workspace=frontend`: unavailable (not run: the frontend layout uses next/font/google, which fetches at build time; the delta does not touch frontend/)

### Evidence

- Full delta d51de3f..21dc56e reviewed: 26 commits, 33 files (booking component's page calendar, server entry, provider, report-booked, window, month view, CSS, words, build config and import check, tests; site chat's opener, keyboard fit, launcher CSS, tests; package files and lockfile).
- 21dc56e, new since the last receipt: SVG month arrows keep their aria-labels and the disabled colour via currentColor; the phone scroll after a tapped day runs only after the visitor's own tap, only below 768px (matching the CSS breakpoint), honours reduced motion, and never moves focus; the chat launcher keeps its words on phones with the panel and hello moved to 88px above the bottom.
- The server read never throws, answers null on any failure or no open day, encodes the slug and link id, and adds no route, secret or Origin trust; booking on the spot reuses the window's form, key and send lock, with the month inert while a send is unknown.
- No skipped, focused or placeholder tests in the changed test files. No P0 or P1 finding is open or fixed in the ledger.

### Findings

- F-612 [P3] open - 13c independent review at 21dc56e: smaller points (new)
- F-610 [P3] open and F-611 [P3] open re-examined: still apply

### Remaining risk

- `npm run build --workspace=frontend` unavailable (network-backed next/font/google at build time); the booking package's own build and type-check passed through its test command.
- Layout and scroll behaviour checked in code and jsdom only, not measured in a real browser at phone or desktop width.
- Primo's site repo (his hero card, vendor packs, live deploy) is outside this repo's delta and was not reviewed.
