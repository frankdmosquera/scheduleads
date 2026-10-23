# Feature: Google calendar approval

**From build-plan:** feature 22a

**Size:** light - paperwork and a three-page static site, no app logic: one small site, one trip
to Google Cloud, and a wait for Google's review.

**Branch:** feature/22a-google-calendar-approval

**Status:** verified

## Goal

Calendar connections stop dropping every seven days, and Google stops warning that the app is
unverified, so a client like Primo (item 13) connects to a normal Google screen. Google needs the
product to have a public home: booking-crm.com, with a home page, a privacy policy and terms,
under the product's name, Booking CRM (Frank, 2026-10-23). IA a la Orden, the agency that sells
and uses Booking CRM, is its first user and the first to stop reconnecting.

## In scope

- **The product's site** at `https://booking-crm.com`: a new, small Next.js project,
  `booking-crm-site` (stack 1, its own private GitHub repo, made with `newproj`, shaped like
  `tamales-avimery`'s one-pager), with three pages: `/` (what Booking CRM does, who runs it, links
  to the other two), `/privacy` and `/terms`. English first; Spanish later. No forms, no tests.
- **The privacy policy says what Google needs**: which Google data is read (calendar free/busy,
  the calendar list, the events the app makes), why (to show free times and add bookings), where
  it is kept and for how long, how to have it deleted, a contact, and Google's Limited Use
  statement for Google user data.
- **Vercel**: a new project from that repo on the bare `booking-crm.com` (its DNS is already in
  Vercel).
- **Google Cloud, the consent screen**: the name "Booking CRM", a support email, the home page,
  privacy and terms links, `booking-crm.com` as an authorized domain; then **publish** (Testing to
  In production), which ends the seven-day expiry; then **submit for verification** of the three
  calendar scopes with their reasons and a short screen recording.
- **The dashboard's browser title** says "Booking CRM", not "Scheduleads"
  (`frontend/app/layout.tsx`), so Google's reviewer sees one name everywhere.

## Out of scope

- The Gmail scopes (22b), the sales site's real content and its Spanish version, a logo (it would
  add Google's brand review; later), renaming the repo or anything internal.
- The other product sites (websites, AI agents, SEO): Frank's later channels.

## Build loop

Light, so one plan yes for the feature, each step built straight through to its commit, and the
independent review once, at `/complete`. **After the green light, nothing stops until the
review**: build, the step's one check, tick the box, the build log, commit and push. The trips
that are Frank's (`newproj`, Vercel, Google Cloud, the recording) are listed in the steps, so none
is a surprise. Google's review is a wait: the feature stays open until it answers.

## Build steps

- [x] **22a.1 booking-crm.com is live.** "Anyone opening booking-crm.com sees what Booking CRM
  is, with its privacy policy and terms one click away."
  - Frank: `gh repo create frankdmosquera/booking-crm-site --private`, then from
    `ai-web-agency`, `newproj booking-crm-site` (stack 1, no extra libraries, small, the repo URL).
  - Claude: the three pages in that repo, copied in shape from `tamales-avimery`; the workspace
    `CLAUDE.md` table gains the new project.
  - Frank (or Claude with the Vercel CLI on his yes): a Vercel project from the repo, domain
    `booking-crm.com`.
  **Done when:** `https://booking-crm.com`, `/privacy` and `/terms` each load over HTTPS with
  their content, and the home page links to both.

- [x] **22a.2 Google publishes, then approves.** "The consent screen says Booking CRM,
  connections stop expiring, and once Google approves, the unverified warning is gone."
  - Claude: the dashboard title; the reasons for each scope and the recording's script, written
    out for Frank.
  - Frank's Google Cloud trip: branding (name, support email, the three links, the authorized
    domain), publish, then submit verification with the recording (unlisted on YouTube).
  **Done when:** the consent screen shows "Booking CRM"; the app is In production. (The
  seven-day check and Google's approval moved to 22c on 2026-10-23, see Amendments.)

## Files / areas

- New repo `booking-crm-site`: `app/page.tsx`, `app/privacy/page.tsx`, `app/terms/page.tsx`,
  `app/layout.tsx`
- `frontend/app/layout.tsx` (the title)
- `ai-web-agency/CLAUDE.md` (the projects table)
- Outside: GitHub, Vercel, Google Cloud's consent screen, YouTube (unlisted)

## Data / contracts

- Public URLs: `https://booking-crm.com/`, `/privacy`, `/terms`. The consent screen's three links
  point there exactly, and `booking-crm.com` is its authorized domain.
- Scopes, unchanged: `calendar.events.freebusy`, `calendar.events.owned`,
  `calendar.calendarlist.readonly`.

## Testing

No app logic, so no saved tests. 22a.1: the three URLs load (curl). 22a.2: the consent screen
seen, the connection checked after seven days with `calendar:check` on the live database, and a
fresh connect after approval.

## Decisions (made while planning, Frank's to overrule)

1. **The product is called Booking CRM** (Frank, 2026-10-23), the name on Google's screen and the
   site; IA a la Orden and AgentsWeb are the agencies that sell it.
2. **Its own small site, not inside the dashboard app** (Frank, 2026-10-23): the product's sales
   site grows on its own (English and Spanish, SEO) and never mixes with the dashboard's code; the
   dashboard option lost on that. ialaorden.com lost because Google wants the app's own domain and
   the agency sells more than this one product.
3. **Publish before verification is done**: publishing alone ends the seven-day expiry; until
   Google approves, users see Google's unverified warning (IA a la Orden only, for now).
4. **No logo yet**: a logo makes Google review the brand as well, a longer wait for nothing needed.
5. **The support email is Frank's Gmail**, unless he picks another on the trip; reversible.

## Amendments

- 2026-10-23, 22a.1: Claude ran every step (Frank's say-so): the repo, the scaffold, Vercel and the
  domain. `newproj` failed on `@hookform/resolvers` 6.0's peer clash, so the site is plain Next.js
  without the Blueprint kit or the default libraries (Frank: keep it simple). Contact on the pages:
  `hola@ialaorden.com`.
- 2026-10-23, 22a.2: done as far as it can be today: the consent screen's branding says Booking
  CRM with booking-crm.com's three links and its authorized domain, booking-crm.com is verified in
  Search Console, the app is published (In production), and IA a la Orden reconnected after
  publishing. The dashboard's title and icon say Booking CRM. Frank closed the feature here so the
  slot frees for 12i: submitting Google's verification, waiting for its answer, the seven-day
  check on IA a la Orden's connection and the fresh connect without the warning moved to a new
  build-plan item, 22c.

## Notes for the AI

- The privacy policy is not legal advice; Frank approves its words. Keep it short and true to
  what the code does.
- `newproj` asks its questions in the terminal; Frank runs it. Then build in that folder.
- Google may ask follow-up questions by email during the review; answer them with Frank.
- Never stage `blueprint/ai-voice-proposal.md`.
