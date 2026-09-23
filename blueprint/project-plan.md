# Project Plan

Scheduleads, second start. Written 2026-09-18 from a full read of the
workspace: the agency site, the three client sites, codestash, and the first
scheduleads repo. Revised the same evening, after the discovery conversation
that widened the product from a booking module to a CRM. The first repo is
kept, untouched, at `ai-web-agency/scheduleads` and on GitHub as
`scheduleads-archive`. What it proved is carried over by decision, listed
under "Carried over" below. Nothing else is.

## 0. Honest starting state

Not the optimistic version.

- The first repo built three of sixteen features in ten days, then stalled for
  ten more. Nothing in its code is wrong. It stalled because feature 3 needed
  a manual calendar reconnect, and because nobody was sure the client used
  Google Calendar. That question was written into the spec on 2026-09-08 and
  never asked.
- thelatampainters.com does not embed its own Calendly. Both of its Book Now
  buttons open `calendly.com/primo-painting`, a different client's account.
  The first plan's problem statement ("pays for and embeds Calendly")
  described a subscription that may not exist under that name.
- No client site knows scheduleads exists. Zero references in Latam, Primo, or
  face-and-body. The relationship has been one-way.
- The agency site sells booking three ways at once on the same page: bundled
  into the build, an $800 add-on, and part of the $240/mo plan. Where booking
  sits commercially was undecided until 2026-09-18. It is the plan. Section 6.
- No design has ever existed for this product. The first repo's dashboard is
  framework defaults. There is no mockup of a booking screen.
- No price has ever been set. Codestash, the other multi-tenant app in the
  workspace, has three tiers priced per seat and a Stripe plan. This product
  has "undesigned."
- Three real Calgary businesses are ready to consume this: two painters and a
  medical aesthetics clinic. All three currently rent booking from a third
  party or have none.
- Primo Painters is live, ranking, and its owner is ready to take work from
  Monday 2026-09-21. The site started ranking before he was ready, and he
  knows. It is the first client that pays for the plan. The first draft of
  this plan had it last.
- Face and Body is Frank's sister's clinic. It pays cost-cover, around $50 a
  month for the tools it uses. No launch deadline on this product's side.
- The first draft sized the business's login at "two screens for a long
  time." The discovery conversation retired that. Section 3.

## 1. Problem

The agency promises "everything included, nothing rented" on its about page
and its contact page. Then every site it ships rents booking from Calendly or
Cal.com: an iframe that cannot match the site, a per-service flow that dumps
every visitor into one flat list, and a lead that lands in a third party's
calendar instead of anywhere the business owns. The promise is written and
unbacked.

Small service businesses stitch together a booking tool, a contact form that
emails into a void, a separate CRM they never open, and a Google listing with
the wrong hours. Nobody owns the client journey from "I found you" to "the job
is done and paid."

The first repo framed this as "replace Calendly on one painter's site." That
framing is retired. The product is a CRM for the small service businesses the
agency builds sites for. Booking is its first module, because every lead
starts as a visitor on a site the agency built and a booking is the first
thing the business needs from that visitor. The pipeline, the email, the crew
schedule and the reports grow around it. The journey from "I found you" to
"the job is done and paid" is what the product owns.

## 2. Users

- **Owner/operator.** Runs a small local service business. The person who does
  the work, not a marketing department. Non-technical, short on time. Wants
  to know who booked, when, what they want, and where every lead stands.
  Signs in to scheduleads a few times a week and expects it to already know
  things.
- **Customer/lead.** Books on the business's own website. Never authenticates.
  Never sees the word scheduleads. Sees the business's brand and a calendar.
- **Frank, as the agency.** Two hats in one app. As a business, the agency is
  organization number one: its own leads and bookings live in the CRM exactly
  like a client's. As the platform, Frank creates each organization, seeds
  its services and hours, embeds the widget in the site he built, hands over
  sign-in, and sees who is on which package. That hat is the Better Auth
  `admin` role and a separate admin area. The only person who can delete an
  organization.
- **Crew member.** Later. Assigned to jobs through the crew schedule. Not a
  sign-in until a business asks for one.
- **Self-serve customer.** Later. A business the agency did not build a site
  for, who signs up and pays on their own. Phase 9.

The four tenants, in order:

| Tenant | Business | Booking today | Site status |
|---|---|---|---|
| agents-web | The agency itself. Tenant zero | A contact form to Resend. No calendar, no persistence. Its plans say "Calendly now, own system later" and no Calendly was ever wired | Built, not live. The offer, pricing, and the only public mention of scheduleads sit on unmerged branches |
| primo-painters | Painting, Calgary. Live and ranking. The first paying client | One shared Calendly modal, well engineered, single URL in siteConfig | Live on main, owner ready 2026-09-21. 58 commits ahead on a design branch |
| face-and-body | Medical aesthetics clinic, Calgary SE. Family, cost-cover | Cal.com embed behind a provider-agnostic seam, chosen 2026-09-17 | In build. Six commits. Booking explicitly designed to be swapped for this product |
| the-latam-painters | Painting, Calgary | Two hardcoded Calendly popups, both pointing at Primo's account | Unfinished. Phone numbers are still `1234567890` in five files. No siteConfig |

## 3. Features

The build plan holds the phases. This section holds the shape.

**Phase 0 decides. Phases 1 to 7 are the agency-provisioned product: the
booking loop, the CRM in two releases, and every tenant wired, with the first
paying client wired between the two CRM releases rather than after both.
Phase 8 grows the CRM for the tenants that exist. Phase 9 is packages and
self-serve. Everything after is named, not planned.**

The product is one app with three parts that must stay separate in code:

1. **The booking module.** A component a client site imports. It shows the
   business's services and availability, checks the business's real
   calendar, takes the booking, and creates the lead. It is themed by the
   host site and never names its provider. This is what face-and-body's
   decisions file already specifies: "pages ask to book a service; they do
   not know who answers."
2. **The business's login. The CRM.** Where the owner sees leads, moves them
   through a pipeline, reads and sends email on a contact, changes hours and
   services, and later schedules crews and reads reports. Pipedrive and
   Salesmate are the reference feel: a board, drag and drop, nothing that
   needs a manual.
3. **The admin area.** Frank's platform hat. Organizations, packages, who is
   using what, moving a client up a package. Behind the `admin` role, in its
   own route group, reading across organizations. Tenant code never reads
   across organizations and never asks "is this the agency." The agency's
   own organization gets no special case anywhere. Break that rule once and
   the two hats bleed into each other.

CRM modules, in the order they arrive:

- **Leads and pipeline.** Contacts, a lead per job, stages the business
  defines, and an activity timeline on every contact that every other module
  writes to.
- **Email.** Send from the CRM under the business's name, logged on the
  timeline. Replies captured through a per-business BCC address. Two-way
  mailbox sync is a Phase 9 item behind Google's verification.
- **Crew and job scheduling.** Resources (a crew, a practitioner, an
  estimator) that bookings and jobs are assigned to. The customer-facing
  calendar books an appointment; the internal calendar puts the job on a
  crew across days.
- **Quotes.** Line items and a total, sent as a link the customer opens in
  the business's own theme and accepts. The half of "found you to paid"
  that the first draft left out.
- **Messaging.** The confirmation and the reminder, by text, in Phase 2.
  WhatsApp later, next to them.
- **Reports.** Bookings, pipeline by stage, lead sources, on shadcn charts.
- **Packages.** Section 6.

Three delivery modes, in order of need:

- **Imported component** in a site the agency builds. Every current tenant.
  Phases 3 and 5.
- **Hosted page** at `/book/<slug>`. A link for an email signature or a
  Google profile. Also the entry point for a self-serve customer. Phase 9.
- **Embed script** for a site the agency did not build. Named, not planned.

## 4. Data

Carried over from the first repo, verified against Railway Postgres:

- Auth and organization tables from Better Auth's `organization` plugin:
  `user`, `session`, `account`, `verification`, `organization`, `member`,
  `invitation`. Email-OTP sign-in, no password anywhere.
- `booking_link`: an event type. Name, duration, description, active flag.
  Several per organization sharing one availability pool. **This is the
  per-service handle face-and-body reserved as `Service.bookingId`.** A
  clinic with 45 services is 45 rows here, each with its own duration.
- `availability_rule`: unique per organization and resource. A null resource is
  the business's own hours; a set one is that person's, and a resource without
  its own row falls back to the organization's. Timezone,
  weekly hours as minute windows per day, minimum notice, buffer, blackout
  dates, a booking horizon (how far ahead a customer may book), and a
  country code for statutory holidays.
  **Several windows per day is the normal case, not an edge case.** Primo's
  own live schedule, read from his Calendly on 2026-09-18, is Sunday 9:30
  to 17:00, Monday, Tuesday and Thursday 17:00 to 19:30, Wednesday and
  Friday 07:30 to 08:30, Saturday 16:00 to 18:30. A working painter fits
  estimates around jobs. Any model that assumes one window a day is wrong
  for the first paying client.
- `calendar_connection`: unique per organization and resource, same shape as
  `availability_rule`. Provider discriminator,
  encrypted credentials blob under AES-256-GCM, granted scope, status. Only
  Google is implemented. Microsoft, CalDAV, and ICS are new files behind the
  same interface.

Planned, shapes locked in the first repo's overview and kept:

- `contact`: name, email, phone, organization-scoped.
- `lead`: the job details, source, tied to a contact, and its current stage.
- `booking`: scheduled time, status, the calendar event id, a cancel token,
  the resource it is assigned to, and the location the customer gave.
  The location is the customer's address, typed by them at booking, because
  a trade travels to the job. Primo's Calendly calls this "ask invitee" and
  it is a required field on his form.

New here:

- `organization.plan` as an additional Better Auth field, defaulting to
  `agency`, never settable from the client. Codestash's pattern. Reads as the
  package. `agency` means "provisioned by the agency, on the first rung."
  The plan-limits config and the gate every module route checks are built
  in Phase 1 with this one rung, so packages are never retrofitted. Section
  6 adds rungs beside it.
- `pipeline_stage`: per organization, ordered, named by the business. Seeded
  with new, contacted, booked, done at provisioning. A lead points at one.
  The first draft had these four as a fixed set; a table costs the same now
  and a migration later.
- `resource`: per organization, built in item 2 beside availability rather than
  with the CRM spine, because it is a scheduling primitive and not a CRM one.
  A crew, a practitioner, an estimator, a chair. Name and active flag. A
  booking and a job point at one. Its own hours, buffer and timezone are
  expressible from the first migration through `availability_rule`, and nothing
  builds a screen for them until a tenant has two people.
  Capacity is how many resources are free at a time, so a clinic with three
  practitioners takes three bookings at 2pm and a painter with one estimator
  takes one. An organization with no resources behaves as one.
  **Which resources are free, not merely how many**, is what the booking check
  answers, so the same query serves a capacity pool and a named person.
- `activity`: the timeline **and the next-step queue**. Per contact, typed:
  booking created, stage changed, email sent, email received, note, SMS,
  call, task. Every module writes here; the CRM screens read here.
  Two kinds of row, one table. Most rows record something that already
  happened and carry only `occurredAt`. A row may instead carry `dueAt` and
  `doneAt`, which makes it a thing still to do: call them back Thursday,
  chase the quote. Pipedrive treats these as one concept for good reason.
  A CRM that only records the past is a filing cabinet; the owner opens it
  to find out what he owes someone today.
- `quote`: per lead. Status, currency, tax rate, the totals, an expiry, an
  accept token, and a count of how many times the customer opened it.
  Line items hang off it: description, quantity, unit, rate, amount, and an
  order. Accepting is a customer action on a tokenized link, so it needs no
  login and no account, exactly like cancelling a booking.
- `job`: later, with crew scheduling. A lead that became work, on a resource,
  across days.

Locked, carried from the first repo:

- Every app table is organization-scoped and the scope is a security
  boundary. `organizationId` is derived server-side from the session, never
  read from anything a client sends.
- `availability_rule` is scoped to an organization and optionally a resource,
  never to a booking link. Per-resource hours are a row in the same table, not
  a second table and not a migration. This was a contradiction in the first
  draft: it promised per-resource hours "on top of" a table declared unique per
  organization, which the database would have refused.

## 5. Tech

Same stack as the first repo. The research found nothing to change and a few
things to add.

- **Next.js 16** (`frontend`): the CRM, the admin area and, in Phase 9, the
  hosted booking page.
- **Hono** (`backend`) on Railway: the one API the widget and the CRM both
  call. Persistent Node, so the database pool and the calendar token refresh
  live in one process.
- **npm workspaces**: `frontend`, `backend`, `packages/shared` holding the
  Drizzle schema, migrations, the crypto, and the API contract. Subpath
  exports point at the compiled `dist/`, no barrel, because the workspaces
  disagree about extensions, and both apps build the package first. The first
  repo exported source instead, which only worked until a built server tried
  to import a `.ts` file.
- **PostgreSQL + Drizzle** on Railway. Development runs against a local
  PostgreSQL 18, the same major version, built from the migrations and seeded
  with `db:seed`, so no real data is ever needed to work. Railway is reached
  through its tunnel only on purpose. The tunnel dies. It presents as port 5433
  listening and every query resetting. Restart it.
- **Better Auth**: `organization` plugin, `emailOTP`, and, new, the `admin`
  plugin for the platform superadmin. Codestash's config is the reference,
  including the owner role with `organization:delete` removed.
- **Resend + React Email**: confirmations, the `.ics` invite, the business
  notification, cancel and reschedule links, and in Phase 6 the email the
  business sends from the CRM. Primo's `emails/contact-lead.tsx` is the
  template pattern: hex colours not tokens, timezone pinned, a `tel:` button.
- **Google Calendar API**: OAuth plus a live free/busy query at booking time.
  Carried over whole.
- **Twilio** for SMS. Kept from the first plan, Phase 2, and the first thing
  to cut if Phase 2 runs long. WhatsApp can ride the same Twilio account
  later.

Frontend libraries decided here, installed at the feature that needs them,
asked first like every dependency:

- **TanStack Query** for the CRM screens. The pipeline board needs optimistic
  drag and drop with cache invalidation, which is exactly its job.
- **dnd-kit** for the board's drag and drop.
- **shadcn charts** for reports. They sit on Recharts.
- **No state manager** until a real cross-component client state shows up.
  Zustand is the answer when it does.

Added:

- **A design pass before Phase 2.** Static mockups of the booking modal in
  two tenant themes, the leads list, the pipeline board and settings. The
  Blueprint's prototype step. The first repo never ran it.
- **Codestash's three helpers, ported not rewritten.** The
  auto-active-organization hook, `requireOrgRole`, and the plan-limits config
  file shape.
- **A siteConfig contract for host sites.** The widget reads the tenant slug
  and theme from the host's `siteConfig.ts`. Primo, primo-v2, and
  face-and-body have one. Latam needs one before it can be a tenant.
- **An inbound email path for the BCC capture address.** Resend inbound if it
  covers it, otherwise Cloudflare Email Routing into the API. TODO, decided
  at the email item.

## 6. Monetize

**Motion A first: agency-provisioned.** The product ships inside the agency's
monthly plan. Frank creates the org and bills the client as the agency. No
signup page, no Stripe, no self-serve pricing until Phase 9. This is what the
agency's own offer notes say: "bundled into the top packages as the client's
own CRM," and "sold on its own afterwards."

**Decided 2026-09-18: booking is part of the $240/mo plan, and the plan is
the first rung of a ladder of packages.** A client on the plan gets
scheduleads. A client not on any package keeps whatever booking they have,
Calendly included. The plan is what pays for keeping each client's calendar
connected and the product maintained; a booking tool nobody is paid to keep
alive is a liability.

Each package unlocks modules: booking, the pipeline, email, crews, reports,
and later SEO reporting and visitor analytics. `organization.plan` holds the
rung. Moving a client up is Frank changing that value until Stripe arrives in
Phase 9. The price of each rung above the first is not set. Primo pays the
first rung. The clinic pays cost-cover, which is a private arrangement, not a
rung the product knows about.

The gate exists from Phase 1. One config file maps each rung to the modules
and limits it unlocks, codestash's `plan-limits.ts` shape, and every module
route checks it before answering. Which module sits on which rung and what
each rung costs are edits to that file, not code, which is why they can be
decided late without working backwards. In the CRM a locked module says
which package includes it. For an agency-provisioned client the way up is a
conversation with Frank; in self-serve it is Stripe.

Off-page SEO is work Frank does, not work the tool does. An SEO package pays
for the hours; the tool posts to the Google profile, tracks rankings and
shows the client the report that proves them. If the tool is ever to do the
work itself, that is a different product and gets its own plan.

The services page currently also sells booking as a bundled setup item and as
an $800 add-on. Both come off. That is an agents-web change and belongs in
its build plan, not this one.

**Motion B, Phase 9: self-serve.** Per-seat tiers on Stripe hosted checkout,
following codestash's locked design: a trial tier, every limit in one config
file, a webhook that writes `organization.plan`. The numbers are not
codestash's numbers. They are set when a second business that the agency did
not build a site for asks to pay.

Long-term, named not planned: SEO tooling, Google Business Profile
management, visitor analytics, marketing automation, AI front of house. The
agency's project plan calls these steps 3 and 4 of its revenue arc and says
they are this product. They are not in any phase here because nothing in
phases 0 to 9 depends on them.

## 7. UI/UX

**The widget is unstyled behaviour plus a themed modal.** Primo's
`BookNowTrigger` is the shape: the trigger brings only the action, the host
site brings the look. The modal reads the host's theme tokens. A customer on
primopainters.ca sees Primo's blue; on the clinic's site, the clinic's
palette. The word scheduleads appears nowhere a customer can see it.

**The modal never names its provider**, and the host's buttons say "Book
now," not "Book on X." Carried from face-and-body's decisions.

**One provider component per host site**, wrapping `{children}` so every
server component stays a server component. One context hook any button can
call. A readiness signal with a hard ceiling so a stuck spinner is
impossible. Primo's `calendly-provider.tsx` is the reference. The Calendly
parts come out, the architecture stays.

**The login is the CRM.** A leads list, a pipeline board with drag and drop
between stages the business names, a contact page with its timeline and an
email composer, and a settings page for hours, services, resources and the
calendar connection. Pipedrive and Salesmate are the reference feel. Sign-in
and create-organization already exist. The first draft said "two screens for
a long time"; the CRM decision replaced that.

**Design happens once, before Phase 2, as static mockups.** The booking modal
in two tenant themes, the agency's and Primo's since Primo is the second
tenant, plus the leads list, the pipeline board and settings. Until those
exist, no feature that renders UI gets spec'd.

**Reports are graphs, later.** shadcn charts on a dashboard: bookings per
week, pipeline by stage, lead sources.

## 8. Deployment

- `frontend` to Vercel. `backend` to Railway. Database on Railway Postgres.
  All carried from the first repo and already provisioned.
- The widget calls the API cross-origin. CORS allow-list from
  `WIDGET_ORIGINS`. **Open for Phase 3:** whether the host site calls the API
  from the browser or proxies through its own server action. Primo's contact
  form holds the rationale for the second: a public URL anyone can POST to
  has no auth and no rate limit. Decide when the first tenant is wired.
- Google OAuth consent stays in Testing with test users until Phase 9.
  Testing-mode refresh tokens expire after seven days, so a tenant's
  connection will need reconnecting during development. Google's app
  verification is slow and is Phase 9's first task, not its last. Gmail's
  read and modify scopes are restricted scopes: verification plus an annual
  third-party security assessment. That is why two-way mailbox sync sits
  behind verification and not before it.
- Env, names not values: `DATABASE_URL`, `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `CALENDAR_TOKEN_KEY`, `RESEND_API_KEY`, `TWILIO_*`, `PORT`,
  `WIDGET_ORIGINS`, `NEXT_PUBLIC_API_URL`, and from item 1 `APP_ORIGIN` and
  `COOKIE_DOMAIN`. `CALENDAR_TOKEN_KEY` was generated
  once, lost when the env file was rewritten by hand, and regenerated. Losing
  it means every stored calendar connection stops decrypting.
- A failed calendar check never reports "free." The booking fails safely
  with a "temporarily unavailable" message and the business gets an email to
  reconnect. Carried, and the fail-safe half is already built.

## Carried over

What the first repo proved and what comes across on purpose. Each is a port
with the known fix applied, not a copy.

| From | What | Fix applied on the way |
|---|---|---|
| scheduleads feature 1 | Email-OTP sign-in, create-organization, route guards by session state | Add codestash's auto-active-organization hook so sign-in resolves the org. The first repo worked around this inside feature 3 |
| scheduleads feature 2 | `booking_link`, `availability_rule`, the public read route, the seed CLI, the shared-package layout | None. Verified against Railway |
| scheduleads feature 3, steps 1 to 4 | `calendar_connection`, AES-GCM token cipher, OAuth connect with signed single-use state, the scope check that refuses a half-connection, disconnect that revokes at Google | None. Verified against the real Google account nine ways |
| scheduleads feature 3, step 5 | The provider seam, free/busy query, token refresh, check script | Unverified. Phase 1 verifies it. The calendar was deliberately disconnected during the step 4 test and never reconnected |
| codestash | `use-auto-active-organization.ts`, `require-org-role.ts`, the `plan-limits.ts` shape, the `admin` plugin superadmin, the owner role without delete | Port. Rename to this repo's naming standard |
| primo-painters | `emails/contact-lead.tsx`, the `calendly-provider.tsx` architecture, `BookNowTrigger.tsx`, the three-gate server action | Take the pattern. Remove every Calendly-specific line |
| face-and-body | The swappable-booking contract: `Service.bookingId` as an opaque handle, pages ask to book a service and do not know who answers, the UI never names the provider | Adopt as the widget's public contract |
| agents-web | `send-contact-inquiry-action.ts` and `contact-submission-schema.ts` | The seam the agency's own site swaps to the API at Phase 3 |

Two things the first repo recorded that must not be relearned:

- Google silently drops an unrecognised OAuth scope and consents to the rest.
  The scope is `calendar.events.freebusy`, not `calendar.freebusy`. The first
  connection succeeded holding nothing.
- A `"use server"` module may only export async functions. A constant
  exported beside an action breaks the build.

## Decided 2026-09-18

1. **Tenant order: the agency's own site, then Primo, then the clinic, then
   Latam.** The agency site is tenant zero because it has no client to
   coordinate, no ranking to risk, and it is the site that promises "nothing
   rented" while renting. Frank is, realistically, the first customer. Primo
   second, revised the same evening from last: it is live, ranking, and the
   first client that pays for the plan. The swap is one config value plus
   the provider component, one commit to revert, and Primo keeps Calendly
   until the loop is proven on the agency site. Primo is wired after the
   CRM's first release, the leads list and settings, and before the pipeline
   board and email, so the paying client never waits on the second release.
   The clinic third: family, cost-cover, 45 services forcing the per-service
   model with no deadline. Latam waits on its own site being finished.
2. **Calendars.** The agency tenant uses Frank's own Google account, the one
   the first repo already connected and verified against. Phase 1 proves
   free/busy on that calendar. For clients, the calendar question is asked
   at their onboarding, not assumed. The clinic books through Square today
   and likely has no Google calendar to check. Free/busy is therefore a
   Phase 1 gate for the agency tenant only, not a Phase 2 gate for the
   product.
3. **Booking sits in the plan.** Section 6.
4. **Scheduleads is a CRM.** Booking first, because that is where every lead
   starts; the pipeline, email, crews and reports grow around it. Section 3.
5. **Three tables move early.** Pipeline stages, resources and the activity
   timeline are built in Phase 2, before anything reads them, so the CRM
   fits later without a rewrite. Section 4.
6. **Email is send-only plus BCC capture first.** Two-way Gmail sync is Phase
   9, behind Google's restricted-scope verification. Section 8.
7. **One app, two hats.** The agency is organization number one; the platform
   is an admin area behind the admin role; tenant code never special-cases
   the agency. Section 3.
8. **Packages are a ladder**, `organization.plan` holds the rung, and the
   gate that reads the ladder is built in Phase 1 with one rung so nothing is
   retrofitted. Section 6.
9. **WhatsApp is named next to SMS**, not a launch feature. Per-message cost
   in Canada is small (marketing about 2.5 cents, utility under half a
   cent); the cost is Meta verification, a dedicated number and approved
   templates. Phase 8.
10. **Frontend libraries.** TanStack Query, dnd-kit and shadcn charts, each
    installed at the feature that needs it. No state manager until one is
    needed. Section 5.
11. **The booking widget takes the Calendly shape.** Two screens, pick the
    time then answer the questions, with a rail down the left carrying the
    business's logo, the service, the duration and, on screen two, the
    chosen slot. Mocked in `prototypes/modal-month.html`. The one-screen
    week strip beside it in `prototypes/modal-primo.html` is parked, not
    dropped: the layout is stored on the booking link from item 9, so
    bringing it back later costs a branch rather than a rewrite. Only one
    layout gets built now, because no tenant has asked for the other and
    two flows is two things to keep working while one client pays.
12. **Quotes are item 16**, in Phase 6 beside the board and the email.
    Section 4 holds the table.
13. **Reminders are not optional.** Primo already sends a confirmation text
    on booking and a reminder 20 hours ahead through Calendly. Item 8 grew
    from "SMS confirmation" to cover both, and to build the background job
    runner they need, which nothing else in the plan created.

## Open questions

14. **Whose Calendly has been receiving Latam's bookings?** Both buttons
    point at Primo's account. Either Latam's bookings have been landing in
    Primo's calendar, or Latam never had its own. Ask before Latam is
    onboarded, in Phase 7.
15. **Browser-to-API, or proxied through the host's server action?** Section
    8. Decided at Phase 3, not before.
16. **Does the clinic take deposits at booking?** Square suggests she might.
    Asked at her onboarding, like the calendar question. If yes, payment at
    booking becomes an item before her swap.
17. **Which analytics source feeds the visitor package?** Search Console,
    Vercel analytics or Plausible. Decided when that package is built.
18. **What does Primo need on day one beyond booking and the leads list?**
    Asked before his swap.
19. **The inbound path for the BCC capture address.** Section 5.
