# Feature: Face and Body

**From build-plan:** feature 17

**Size:** heavy - separate risks: her catalogue and hours as a business's data, and a second
repo swapping its booking provider. The live switch, planned as step 3, moved to item 17b
(Frank, 2026-10-26): it waits on her answers and on IA a la Orden, and kept this feature open.

**Status:** verified

**Branch:** feature/17-face-and-body (here); `feature/11-booking-integration` in `face-and-body`
for step 17.2

## Goal

Face and Body Wellness Centre, Frank's sister's clinic in Calgary, books through Booking CRM
instead of Cal.com. Her treatments, hours and time zone live as a business in Booking CRM, and
every Book button on her site opens our booking window on that treatment. Each booking becomes
a lead in her CRM. Her site was built for this swap: `lib/bookingConfig.ts` says Cal.com is what
the site uses "until it lands", and only that file and `components/booking/` touch Cal.com.

## In scope

- **Her business in Booking CRM (17.1).** A setup file, `packages/shared/client-setups/face-and-body.ts`,
  made once from her site's catalogue (`face-and-body/data/servicesData.ts`) and business facts
  (`data/siteConfig.ts`): every bookable treatment (37 of the 40; the three priced at
  consultation stay Enquire, as on her site and in the Cal.com script), its name, length and
  description; her week from `siteConfig.hours`; her time zone, `America/Edmonton`; English.
  Applied to the local `scheduleads_dev` through the existing `client:setup` command.
- **Her site books with our window (17.2), in the `face-and-body` repo.** Our package in, Cal.com
  out: `BookingProvider` once around the site, each treatment's Book button opens the window on
  that treatment, the header's Book now opens it on her services, the window keeps its
  standard look (her colours later, for every business), `/book` keeps working as an address. A check script
  replaces `scripts/createCalcomEventTypes.mjs`: it compares every bookable treatment on the site
  with her booking links in the API and fails on a missing one. Her own plan's item 11 is
  reworded to Booking CRM and closed with this step, in her repo's own records.
## Out of scope

- **Going live** (planned as step 17.3): its own item, 17b, in the build plan, with the go-live
  list: her business on the live app, the setup applied with `--live`, the live check script,
  her domain in `WIDGET_ORIGINS` on Railway, her launch, one real booking, then her Cal.com
  account closed and its API key revoked (F-525).

- **Launching her site.** It has never been deployed: its own item 13 (deployment readiness,
  domain, Vercel) is open. This feature makes it book through us; launching it is that item's
  work. It also runs Next.js 16.3.5, inside the critical advisory fixed here on Oct 25: a fix in
  her repo before it goes live, named here so it is not lost.
- **Her practitioners, rooms and who does what.** Facts only she can give (Open questions). Until
  then the business is its own one person, as IA a la Orden is, and every treatment is booked
  with the business. When she answers, people, places and ticks are added to the same setup
  file; `client:setup` adds only what is missing.
- **Deposits or payment at booking.** Project plan question 16: if she takes deposits, payment
  becomes an item before her swap.
- **Her Google calendar.** The plan expects none (she books through Square). If she keeps one,
  Google's consent screen is published first (10b decision 6); the calendar half of item 22 is
  done.
- **The free 15-minute consultation** in `siteConfig.consultation`. Cal.com never booked it; it
  stays on her contact page.
- The look and copy of her site beyond the Book controls, and item 13 (Primo).

## Build loop

Heavy: each step is planned with Frank and gets his yes, then runs straight through (build,
checks, tick, log, commit and push to its branch, `/audit` scoped to the step, independent
review); the one planned stop is after the review, where the findings are talked through.
Blocking findings (P0/P1) are fixed; P2/P3 are recorded and carried. `workflow.stepReview` is
`every`; checkpoint commits are on. Only these stop a step earlier: the plan proves wrong, a line
only Frank crosses (installing our package in her site, touching Railway or live data, `main`, a
merge, deleting anything), or a blocking finding.

17.2 works in a second repo. It follows that repo's own `AGENTS.md`: its branch, its own commit
and push, its own plan line and `current-feature.md`, and merging there is Frank's call too.

## Build steps

- [x] 1. **Her business in Booking CRM.** In this repo: write
  `packages/shared/client-setups/face-and-body.ts` from her site's data, once, with a header
  naming the source and date. `slug: "face-and-body-wellness-centre"` (what the admin screen makes from her business name, and her Cal.com handle); `language: "en"`; `personChoice:
  "business_assigns"` (no people yet); `contactRule` and `questions` as her Cal.com booking asks
  today (its event types set no booking fields, so Cal.com's own: a name and an email, so
  `"email"` and no questions); `hours.weeklyHours` from `siteConfig.hours` in minutes from
  midnight (Mon 16:00-20:00, Tue 10:00-13:00, Wed 09:00-12:00, Thu 12:00-15:30, Fri 14:00-18:00,
  Sat 07:00-11:30, Sun closed; from one Instagram post, awaiting her confirmation);
  `timezone: "America/Edmonton"`; `minimumNoticeMinutes: 120` (a starting point: Cal.com's
  default for a new event type, since nothing records her own notice; to be confirmed with her) and
  `horizonDays: 365` (Cal.com's default is no limit; a year is the most Settings allows); all of
  them hers to change in Settings; `closedDates: []`; `people: []`;
  37 services, each `name` exactly as on her site, `durationMinutes` from `durationMin`,
  `description` from hers, `addressMode: "not_asked"` (she works at the clinic). Make the
  business on http://localhost:3400/admin/client-setup, then dry run, `--apply`, and dry run
  again. **Done when:** the second dry run has nothing to add; Settings shows her 37 services and
  her week at http://localhost:3400; `GET http://localhost:3401/public/face-and-body-wellness-centre/booking-links`
  answers 37 links; the shared and backend suites pass.
- [x] 2. **Her site books with our window.** In `face-and-body`, on
  `feature/11-booking-integration` off its `main` (only once the uncommitted
  `components/theme/DesignPicker.tsx` change on `design/copy-my-picks` is settled; see Open
  questions): with Frank's yes, install `@frankdmosquera/booking-component` 0.2.0 (the `.npmrc`
  from the package's header, committed, no secret) and remove `@calcom/embed-react`.
  `lib/bookingConfig.ts` keeps the seam and swaps what is behind it: `CALCOM_USERNAME` gives way
  to `BOOKING_SLUG = "face-and-body-wellness-centre"` and `BOOKING_API_URL`, the live address
  `https://api.booking-crm.com` unless `NEXT_PUBLIC_BOOKING_API_URL` is set (local only; a
  missing variable on Vercel still books live, the trap the file's own comment describes);
  `buildBookables` keeps `bookingId ?? slug` as each treatment's booking id, and her catalogue
  sets `bookingId` on the two whose names make another slug here: "Relaxation Massage, 75 min"
  (`relaxation-massage-75-min`) and "Relaxation Massage, 90 min" (`relaxation-massage-90-min`)
  (F-518). `components/booking/`
  wraps the site once in `BookingProvider` (language `en`, `afterBooking: "stay"`: she has no
  thank-you page) and opens the window from her existing Book controls by booking id; the
  Enquire controls stay on `/contact`. `/book` and `/book?treatment=<slug>` still work: the page
  opens the window on that treatment, or on her services. The window keeps its standard look
  (Frank, 2026-10-26: her colours and logo come later, for every business). Amended while
  building: the window opens a service by its id in Booking CRM, not its slug, and the id differs
  per database, so her site keeps slugs and reads her slug-to-id list once on the first Book click
  (option A, Frank's yes); letting the API take a slug is noted for later. The uncommitted
  DesignPicker change was stashed (nobody was working on it). The footer's Book now, which went
  to `/contact`, goes to `/book`, and `/book` no longer promises a reminder Booking CRM does not
  send yet. `scripts/checkBookingLinks.mjs`
  replaces `createCalcomEventTypes.mjs`: it reads her catalogue and `GET
  <api>/public/face-and-body-wellness-centre/booking-links`, prints any treatment with no link and any link with
  no treatment, and exits 1 on a missing link. Her plan's item 11 is reworded ("Booking CRM
  behind the seam") and her repo's records written as its `AGENTS.md` says. Locally the site runs
  on its own port (3402, never 3000/3001), with `http://localhost:3402` added to `WIDGET_ORIGINS`
  in this repo's root `.env`. **Done when:** her site builds and lints; no `calcom` remains in
  her code or `package.json`; the check script passes against the local API; on
  http://localhost:3402 a treatment's Book button opens the window on that treatment, Book now
  opens it on her services, `/book?treatment=<slug>` opens on that treatment, a test booking
  lands as a lead in her CRM at http://localhost:3400/leads (then cancelled), an Enquire button
  still goes to `/contact`, and the console shows no errors.
## Files / areas

- Here: `packages/shared/client-setups/face-and-body.ts` (new). No code change expected; the
  setup command, schema and booking routes exist since features 10 and 12k.
- `face-and-body`: `package.json`, `.npmrc` (new), `lib/bookingConfig.ts`,
  `components/booking/` (`BookingEmbed.tsx`, `BookingPopup.tsx`, `Booker.tsx`, `BookLink.tsx`),
  `components/booking/BookingHost.tsx` (new; `BookingEmbed.tsx` and `BookingPopup.tsx` deleted),
  `components/layout/MobileNav.tsx`, `data/nav.ts`, `data/servicesData.ts`, `app/book/page.tsx`,
  `app/layout.tsx`, `scripts/checkBookingLinks.mjs` (new), `scripts/createCalcomEventTypes.mjs`
  (deleted), its `AGENTS.md`, `blueprint/build-plan.md` item 11 and `current-feature.md`.
- Local only, never committed: this repo's root `.env` `WIDGET_ORIGINS`.

## Data / contracts

- **One booking id per treatment.** The site's `bookingId ?? slug` must equal the booking link's
  slug, which Booking CRM makes from the service name (`toSlug`, `-2` when taken). Names are
  copied exactly; 35 of the 37 then match their site slug, and the two Relaxation Massage
  lengths get their `bookingId` set on the site (17.2). `checkBookingLinks.mjs` is the contract's guard from then on, including a service
  added later on either side.
- **Public routes only.** The site calls `GET /public/face-and-body-wellness-centre/...` and posts bookings, no
  credentials, allowed by `WIDGET_ORIGINS` (`public-cors-middleware.ts`). No login reaches her
  site.
- **Tenant boundary.** Every row the setup writes is scoped to the `face-and-body-wellness-centre` business; the
  command refuses a slug that does not exist and adds only what is missing.
- **Her settings are hers.** Every value in the setup file is a starting point taken from her
  site or her Cal.com setup, changed later in Settings (project decision 30).

## Testing

- 17.1: no new logic. Proof is the setup command's dry runs, the public API answering 37 links,
  and the shared and backend suites passing unchanged.
- 17.2: her repo has no test runner; the check script is the saved, repeatable check, run
  against the local API, and the build, lint and the browser walk prove the rest. A test booking
  is made and cancelled on the local database only.
- 17b: the live dry run and the live check script; no booking is made on live.

## Notes for the AI

- Her catalogue is read where it lives, in `../face-and-body`; never copy her data into this
  repo except as the setup file.
- 37 bookable, not the plan's 45: the catalogue holds 40 treatments today and three are priced at
  consultation. Say so in the log.
- Never touch `design/copy-my-picks` or its uncommitted change; never stop anything on 3000/3001.
- Ask before the package install in 17.2 and before every live action in 17b.

## Open questions

- **The uncommitted DesignPicker change in `face-and-body`** (`components/theme/DesignPicker.tsx`,
  47 lines, on `design/copy-my-picks`): is someone still working on it? 17.2 cannot branch off
  her `main` cleanly until it is committed, stashed by its owner, or dropped. Blocks 17.2 only.
- **Her practitioners and rooms, and which treatments each does.** Facts from her, asked at
  onboarding; added to the setup file before 17b. Blocks nothing in 17.1 or 17.2.
- **Her hours and notice, confirmed by her** (F-519, F-520). Her week comes from one Instagram
  post that Google disagrees with on six days, and the two hours' notice is a starting point.
  Asked at onboarding; must be answered before 17b, and changed in Settings or the setup file.
- **Deposits** (project plan question 16) and **her Google calendar**: asked at onboarding. A
  yes to either adds work before 17b (a payment item; publishing Google's consent screen).
- **Go-live order.** The plan holds real clients until IA a la Orden has taken real bookings
  (Frank, 2026-10-23). 17b waits on that, and on her site's own launch (her item 13).

## Implementation walkthrough

Heavy, two steps built (17.1, 17.2), each with its own independent review, then two rounds of
final review. Step 3, going live, moved to item 17b on 2026-10-26 (Frank), so this feature could
close while go-live waits on her answers and on IA a la Orden.

### packages/shared/client-setups/face-and-body.ts (17.1)

Written once by a scratch script from her site's catalogue and business facts: 37 treatments
(her catalogue holds 40; Fractional Microneedling, IPL Treatment and Laser Hair Removal are priced
at consultation and stay Enquire on her site), names, lengths and descriptions exactly hers,
`addressMode: not_asked`. Her week from `siteConfig.hours` (Mon 16:00-20:00 to Sat 07:00-11:30,
Sunday closed), `America/Edmonton`, English, an email asked, no questions, two hours' notice (a
starting point: Cal.com's default for a new event type) and a year ahead (the most Settings
allows). The business slug is `face-and-body-wellness-centre`: the admin screen makes it from her
business name, and it is also her Cal.com handle. Until she names her staff the business is its
own one person, so all 37 are booked with "Face and Body". Applied to the laptop's
`scheduleads_dev` with a dev owner, `faceandbody@example.com`; a second dry run had nothing to add.
Review: three wording points (F-518 to F-520), fixed.

### face-and-body, feature/11-booking-integration (17.2)

Cal.com out (`@calcom/embed-react`, `BookingEmbed.tsx`, `BookingPopup.tsx`,
`createCalcomEventTypes.mjs`), `@frankdmosquera/booking-component` 0.2.0 in from GitHub Packages
(`.npmrc`, `NODE_AUTH_TOKEN`). `lib/bookingConfig.ts` keeps the seam: `BOOKING_SLUG`,
`BOOKING_API_URL` (live unless `NEXT_PUBLIC_BOOKING_API_URL` is set on the laptop), and
`bookingTrigger` marks each Book anchor with `data-booking`. `components/booking/BookingHost.tsx`
puts one `BookingProvider` in her layout and opens the window from a plain click on a Book anchor.

Changed from the plan: the window opens a service by its **id** in Booking CRM, not its slug, and
the id differs between the laptop and live. Frank picked option A: her site keeps slugs and reads
her slug-to-id list once on the first Book click (no credentials, five-second limit, retried on
failure, last click wins). Letting the API take a slug (option B) is a note for later, for every
site. The two Relaxation Massage lengths carry `bookingId` `relaxation-massage-75-min` and
`-90-min`, since Booking CRM makes those slugs from their names.

`/book` opens the window itself, waiting until it has read the address (it first opened her whole
list before reading it). The footer's Book now, which went to `/contact`, goes to `/book`; `/book`
no longer promises a reminder Booking CRM does not send yet. `BookLink` passes through what the
phone menu's `SheetClose` renders, so the menu closes when its Book now opens the window (F-522,
reopened by the final review after a builder check that could not see the menu; fixed and checked
with real clicks). The standard window look, by Frank's choice; her colours and logo come later
for every business. Her DesignPicker work in progress was stashed, not dropped. `scripts/
checkBookingLinks.mjs` proves every bookable treatment has its link: 37 of 37 on the laptop.

Checked on http://localhost:3402: a treatment's Book opens on it with her times, Book now opens her
list, `/book?treatment=` opens on that treatment, and a test booking became a lead in her CRM
("Test Booking 17.2", Wed Oct 28 9:00, from the Website) and was cancelled from its customer page.
Her repo's plan item 11, `AGENTS.md` and records were updated.

### the plan

Item 17 now says 37 bookable services; 17b holds her practitioners and rooms, the live setup, her
domain in `WIDGET_ORIGINS`, her launch with its Next.js security update, one real booking, and her
Cal.com account closed with its API key revoked (F-525, kept in her `.env.local` for now by Frank).
The overview's line 17 and a new 17b line say the same; its fingerprint was recomputed.

### left open

F-529 (P3): the spec's Open questions still ask about the DesignPicker change, already answered by
step 2 (stashed). F-517 (P3, from the npm warnings fix) stays in the ledger.

## Findings

### 17/F-518 [P2] closed - Two Relaxation Massage links get a slug her site does not use, while the spec and the file header say every name gives her site's slug

**File:** packages/shared/client-setups/face-and-body.ts:4-5, 234, 240; blueprint/context/current-feature.md:137-140
**Found:** 2026-10-26 by independent review of step 17.1 (scope: main..3cc702e; lenses: quality, security, performance, tests)
**Why it matters:** `toSlug("Relaxation Massage, 75 min")` is `relaxation-massage-75-min` and `toSlug("Relaxation Massage, 90 min")` is `relaxation-massage-90-min`, but her catalogue's booking ids (`bookingId ?? slug`, both `bookingId: null`) are `relaxation-massage-75` and `relaxation-massage-90`. Confirmed against the running API: `GET /public/face-and-body-wellness-centre/booking-links` answers 37 links, and exactly these two links have no treatment and these two treatments have no link. The other 35 match. So the builder's two are right and there are no others. The header still says "Names are hers exactly, so each booking link's slug is her site's slug", and the spec's Data / contracts says "Names are copied exactly, so each matches its site slug", which is false for these two. The header also names `face-and-body/scripts/checkBookingLinks.mjs` as what keeps them equal, which does not exist until step 17.2. If 17.2 is built on the spec as written, those two Book buttons open the window on no service and the new check script fails.
**Suggested fix:** Amend the spec before 17.2 so it names the two: her catalogue sets `bookingId: "relaxation-massage-75-min"` and `"relaxation-massage-90-min"` (her page slugs stay as they are). Correct the header to say the slugs match except where her catalogue sets a `bookingId`, and refer to the check script as the step 17.2 file, or say it once it exists.
**Resolution:** fixed on feature/17-face-and-body: the spec's step 2 and Data / contracts now name the two Relaxation Massage lengths and set their bookingId on her site in 17.2; the setup file's header no longer claims every slug matches or names a script that does not exist yet. Closed by the final independent review of feature 17, 2026-10-26 (main..e636cc2 and face-and-body main..367fa39): her catalogue sets bookingId "relaxation-massage-75-min" and "relaxation-massage-90-min"; the spec and the setup file header say so; `node scripts/checkBookingLinks.mjs --api http://localhost:3401` prints 37 links and 37 bookable treatments, none missing; /book?treatment=relaxation-massage-75 opened the window on "Relaxation Massage, 75 min".

### 17/F-519 [P3] closed - The notice comment says "her event types never changed" it, but nothing shows her Cal.com event types were ever made

**File:** packages/shared/client-setups/face-and-body.ts:27; blueprint/context/current-feature.md:82-84
**Found:** 2026-10-26 by independent review of step 17.1 (scope: main..3cc702e; lenses: quality, security, performance, tests)
**Why it matters:** 120 minutes is Cal.com's default notice for a new event type, and her `createCalcomEventTypes.mjs` sends no notice or booking-window field, so a type made by it would carry that default. That much the files support. But her repo's item 11 (booking integration) is still open, her records hold no run of the script with `--apply`, and her site sets no notice in its embed, so whether her event types exist, and whether she changed one by hand (the script's own header allows for that), cannot be read from anything here. The comment and spec present it as a checked fact about her account. The value itself is reasonable and hers to change; only the claim overstates its evidence.
**Suggested fix:** Word it as what it is: "Cal.com's default for a new event type, which her script would have made" (and the same in the spec), and add notice and how far ahead to the onboarding questions alongside her practitioners.
**Resolution:** fixed on feature/17-face-and-body: the setup file's comment and the spec now call 120 minutes a starting point (Cal.com's default for a new event type, nothing records her own), and her notice is asked at onboarding. Kept open by the final independent review of feature 17, 2026-10-26 (main..e636cc2 and face-and-body main..367fa39): the setup file's comment now holds ("a starting point ... ask her"), but the spec's step 1 says of the 120 minutes "since nothing records her own notice; confirmed with her", which states a confirmation that has not happened, while its Open questions say the notice is still to be asked. Reword to "to confirm with her". Reopened fix, 2026-10-26: the spec's step 1 now says "to be confirmed with her". Closed by the second final independent review of feature 17, 2026-10-26 (main..eb2a6a3 and face-and-body main..3396aa1): the spec's step 1 calls the 120 minutes "a starting point: Cal.com's default for a new event type, since nothing records her own notice; to be confirmed with her", the setup file's comment says "a starting point ... ask her", and Open questions still lists her notice as a must-answer before 17b. No claim of a confirmation is left.

### 17/F-520 [P3] closed - Her hours are provisional at their source, but the spec presents them as her week and does not list confirming them

**File:** blueprint/context/current-feature.md:27, 80-82, 168-178; packages/shared/client-setups/face-and-body.ts:25
**Found:** 2026-10-26 by independent review of step 17.1 (scope: main..3cc702e; lenses: quality, security, performance, tests)
**Why it matters:** The seven days match `siteConfig.hours` exactly (checked minute by minute). But `siteConfig.ts` says those hours come from one Instagram post of 22 Jul 2026, that her Google Business Profile disagrees on six days, and that they await her confirmation. The setup file's comment carries that; the spec, which is what goes live in 17.3, does not, and its Open questions ask her about people, rooms, deposits and her calendar but not her hours. Once live, these hours decide what customers can book.
**Suggested fix:** Add "her opening hours, to confirm (one Instagram post; Google disagrees)" to the spec's Open questions, as a must-answer before 17.3.
**Resolution:** fixed on feature/17-face-and-body: the spec says her week is from one Instagram post awaiting her confirmation, and Open questions lists her hours and notice as a must-answer before 17.3. Closed by the final independent review of feature 17, 2026-10-26 (main..e636cc2 and face-and-body main..367fa39): the setup file and the spec say the week is from one Instagram post awaiting her confirmation, Open questions lists her hours as a must-answer before 17b, and the seven days still match siteConfig.hours.

### 17/F-521 [P2] closed - A booking-links request that never answers leaves every treatment Book button on her site dead for the rest of the visit

**File:** ../face-and-body/components/booking/BookingHost.tsx:93-107 (feature/11-booking-integration at 3b278ea)
**Found:** 2026-10-26 by independent review of step 17.2 (scope: face-and-body main..3b278ea and 94a011e; lenses: quality, security, performance, tests)
**Why it matters:** The click listener cancels the anchor's navigation first, then waits on the slug-to-id request before opening anything. That request is a bare `fetch` with no time limit (every call inside the package goes through `fetchWithTimeLimit`, which also sends `credentials: "omit"`), and `ids.current` keeps the pending promise, so later clicks wait on the same one. Checked on http://localhost:3402/other-treatments with that one request stubbed to never settle: two treatment clicks opened nothing and did not navigate; with the network restored a third click still opened nothing. A slow mobile connection gives the same silence on the first click. Book now (empty `data-booking`) is not affected, since it skips the request.
**Suggested fix:** Give the request a time limit (`AbortSignal.timeout`, the package's own limit) and `credentials: "omit"`, and on any failure clear the cache and open her list, so a Book click always opens something.
**Resolution:** fixed in face-and-body 367fa39: the lookup sends no credentials and gives up after five seconds; a failure opens her list that time and is tried again on the next click. Closed by the final independent review of feature 17, 2026-10-26 (main..e636cc2 and face-and-body main..367fa39): BookingHost sends credentials "omit" with AbortSignal.timeout(5000). On http://localhost:3402/other-treatments with that one request held open, a Book click opened her list after the five seconds; the next click asked again and opened on Microneedling, Face.

### 17/F-522 [P2] closed - On a phone, the menu's Book now opens the window but leaves the menu sheet open underneath, and the first Escape closes the hidden sheet instead of the window

**File:** ../face-and-body/components/layout/MobileNav.tsx:236-243; ../face-and-body/components/booking/BookingHost.tsx:111-123
**Found:** 2026-10-26 by independent review of step 17.2 (scope: face-and-body main..3b278ea and 94a011e; lenses: quality, security, performance, tests)
**Why it matters:** Checked at 390 px on http://localhost:3402/ with a real click: menu, then Book now. The booking window opens, but the sheet keeps `data-open` (a MutationObserver saw no change on it at all), so closing the window lands the visitor back in the menu. Escape goes to Base UI's sheet first: the first press closed the sheet behind the window, the second closed the window. The cause is not pinned down (the capture listener's `preventDefault` runs before `SheetClose`'s handler; Base UI's `DialogClose` should still close, yet does not here). The comment beside it says BookingHost opens the window, implying the sheet closes as before. This is the main Book path on a phone.
**Suggested fix:** Close the sheet explicitly when its Book now is pressed (for example `setOpen(false)` in an `onClick` on that `SheetClose`), then recheck that one Escape closes the window and that closing the window returns to the page, not the menu.
**Resolution:** fixed in face-and-body 367fa39: BookingHost listens in the bubble phase, so the menu's SheetClose closes the sheet first. Checked at 375px: Book now in the phone menu opens the window and the menu is gone. Escape could not be checked in the builder's pane (its key presses do not reach a page dialog). Reopened by the final independent review of feature 17, 2026-10-26 (main..e636cc2 and face-and-body main..367fa39): the repair does not hold. At 375px on http://localhost:3402/, menu then Book now: the window opens but the sheet keeps data-open (checked after 3 seconds, twice); closing the window with its X lands back in the open menu; with both open, one Escape closed the sheet and left the window. The cause: `BookLink` takes only treatmentSlug, className and children and spreads nothing else, so the onClick (and ref) that SheetClose passes through `render` never reach the anchor, and the sheet is never told to close. The phase of BookingHost's listener does not matter. Fix: let BookLink pass the remaining props (and ref) onto its anchor, or close the sheet from MobileNav's own state, then recheck one Escape and the close. Reopened fix, 2026-10-26: BookLink now passes the props and ref SheetClose renders through to its anchor (its own href and data-booking still win), in face-and-body. Checked at 375px with real clicks: after Book now in the menu, no [data-slot="sheet-content"] is left, the window is open, the page did not navigate. Closed by the second final independent review of feature 17, 2026-10-26 (main..eb2a6a3 and face-and-body main..3396aa1): BookLink spreads the rest of its props (onClick, ref, role, tabIndex from SheetClose) onto the anchor before its own href and data-booking, so SheetClose's close now reaches it. At 375px on http://localhost:3402/ with real clicks: menu, then its Book now; after 3 seconds no [data-slot="sheet-content"] remained, one dialog[open] (her list), the URL stayed on /. One Escape closed the window and left no sheet; a second round, closed with the window's X, also returned to the page with no sheet. No console errors. The anchor now carries role="button" from SheetClose (nativeButton false), which matches what it does.

### 17/F-523 [P3] closed - A failed list answer is kept for the whole visit, and a second Book click during the first one's wait is dropped

**File:** ../face-and-body/components/booking/BookingHost.tsx:93-107
**Found:** 2026-10-26 by independent review of step 17.2 (scope: face-and-body main..3b278ea and 94a011e; lenses: quality, security, performance, tests)
**Why it matters:** Only a thrown error clears the cache. A 4xx or 5xx (or a body without `bookingLinks`) becomes an empty map kept for the visit: checked with one 503 on the first click, then with the API healthy the next treatment click (`microneedling-abdomen`) opened her whole list, not that treatment. Two clicks while the first request is pending both wait on the same promise and the provider's open-once rule keeps the first: clicking 90 min then 75 min opened 90 min. Also, unlike the package, the host does not strip a trailing slash from `apiUrl`, so `NEXT_PUBLIC_BOOKING_API_URL=http://localhost:3401/` asks for `//public/...`, which would silently turn every treatment into her list. None of this breaks booking (a window always opens), but each failure is silent.
**Suggested fix:** Cache only a successful list (reset `ids.current` when `!response.ok`), open on the id of the latest click rather than each click's own, and trim the trailing slash as the package does.
**Resolution:** fixed in face-and-body 367fa39: a failed answer is no longer kept (it throws, so the next click asks again); when clicks overlap the last one wins; a trailing slash on apiUrl is trimmed. Closed by the final independent review of feature 17, 2026-10-26 (main..e636cc2 and face-and-body main..367fa39): a non-ok answer throws into the catch that clears the cache, a click counter lets only the latest click open, and apiUrl has its trailing slashes trimmed; the retry path was seen working in the F-521 check.

### 17/F-524 [P3] closed - BookingHost's header says the catalogue never crosses into the browser, but it ships in the mobile menu's bundle

**File:** ../face-and-body/components/booking/BookingHost.tsx:17-24; ../face-and-body/components/layout/MobileNav.tsx:1,27; ../face-and-body/lib/bookingConfig.ts:1
**Found:** 2026-10-26 by independent review of step 17.2 (scope: face-and-body main..3b278ea and 94a011e; lenses: quality, security, performance, tests)
**Why it matters:** `MobileNav` is a client component and imports `BookLink`, which imports `bookingTrigger` from `bookingConfig.ts`, which imports `servicesData`. After `npm run build`, `.next/static/chunks/14hql1cycxpkx.js` (85 KB) holds her treatments' descriptions. The chain is the same on `main`, so this is not a regression, but the new comment states the opposite, and the props-only design of `BookingHost` rests on it. Nothing secret is exposed; it is page weight on every page.
**Suggested fix:** Correct the comment, or let the menu's Book now (which names no treatment) render its anchor without importing `bookingConfig`, for example from a general Book link in a module that does not load the catalogue.
**Resolution:** fixed in face-and-body 367fa39: BookingHost's header now says this file imports nothing from bookingConfig and names MobileNav as the way the catalogue still reaches the browser, which predates this step. Closed by the final independent review of feature 17, 2026-10-26 (main..e636cc2 and face-and-body main..367fa39): the header now says BookingHost imports nothing from bookingConfig and names MobileNav as the route by which the catalogue still reaches the browser.

### 17/F-525 [P3] accepted - Her live Cal.com API key stays in `.env.local` with nothing left to read it, and sits in the Turbopack caches

**File:** ../face-and-body/.env.local:21-27 (gitignored, not committed)
**Found:** 2026-10-26 by independent review of step 17.2 (scope: face-and-body main..3b278ea and 94a011e; lenses: quality, security, performance, tests)
**Why it matters:** The step deleted `createCalcomEventTypes.mjs`, the key's only reader, but the key (a live one) and its comment naming the deleted script remain. Her `AGENTS.md` (Environment) says a variable no code reads does not belong in `.env.local`, because Turbopack copies the environment into `.next/cache`; the key's name is found in five `.sst` files under `.next/cache` and `.next/dev/cache`. The spec's "no calcom remains" covers code and `package.json`, so this was outside it, but this is the step that made the key dead.
**Suggested fix:** Remove the key and its comment from `.env.local`, delete `.next` to clear the cached copies, and add revoking the key to the 17.3 go-live list for the day her Cal.com account closes.
**Resolution:** accepted by Frank, 2026-10-26: keep the key in her .env.local for now, so it never has to be pasted back if needed. Revoking it in her Cal.com account stays on step 17.3's go-live list.

### 17/F-526 [P3] closed - Her `AGENTS.md` does not say how to install, run or check the site now

**File:** ../face-and-body/AGENTS.md:209-214, 233-247
**Found:** 2026-10-26 by independent review of step 17.2 (scope: face-and-body main..3b278ea and 94a011e; lenses: quality, security, performance, tests)
**Why it matters:** Commands still lists only `npm run dev` on http://localhost:3000, while the spec runs her site on 3402 and never on 3000/3001 (her `dev` script has no port, so it takes 3000 unless `-p 3402` is passed, as the new `.claude/launch.json` entry does). It does not list `node scripts/checkBookingLinks.mjs [--api <url>]`, the step's saved check, nor that `npm install` now needs `NODE_AUTH_TOKEN` because of the committed `.npmrc` (on Vercel too, which 17.3 relies on). Environment says the project reads five variables and lists them; `NEXT_PUBLIC_BOOKING_API_URL` is a sixth, local only. The next session in her repo reads this file first. Also minor: the check script crashes with a stack trace when `--api` is given no value.
**Suggested fix:** Add the port, the check script command, the token for installs, and `NEXT_PUBLIC_BOOKING_API_URL` (local only; missing means live) to her `AGENTS.md`; make a valueless `--api` print its usage.
**Resolution:** fixed in face-and-body 367fa39: her AGENTS.md gives the 3402 port from scheduleads-app's preview config, the NODE_AUTH_TOKEN install, the check script command, and six variables with NEXT_PUBLIC_BOOKING_API_URL; the check script refuses --api without an address. Closed by the final independent review of feature 17, 2026-10-26 (main..e636cc2 and face-and-body main..367fa39): her AGENTS.md names the 3402 port, the NODE_AUTH_TOKEN install, the check script and NEXT_PUBLIC_BOOKING_API_URL; `checkBookingLinks.mjs --api` with no value prints its usage and exits 1.

### 17/F-527 [P3] closed - The spec's In scope and Files still say her theme reaches the window through the `--sa-*` tokens and `app/globals.css` changes, which step 2 dropped

**File:** blueprint/context/current-feature.md:32-33, 135
**Found:** 2026-10-26 by independent review of feature 17 (scope: current, main..e636cc2 and face-and-body main..367fa39; lenses: quality, security, performance, tests)
**Why it matters:** Step 2 records Frank's decision that the window keeps its standard look (her colours and logo come later, for every business), and `BookingHost` says the same, but In scope still promises "the look comes from her theme through the `--sa-*` tokens" and Files / areas lists `app/globals.css`, which the branch does not touch. The archived spec will say the feature themed her window when it did not.
**Suggested fix:** Reword the In scope line to the standard look, as step 2 says, and drop `app/globals.css` from Files / areas.
**Resolution:** Fixed 2026-10-26: In scope says the window keeps its standard look; Files lists the files step 2 really touched, without app/globals.css. Closed by the second final independent review of feature 17, 2026-10-26 (main..eb2a6a3 and face-and-body main..3396aa1): In scope says "the window keeps its standard look (her colours later, for every business)", no `--sa-*` promise is left, and Files / areas matches `git diff --stat main...3396aa1` in face-and-body file for file (plus its lockfile), with no app/globals.css.

### 17/F-528 [P3] closed - Build plan item 17 and the overview still promise 45 services, her practitioners and her rooms, and 17b names them only as answers to wait for

**File:** blueprint/build-plan.md:458-461, 466-472; blueprint/context/project-overview.md:3, 103
**Found:** 2026-10-26 by independent review of feature 17 (scope: current, main..e636cc2 and face-and-body main..367fa39; lenses: quality, security, performance, tests)
**Why it matters:** The 17b line matches the go-live list the spec moved out, item for item (live business, `--live` setup, live check script, `WIDGET_ORIGINS` on Railway, her launch with its Next.js update, one real booking, Cal.com closed and its key revoked), and the overview fingerprint reproduces over the CRLF form of both plans (e46c40bc...). But item 17, which will be ticked when this feature closes, still says her 45 services become links, her practitioners resources and her rooms places; this feature made 37 services and no people or places. The spec says people and rooms are "added to the setup file before 17b", yet 17b lists "staff and rooms" only among the answers it waits on, not as work, so adding them has no home in the plan. 17b also waits on her "email", which the spec never mentions. The overview's item 17 line repeats the old promise and does not name 17b, though its fingerprint was recomputed to say it is current.
**Suggested fix:** Reword item 17 to what was built (37 bookable services, her week, her site booking through the window), add "her practitioners and rooms in the setup file, and their treatments ticked" to 17b's work, regenerate the overview's 17 and 17b lines, then recompute the fingerprint.
**Resolution:** Fixed 2026-10-26: item 17 says 37 bookable services and moves practitioners and rooms to 17b; 17b now puts them in the setup file; the overview's line 17 says the same and gains 17b; fingerprint recomputed. Closed by the second final independent review of feature 17, 2026-10-26 (main..eb2a6a3 and face-and-body main..3396aa1): item 17 says 37 bookable services (40 in her catalogue, three priced at consultation) and moves practitioners and rooms to 17b; 17b puts them in `client-setups/face-and-body.ts` as work and keeps the go-live list; the overview's lines 103 and 104 say the same; the stored fingerprint 8b0c310d... reproduces over the CRLF form of both plans (and the previous 32fbadc4... reproduces at main, so the method is right). The overview's tenants line (36) still says "45 services", but it restates the project plan, which says the same and is Frank's to change; it is not item 17's promise. 17b still lists her "email" among its answers; harmless (her sign-in address for the live app).

## Independent review

**Status:** passed
**Target commit:** eb2a6a36803255a0a9b750b39b184ac8caaa7d4d
**Base commit:** f1f45801d7d4e484629e5c1ca386ae0c89da68ca
**Base ref:** main
**Spec hash:** a8f58e5fd49a8abc6b98646d58e1ba85878bb27a993c09805c2ecb9b6d485872
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-26T16:32:03Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-26T16:39:05Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `npm run test --workspace=@scheduleads-app/shared`: pass (32 files, 214 tests)
- `npm run test --workspace=backend`: pass (95 files, 1098 tests, local Postgres)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass
- `npm run lint --workspace=frontend`: pass
- `npm run format:check`: pass
- `npm run client:setup --workspace=@scheduleads-app/shared -- client-setups/face-and-body.ts` (dry run, no `--apply`): pass, `scheduleads_dev`, "nothing to add"
- face-and-body `npm run lint`: pass
- face-and-body `npm run build`: pass
- face-and-body `node scripts/checkBookingLinks.mjs --api http://localhost:3401`: pass, 37 links and 37 bookable treatments, none missing
- Browser, http://localhost:3402 at 375px, real clicks (built-in browser pane): pass, see Evidence

### Evidence

- Freshness: HEAD eb2a6a3 equals Target; `git merge-base main eb2a6a3` is f1f4580 (Base); the spec's SHA-256 matches; only `blueprint/context/review.md` differed from the target before this pass.
- Second repo: face-and-body `feature/11-booking-integration` at 3396aa1, base its `main` 4bc0f7a (merge base), clean tree; whole `main...3396aa1` delta read (19 files) against her `AGENTS.md`.
- Setup file: all 37 services equal her catalogue's 37 priced treatments in name, `durationMin`, description and order (script comparison, 0 mismatches); the week equals `siteConfig.hours` minute for minute; `America/Edmonton`, `en`, `email`, no questions, no people.
- Overview fingerprint: recomputed per the overview skill over the CRLF form of both plans; target gives 8b0c310d... (stored) and main gives 32fbadc4... (stored there). Lines 103 and 104 agree with build-plan items 17 and 17b and with what was built.
- Her site: no Cal.com identifier, import or package left (only history in comments); `.npmrc` carries no secret; the lookup sends `credentials: "omit"` with a 5 second limit; `@frankdmosquera/booking-component` 0.2.0 resolves from GitHub Packages.
- F-522: menu, then its Book now: no `[data-slot="sheet-content"]` after 3 seconds, one `dialog[open]`, URL stayed on `/`; one Escape closed the window with no sheet left; closing with the window's X also returned to the page. No console errors.
- Also seen: `/book?treatment=relaxation-massage-90` opened on "Relaxation Massage, 90 min"; Book on Microneedling, Face in /other-treatments opened on that treatment without navigating. No booking made.
- Ledger: F-519, F-522, F-527, F-528 moved to `closed` with evidence; new F-529 [P3] open. No P0 or P1 is `open` or `fixed`.

### Findings

- F-529 [P3] open: the spec's Open questions still ask about the DesignPicker change that step 2 stashed
- Closed this pass: F-519, F-522, F-527, F-528

### Remaining risk

- Not run: the live check script, live API, Railway `WIDGET_ORIGINS` and her deployed site, all 17b's work by plan.
- No test booking made in this pass (as instructed); the lead-in-CRM path rests on the builder's 17.2 walk.
- Her repo has no test runner; the check script, build, lint and the browser walk are its only proof.
- The overview's tenants line still says "45 services", restating the project plan, which is Frank's to change.
- The dashboard activity helper (`run.json`) was not written: this reviewer was told to edit only `review.md` and `findings.md`.
