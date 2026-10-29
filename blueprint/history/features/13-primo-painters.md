# Feature: Primo Painters

**From build-plan:** feature 13

**Size:** light - little new logic in Booking CRM: a setup file, the booking window wired into his
site, the "both" contact rule, and the live switch. Three steps: the rule is one real piece of
logic, and going live with a paying client's real bookings is a different risk.

**Branch:** feature/13-primo-painters

**Status:** verified

## Goal

Primo Painters' website (www.primopainters.ca) stops using Calendly. Every Book button and the
/booking page open Booking CRM's own booking window, and each estimate he is booked for lands in
Booking CRM as a booking and a lead, which Frank handles from the dashboard. The switch changes
nothing Primo did not choose: his hours, his holidays, his form's questions and his 30-minute
Free Estimate stay as Calendly has them today. His site gets lighter: Calendly loads 2.9 MB on
/booking today (speed baseline, Oct 29: /booking mobile 56, desktop 64; home 89 and 99).

## In scope

- **His setup file**, `packages/shared/client-setups/primo-painters.ts`, every value read from
  his live Calendly on 2026-10-29 (`calendly.com/primo-painting/30min`, public reads only):
  - one service, "Free Estimate", 30 minutes, a start every 30 minutes, address required
    (Calendly's "ask invitee" location, required);
  - one required booking question, "Tell us about your project" (his Calendly's own words);
  - `personChoice: "business_assigns"`, no people: the business is its one person, as IA a la
    Orden. His crews stay item 19;
  - his week, America/Edmonton: Monday to Friday 9:00 to 15:00, Saturday 9:00 to 17:00, Sunday
    9:00 to 12:00 (last starts 14:30, 16:30, 11:30, as Calendly offers them);
  - how far ahead: 60 days (Calendly's 86,400 minutes, a moving window);
  - minimum notice: Calendly's own value. The public read only pins it between 5 and 23.5 hours;
    the step reads it again at two times of day to pin it, and says what it set;
  - holidays: `holidayCountry: "CA"`, `holidayRegion: "AB"`, and the picks that match the days
    his Calendly closes. Remembrance Day and Christmas Day are confirmed closed in his live
    calendar; Boxing Day (Dec 26) is closed too and is not on Alberta's list, so it is a closed
    date, like Sep 30 (Truth and Reconciliation) the plan recorded. Family Day stays open (plan).
  - `contactRule: "email"`, provisionally (open question 1);
  - his look: his site's blue and his logo, on Settings > Look's three colours.
- **His site, in his repo** (`primo-painters`, its own branch `chore/booking-crm-window` off his
  `main`, in a git worktree so his checkout on `design-pass-2` and its uncommitted edits stay
  untouched):
  - the booking window from a file (`npm run pack:site ... -- <his worktree>`, window 0.2.9);
  - one provider in the root layout in place of `CalendlyProvider`, the same shape as Face and
    Body's `components/booking/BookingHost.tsx`, opening straight on Free Estimate;
  - every place that opened Calendly opens the window: `BookNowTrigger`, `HeaderBookNow`,
    `MobileNav`, `HeroCalendarImage`, `HeroCallToAction`, `ButtonBlue`;
  - the four inline Calendly embeds (`/booking`, `/contact`, the 404 page, `ServiceBanner`)
    give way to a Book button that opens the window; `/booking` opens it on load, as her `/book`;
  - Calendly gone: `components/calendly.tsx`, `components/calendly-provider.tsx`, its CSS in
    `app/globals.css`, its preconnect in `app/layout.tsx`, and the `react-calendly` dependency.
- **The laptop**: Primo made on the laptop's admin page, his file applied, his site on port 3403
  (`.claude/launch.json` "primo-painters-site", `WIDGET_ORIGINS` gains `http://localhost:3403`).
- **Live** (step 13.4, each live action on Frank's yes): his business on app.booking-crm.com with
  his Website, his file applied `--live`, his site's branch merged and deployed, one real
  booking watched, then his Calendly event turned off. A speed test after, the same four as the
  baseline.

## Out of scope

- The chat and WebMCP on his site: parts 3 and 4 of Frank's Primo plan, his repo only, a branch
  of their own after this feature, with the final speed test after them.
- His whole site following its Look colours (25f): named, not built here; his site keeps its own
  palette and only the window wears his Look.
- A thank-you page after a booking: the window's own booked screen, as his Calendly popup today.
- His crews (item 19); a "both email and phone" contact rule (open question 1 names it).
- design-pass-2's two unmerged commits and its links to the dead `primopainting.ca`: his repo's
  own business, not this feature's.

## Build loop

Light: each step runs from its plan's yes through its one check, the log, its commit and push
(here and in his repo) without stopping. After the green light, nothing stops until the review;
the review is once, at `/complete`. Only three things stop a step earlier: the plan turns out
wrong, a line only Frank crosses (live data, Railway, `main`, a merge, a package), or a blocking
finding. `workflow.checkpointCommits` is enabled: one commit per step, pushed straight after.

## Build steps

- [x] **13.1 Primo books through Booking CRM on the laptop.** His setup file, applied to the
  laptop; his site on its own branch with the window in and Calendly out.
  **Done when:** on http://localhost:3403 every Book button and /booking open the window on Free
  Estimate; the times shown follow his Calendly week (a Monday 9:00 to 14:30, a Sunday 9:00 to
  11:30, Nov 11, Dec 25 and Dec 26 closed); a test booking with an address and a project answer
  shows in the laptop dashboard as a booking and a lead; no page requests anything from
  calendly.com (network check on home, /booking, /contact and the 404); his site's
  `npm run build` passes; the setup dry run lists only what it adds; the shared package's tests
  pass.
- [x] **13.2 A business can require both an email and a phone.** Added at Frank's answer to
  open question 1 (Oct 29): a booking always needs a name and the way back the business picks:
  email, phone, either, or now both; every other box is the business's own question. Pieces: the
  rule gains `both` (shared schema, `helpers/missing-contact.ts`: email checked first, then
  phone; the API's booking check and the window run the same helper); the organization's
  `contactRule` column and its check constraint allow `both` (a migration, laptop now, live at
  13.3); Settings > Booking form offers "Email and phone"; the window marks both boxes required
  (0.2.10, packed into Primo's site; Face and Body keeps 0.2.9, its rule never sends `both`);
  Primo's file sets `both`.
  **Done when:** on http://localhost:3403 a booking without a phone, or without an email, is
  refused by the window and, sent straight to the API, by the API; with both it books; Settings
  shows and saves "Email and phone"; tests for the rule pass (shared, backend and the window's);
  the migration applies to the laptop database.
- [x] **13.3 A business names its project box, and may require it.** Added at Frank's ask (Oct 29):
  the window's own box ("What would you like done?", always optional) and Primo's question
  "Tell us about your project" ask the same thing. Each business gets two settings on Settings >
  Booking form: the box's words (empty: the window's own, in its language) and whether it is
  required (no by default). Pieces: two organization columns (`detailsLabel`, `detailsRequired`,
  a migration, laptop now, live at 13.4); the public business answer carries them; the window
  shows the words and asks for the box before sending; the API refuses a booking without it,
  except the owner's own; the setup file may say both (`detailsBox`), set while the business has
  no service, like the contact rule; window 0.2.11 into Primo's site. Primo: "Tell us about your
  project", required, and his separate question removed.
  **Done when:** on http://localhost:3403 his form shows one project box, "Tell us about your
  project", starred; a booking without it is refused by the window and by the API; Settings shows
  and saves the words and the choice; a business that set nothing still shows "What would you like
  done?", optional; tests for the rule pass.
- [ ] **13.4 Primo live.** Carried out inside `/complete`, each live action on Frank's yes: migrations 0040 and
  0041 on live through his tunnel before the merge, the merge deploying the API, then the steps below;
  Primo's calendar unticked from IA a la Orden. Every open question was answered first. His business on the live app
  (admin page) with Website `https://www.primopainters.ca`; his file `--live --apply` through
  Frank's tunnel; his branch merged to his `main` on Frank's yes and deployed by Vercel; one real
  booking made on www.primopainters.ca with Frank watching; his Calendly event turned off.
  **Done when:** the live /booking opens our window with his times; that booking shows on
  app.booking-crm.com and its emails arrive; no live page loads Calendly; the four speed tests,
  run as the baseline was, are written next to it.

## Files / areas

- `packages/shared/client-setups/primo-painters.ts` (new)
- `.claude/launch.json` (a "primo-painters-site" entry, port 3403); root `.env` `WIDGET_ORIGINS`
  (laptop only, not committed)
- His repo: `app/layout.tsx`, `app/globals.css`, `app/booking/page.tsx`, `app/contact/page.tsx`,
  `app/not-found.tsx`, `components/booking/BookingHost.tsx` (new), the six trigger components
  above, `components/ServiceBanner/service-banner.tsx`, `package.json` and its lockfile,
  `vendor/`; `components/calendly.tsx` and `components/calendly-provider.tsx` removed
- `blueprint/build-plan.md` (tick 13 at `/complete`)

## Data / contracts

- Uses only what exists: the setup file's schema
  (`client-setup-validation-schema.ts`), the public booking routes behind the window, the
  business's Website for his site's CORS (25b). No new route, table or migration.
- His slug: `primo-painters`, the same on the laptop and live; the window opens by the service's
  id read from the slug at load, as Face and Body (ids differ per database).
- The site reads the API address and slug as Face and Body's does (server layout props); the
  only browser-visible value is the public API address.

## Testing

- No new logic, so no new unit test. The setup dry run is the file's check (it type-checks and
  parses it); the shared suite (`npm run test --workspace=@scheduleads-app/shared`) reruns
  unchanged. (Corrected at 13.1: no saved test reads the setup files.)
- The rest is the Done-when, checked by hand in the browser on the laptop, with the URLs given.

## Notes for the AI

- His Calendly reads used: `api/booking/event_types/lookup?event_type_slug=30min&profile_slug=primo-painting`
  and `.../calendar/range` (30 days per call; times come back at a fixed -06:00 offset, so
  after Nov 1 subtract an hour). Saved in this session's scratchpad.
- Speed baseline: memory `primo-speed-baseline` (PageSpeed Insights web page, one run each; the
  keyless API quota runs out).
- His repo has its own `CLAUDE.md` rules (one bite at a time, ask before acting); this feature's
  yes covers the work named here in his repo, nothing else there.
- Removing `react-calendly` is said in the step report; nothing is installed except the window's
  own file.

## Open questions

Each before step 13.4; none blocks 13.1 to 13.3.

1. **What a customer must leave. Answered (Frank, Oct 29): email AND phone**, as his Calendly:
   name, email, phone, address and "Tell us about your project", all required. Booking CRM has
   no "both" rule yet (email, phone or either), so it needs one; how it is added is the open
   point.
2. **His login and where "New booking" goes. Answered (Frank, Oct 29): info@primopainters.ca** for both. Frank handles his bookings: Frank's own address,
   Primo's, or Primo's login with notices to Frank.
3. **His reminders. Answered (Frank, Oct 29): email only for now.** No texting number yet, so no
   texts and no text box on the form. Once there is a number, the form offers "text me" and only
   those who tick it get texts.
4. **His Google calendar. Answered (Frank, Oct 29): yes, info@primopainters.ca's own Google calendar**, connected at 13.3 from his dashboard. Calendly checks his calendar for busy times; Booking CRM does too
   once he connects it (he signs in once, Google asks him).
5. **His Calendly's holiday list and minimum notice**, read in his account (Frank, or a
   screenshot), so the picks match it beyond the 60 days the public calendar shows; the notice
   is provisionally 12 hours (the public times only pin it between 4.5 and 23).
6. **His clock (found at 13.1). Answered (Frank, Oct 29): his hours are Calgary time**, kept as
   built. His Calendly counts his hours in Denver's zone, which falls
   back an hour on Nov 1; Alberta no longer does (time zone data 2026c keeps Calgary on UTC-6).
   So from Nov 2 his live Calendly offers 10:00 to 15:30 Calgary time, not 9:00 to 14:30. The
   setup file keeps his own clock (9:00 to 15:00 Calgary); every one of the 650 open times
   matches Calendly's once that hour is taken out.
7. **Two project boxes (found at 13.1). Answered (Frank, Oct 29): one box**, the window's own, worded and required per business: step 13.3. The window always shows its own optional "What would
   you like done?"; his required "Tell us about your project" sits under it. Kept, so his
   required answer stays required; one box would be a small window change of its own.
8. **Primo's calendar on IA a la Orden. Answered (Frank, Oct 29): untick it at 13.4.** Frank does
   not go to Primo's estimates; his own call times follow only his own calendar.

## Implementation walkthrough

**What the spec's top lines miss (F-588).** The spec was written for 13.1 and live. Steps 13.2 and 13.3, added on Frank's yes the same day, brought two migrations, two settings and their tests, so "no new route, table or migration", "no new logic", the "both" rule under Out of scope and Primo's provisional `email` rule and separate question no longer hold: read this walkthrough and the step amendments as the record. His site reads the API address and slug from `data/siteConfig.ts`, not server layout props.

**13.1 Primo books through Booking CRM.** `packages/shared/client-setups/primo-painters.ts` carries every value read from his live Calendly on Oct 29: Free Estimate, 30 minutes, a start every 30, address required; Monday to Friday 9:00 to 15:00, Saturday 9:00 to 17:00, Sunday 9:00 to 12:00 in America/Edmonton; 60 days ahead; Canada's regular holidays (eight Alberta picks, Boxing Day and Sep 30 as closed dates, Family Day open); his blue `#0d378d` and his logo. His Calendly counts in America/Denver, which falls back an hour on Nov 1 while the time zone data (2026c) keeps Calgary on UTC-6, so from Nov 2 his live Calendly offers 10:00 to 15:30 Calgary time; Frank kept his own clock. All 650 open times over 60 days matched once that hour was taken out. His site (`primo-painters`, branch `chore/booking-crm-window`, a worktree off his `main` so his `design-pass-2` checkout stayed untouched): the window from `vendor/`, `components/booking/BookingHost.tsx` (one provider in the root layout; the first click reads his services once and opens his one service straight away, else his list), `OpenOnArrival.tsx` for /booking, the six Book buttons on `useOpenEstimate`, the four inline Calendly embeds replaced by a Book button, and `react-calendly`, its two components, its CSS and its preconnect removed.

**13.2 Email and phone, both.** The contact rule gains `both` (`helpers/missing-contact.ts`: email first, then phone; the API's `book-time.ts` and the window's `read-booking-form.ts` run the same helper), the column and its check constraint allow it (migration 0040), Settings > Booking form offers "An email and a phone, both", the window stars both boxes. Window 0.2.10 also gives the times list the business's colour as its scroll bar (`scrollbar-color` plus a WebKit fallback) and, under 760 px, lets the rail's parts join the page (`display: contents`): logo and back link on top, then the calendar or form, then the service's name and facts, its photo last. His service got one line of description from his own /booking page; a photo was tried and removed (it made the window taller with nothing to book).

**13.3 The project box.** `organization.detailsLabel` (1 to 80 characters, null for the window's own words) and `detailsRequired` (default false), migration 0041; Settings > Booking form edits both (empty words go back to the window's own); the public business answer carries them; the window shows the words and asks for the box before sending; `book-time.ts` refuses a customer's booking without it ("Answer: <its words>"), never the owner's own; a setup file may give `detailsBox`, set while the business has no service. Primo: "Tell us about your project", required, and his separate question removed, so his form is exactly name, email, phone, address and project, all required. Window 0.2.11.

**13.4 Live.** Carried out inside `/complete`, each live action on Frank's yes, after this archive: migrations 0040 and 0041 on live, the merge deploying the API, his business on app.booking-crm.com (`info@primopainters.ca`, Website `https://www.primopainters.ca`), his file applied live, his site merged and deployed, his Google calendar connected and unticked from IA a la Orden, one real booking, his Calendly event off, the speed test after. The build log records how each went.

**Proof.** Shared 232 tests, backend 1123, window 125; the dashboard's build and lint; the backend build; his site's build (its 28 type errors are the same as on his `main`, in old unused files). On http://localhost:3403: every Book button and /booking open the window; no page asks calendly.com for anything; a booking without a phone, or without the project box, is refused by the window and by the API; with them it lands as a lead with its address and answer.

**Reviewed.** One independent review of the whole feature, both repos (fresh subagent): passed. F-588 (P3, this spec's wording), F-589 (P2, his 12-hour notice is provisional; settled with Frank at 13.4) and F-590 (P3, no test for a setup file's project box or the owner's exemption) carried. Named for later: 13c, a calendar on the site's own page; next year's Boxing Day and Sep 30 are added by hand (a closed date does not repeat); Face and Body keeps window 0.2.9 until her site is re-packed.

## Findings

_No finding was resolved in this feature; F-588, F-589 and F-590 stay open in the ledger._

## Independent review

**Status:** passed
**Target commit:** eb2f0c68fb82ca0f0bd10c5e60ee0ec687b35332
**Base commit:** ed46fe37e5ec4bf4d99b097b2a5efdaf6f59eb44
**Base ref:** main
**Spec hash:** f253a73003ba395ae96e0626a9ebbed683c7f1d99c0ac754ebda96ab4893c5fc
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-29T18:40:00Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-29T19:46:45Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `ed46fe37e5ec4bf4d99b097b2a5efdaf6f59eb44..eb2f0c68fb82ca0f0bd10c5e60ee0ec687b35332`
delta in a fresh session or isolated subagent without the builder conversation. Run all Audit lenses
from scratch. Run Check when required above. Do not edit product code, accept findings, or reuse the
existing findings as the review scope. The feature also changed Primo Painters' site in
`../primo-painters/.claude/worktrees/booking-crm` (branch `chore/booking-crm-window`), range
`dcb69d29393ef0d3c9f0ae94f0b5562d67a70c83..94f32188bb6b15696106a3c7eb41509eb145555c`; review that
range too.

### Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain`: pass (target, base and spec hash match; only review.md differs)
- `npm run test --workspace=@scheduleads-app/shared`: pass (37 files, 232 tests)
- `npm run test --workspace=backend`: pass (99 files, 1123 tests, against local `scheduleads_dev`)
- `npm run test --workspace=@frankdmosquera/booking-component`: pass (23 files, 125 tests)
- `npm run build --workspace=frontend`: pass
- `npm run lint --workspace=frontend`: pass
- `npm run build --workspace=backend`: pass
- `npm run format:check`: pass
- Primo's worktree at 94f3218, `npm run build`: pass (clean tree, node_modules holds window 0.2.11)
- `vendor/frankdmosquera-booking-component-0.2.11.tgz` extracted to the scratchpad: version 0.2.11, `dist/` carries `detailsRequired` and `both`, CSS byte-identical to `packages/booking-component/booking-component.css` at the target

### Evidence

- `missingContact("both")` checks email then phone; the API (`book-time.ts:216`) and the window (`read-booking-form.ts:76`) call the same helper; the column's check constraint and zod enum both gain `both` (migration 0040)
- `detailsLabel` / `detailsRequired` (migration 0041): zod trims, caps at 80 and turns empty into null, matching the 1-to-80 check constraint; the API refuses a customer booking without details when required and exempts the owner's own (`source !== "manual"`); the window marks and checks the box before sending, its error has Spanish
- Settings save leaves both fields unchanged when absent; the public business answer adds only the two fields (no private data)
- Phone CSS: the rail's logo always renders (wordmark fallback), so the absolutely placed back button never lands on the calendar
- Primo's site: no remaining Calendly import, preconnect or dependency; `BookingHost` mirrors Face and Body's, reads the public list with `credentials: "omit"` and a 5-second timeout, retries on failure; `react-calendly` removed from package.json and lockfile

### Findings

- F-588 [P3] open: spec still says no migration, no new logic, no `both` rule
- F-589 [P2] open: open question 5 unanswered, Primo's minimum notice provisional before 13.4
- F-590 [P3] open: setup-file `detailsBox` and the owner's exemption untested

### Remaining risk

- Check not run (not required); no browser check of the phone layout or Primo's site in this review
- Old windows (0.2.9, Face and Body) do not know `both` or the project box; harmless only while no business on an old window sets them
- Open question 5 (F-589) must be settled before Primo goes live
- Run-state dashboard activity was not written: this reviewer was limited to findings.md and review.md
