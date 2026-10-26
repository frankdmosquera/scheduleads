# Feature: Face and Body

**From build-plan:** feature 17

**Size:** heavy - three separate risks: her catalogue and hours as a live business's data, a
second repo swapping its booking provider, and the switch away from Cal.com.

**Status:** in progress

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
  that treatment, the header's Book now opens it on her services, the look comes from her
  theme through the `--sa-*` tokens, `/book` keeps working as an address. A check script
  replaces `scripts/createCalcomEventTypes.mjs`: it compares every bookable treatment on the site
  with her booking links in the API and fails on a missing one. Her own plan's item 11 is
  reworded to Booking CRM and closed with this step, in her repo's own records.
- **Ready to go live (17.3).** The live half, prepared and checked but switched only on Frank's
  yes on the day: her business made on the live app, the setup file applied with `--live`, her
  site's address added to the API's `WIDGET_ORIGINS` on Railway, and a written go-live list for
  the day her site launches (Cal.com closed after the first real booking through ours).

## Out of scope

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
  default for a new event type, since nothing records her own notice; confirmed with her) and
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
- [ ] 3. **Ready to go live.** Only on Frank's yes on the day, each live action named before it
  runs: make her business on the live app (https://app.booking-crm.com/admin/client-setup), dry
  run then apply the setup file with `--live`, and run the check script against the live API.
  Her site's address joins `WIDGET_ORIGINS` on Railway once her domain is known (her item 13).
  Write the go-live list into her repo's records for launch day: deploy with `NODE_AUTH_TOKEN` in
  Vercel, one real booking, then close her Cal.com account. **Done when:** the live dry run has
  nothing to add, the live check script passes, and the go-live list is in her repo.

## Files / areas

- Here: `packages/shared/client-setups/face-and-body.ts` (new). No code change expected; the
  setup command, schema and booking routes exist since features 10 and 12k.
- `face-and-body`: `package.json`, `.npmrc` (new), `lib/bookingConfig.ts`,
  `components/booking/` (`BookingEmbed.tsx`, `BookingPopup.tsx`, `Booker.tsx`, `BookLink.tsx`),
  `app/book/page.tsx`, `app/layout.tsx`, `app/globals.css`, `scripts/checkBookingLinks.mjs`
  (new), `scripts/createCalcomEventTypes.mjs` (deleted), its `blueprint/build-plan.md` item 11.
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
- 17.3: the live dry run and the live check script; no booking is made on live.

## Notes for the AI

- Her catalogue is read where it lives, in `../face-and-body`; never copy her data into this
  repo except as the setup file.
- 37 bookable, not the plan's 45: the catalogue holds 40 treatments today and three are priced at
  consultation. Say so in the log.
- Never touch `design/copy-my-picks` or its uncommitted change; never stop anything on 3000/3001.
- Ask before the package install in 17.2 and before every live action in 17.3.

## Open questions

- **The uncommitted DesignPicker change in `face-and-body`** (`components/theme/DesignPicker.tsx`,
  47 lines, on `design/copy-my-picks`): is someone still working on it? 17.2 cannot branch off
  her `main` cleanly until it is committed, stashed by its owner, or dropped. Blocks 17.2 only.
- **Her practitioners and rooms, and which treatments each does.** Facts from her, asked at
  onboarding; added to the setup file before 17.3. Blocks nothing in 17.1 or 17.2.
- **Her hours and notice, confirmed by her** (F-519, F-520). Her week comes from one Instagram
  post that Google disagrees with on six days, and the two hours' notice is a starting point.
  Asked at onboarding; must be answered before 17.3, and changed in Settings or the setup file.
- **Deposits** (project plan question 16) and **her Google calendar**: asked at onboarding. A
  yes to either adds work before 17.3 (a payment item; publishing Google's consent screen).
- **Go-live order.** The plan holds real clients until IA a la Orden has taken real bookings
  (Frank, 2026-10-23). 17.3 waits on that, and on her site's own launch (her item 13).
