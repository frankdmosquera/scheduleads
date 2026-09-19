# Project Plan

Scheduleads, second start. Written 2026-09-18 from a full read of the
workspace: the agency site, the three client sites, codestash, and the first
scheduleads repo. That repo is kept, untouched, at `ai-web-agency/scheduleads`
and on GitHub. What it proved is carried over by decision, listed under
"Carried over" below. Nothing else is.

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
framing is retired. The product is the agency's own booking module, dropped
into every site the agency builds, with the business's leads behind a login
the business owns.

## 2. Users

- **Owner/operator.** Runs a small local service business. The person who does
  the work, not a marketing department. Non-technical, short on time. Wants
  to know who booked, when, and what they want. Signs in to scheduleads
  rarely and expects it to already know things.
- **Customer/lead.** Books on the business's own website. Never authenticates.
  Never sees the word scheduleads. Sees the business's brand and a calendar.
- **Frank, as the agency.** Creates each organization, seeds its services and
  hours, embeds the widget in the site he built, hands over sign-in. Platform
  superadmin. The only person who can delete an organization.
- **Crew member.** Later. Assigned to jobs. Not in this plan's phases.
- **Self-serve customer.** Later. A business the agency did not build a site
  for, who signs up and pays on their own. Phase 6.

The four tenants, in order:

| Tenant | Business | Booking today | Site status |
|---|---|---|---|
| agents-web | The agency itself. Tenant zero | A contact form to Resend. No calendar, no persistence. Its plans say "Calendly now, own system later" and no Calendly was ever wired | Built, not live. The offer, pricing, and the only public mention of scheduleads sit on unmerged branches |
| face-and-body | Medical aesthetics clinic, Calgary SE. First client | Cal.com embed behind a provider-agnostic seam, chosen 2026-09-17 | In build. Six commits. Booking explicitly designed to be swapped for this product |
| the-latam-painters | Painting, Calgary | Two hardcoded Calendly popups, both pointing at Primo's account | Unfinished. Phone numbers are still `1234567890` in five files. No siteConfig |
| primo-painters | Painting, Calgary. Live and ranking. Last | One shared Calendly modal, well engineered, single URL in siteConfig | Live on main. 58 commits ahead on a design branch |

## 3. Features

The build plan holds the phases. This section holds the shape.

**Phase 0 decides. Phases 1 to 5 are the agency-provisioned product. Phase 6
is self-serve. Everything after is named, not planned.**

The product is two things that must stay separate in code:

1. **The booking module.** A component a client site imports. It shows the
   business's services and availability, checks the business's real
   calendar, takes the booking, and creates the lead. It is themed by the
   host site and never names its provider. This is what face-and-body's
   decisions file already specifies: "pages ask to book a service; they do
   not know who answers."
2. **The business's login.** Where the owner sees leads and bookings and
   changes their hours. Small. Two screens for a long time.

Three delivery modes, in order of need:

- **Imported component** in a site the agency builds. Every current tenant.
  Phases 3 and 5.
- **Hosted page** at `/book/<slug>`. A link for an email signature or a
  Google profile. Also the entry point for a self-serve customer. Phase 6.
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
- `availability_rule`: one per organization, enforced unique. Timezone,
  weekly hours as minute windows per day, minimum notice, buffer, blackout
  dates.
- `calendar_connection`: one per organization. Provider discriminator,
  encrypted credentials blob under AES-256-GCM, granted scope, status. Only
  Google is implemented. Microsoft, CalDAV, and ICS are new files behind the
  same interface.

Planned, shapes locked in the first repo's overview and kept:

- `contact`: name, email, phone, organization-scoped.
- `lead`: the job details, source, tied to a contact.
- `booking`: scheduled time, status, the calendar event id, a cancel token.

New here:

- `organization.plan` as an additional Better Auth field, defaulting to
  `agency`, never settable from the client. Codestash's pattern. Reads as
  "provisioned by the agency, billed on the agency's plan." Phase 6 adds paid
  tiers beside it.

Locked, carried from the first repo:

- Every app table is organization-scoped and the scope is a security
  boundary. `organizationId` is derived server-side from the session, never
  read from anything a client sends.
- `availability_rule` is org-scoped, not per booking link.

## 5. Tech

Same stack as the first repo. The research found nothing to change and three
things to add.

- **Next.js 16** (`frontend`): the business's login and, in Phase 6, the
  hosted booking page.
- **Hono** (`backend`) on Railway: the one API the widget and the login both
  call. Persistent Node, so the database pool and the calendar token refresh
  live in one process.
- **npm workspaces**: `frontend`, `backend`, `packages/shared` holding the
  Drizzle schema, migrations, the crypto, and the API contract. Subpath
  exports point at source files, no barrel, because the workspaces disagree
  about extensions. Proven in the first repo.
- **PostgreSQL + Drizzle** on Railway, reached locally through the SSH
  tunnel. The tunnel dies. It presents as port 5433 listening and every query
  resetting. Kill the stale `ssh.exe`, restart it.
- **Better Auth**: `organization` plugin, `emailOTP`, and, new, the `admin`
  plugin for the platform superadmin. Codestash's config is the reference,
  including the owner role with `organization:delete` removed.
- **Resend + React Email**: confirmations, the `.ics` invite, the business
  notification, cancel and reschedule links. Primo's `emails/contact-lead.tsx`
  is the template pattern: hex colours not tokens, timezone pinned, a `tel:`
  button.
- **Google Calendar API**: OAuth plus a live free/busy query at booking time.
  Carried over whole.
- **Twilio** for SMS. Kept from the first plan, Phase 2, and the first thing
  to cut if Phase 2 runs long.

Added:

- **A design pass before Phase 2.** Static mockups of the booking modal in
  each tenant's theme and of the login's two screens. The Blueprint's
  prototype step. The first repo never ran it.
- **Codestash's three helpers, ported not rewritten.** The
  auto-active-organization hook, `requireOrgRole`, and the plan-limits config
  file shape.
- **A siteConfig contract for host sites.** The widget reads the tenant slug
  and theme from the host's `siteConfig.ts`. Primo, primo-v2, and
  face-and-body have one. Latam needs one before it can be a tenant.

## 6. Monetize

**Motion A first: agency-provisioned.** The product ships inside the agency's
monthly plan. Frank creates the org and bills the client as the agency. No
signup page, no Stripe, no self-serve pricing until Phase 6. This is what the
agency's own offer notes say: "bundled into the top packages as the client's
own CRM," and "sold on its own afterwards."

**Decided 2026-09-18: booking is part of the $240/mo plan.** A client on the
plan gets scheduleads. A client not on the plan keeps whatever booking they
have, Calendly included. The plan is what pays for keeping each client's
calendar connected and the product maintained; a booking tool nobody is paid
to keep alive is a liability. The services page currently also sells booking
as a bundled setup item and as an $800 add-on. Both come off. That is an
agents-web change and belongs in its build plan, not this one.

**Motion B, Phase 6: self-serve.** Per-seat tiers on Stripe hosted checkout,
following codestash's locked design: three plans, a trial tier, every limit
in one config file, a webhook that writes `organization.plan`. The numbers
are not codestash's numbers. They are set when a second business that the
agency did not build a site for asks to pay.

Long-term, named not planned: SEO tooling, Google Business Profile
management, marketing automation, AI front of house. The agency's project
plan calls these steps 3 and 4 of its revenue arc and says they are this
product. They are not in any phase here because nothing in phases 0 to 6
depends on them.

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

**The login is two screens for a long time.** A leads list with four states
(new, contacted, booked, done) and a settings page for hours, services, and
the calendar connection. Sign-in and create-organization already exist.

**Design happens once, before Phase 2, as static mockups.** Both screens of
the login and the booking modal in at least two tenant themes. Until those
exist, no feature that renders UI gets spec'd.

## 8. Deployment

- `frontend` to Vercel. `backend` to Railway. Database on Railway Postgres.
  All carried from the first repo and already provisioned.
- The widget calls the API cross-origin. CORS allow-list from
  `WIDGET_ORIGINS`. **Open for Phase 3:** whether the host site calls the API
  from the browser or proxies through its own server action. Primo's contact
  form holds the rationale for the second: a public URL anyone can POST to
  has no auth and no rate limit. Decide when the first tenant is wired.
- Google OAuth consent stays in Testing with test users until Phase 6.
  Testing-mode refresh tokens expire after seven days, so a tenant's
  connection will need reconnecting during development. Google's app
  verification is slow and is Phase 6's first task, not its last.
- Env, names not values: `DATABASE_URL`, `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `CALENDAR_TOKEN_KEY`, `RESEND_API_KEY`, `TWILIO_*`, `PORT`,
  `WIDGET_ORIGINS`, `NEXT_PUBLIC_API_URL`. `CALENDAR_TOKEN_KEY` was generated
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
| agents-web | `send-contact-inquiry-action.ts` and `contact-submission-schema.ts` | The seam the agency's own site swaps to the API at Phase 5 |

Two things the first repo recorded that must not be relearned:

- Google silently drops an unrecognised OAuth scope and consents to the rest.
  The scope is `calendar.events.freebusy`, not `calendar.freebusy`. The first
  connection succeeded holding nothing.
- A `"use server"` module may only export async functions. A constant
  exported beside an action breaks the build.

## Decided 2026-09-18

1. **Tenant order: the agency's own site first, then the clinic, then Latam,
   then Primo.** The agency site is tenant zero because it has no client to
   coordinate, no ranking to risk, and it is the site that promises "nothing
   rented" while renting. Frank is, realistically, the first customer. The
   clinic is the first client: launching now, contract already written, 45
   services forcing the per-service model right on day one. Latam waits on
   its own site being finished. Primo is last because it is live and
   ranking.
2. **Calendars.** The agency tenant uses Frank's own Google account, the one
   the first repo already connected and verified against. Phase 1 proves
   free/busy on that calendar. For clients, the calendar question is asked
   at their onboarding, not assumed. The clinic books through Square today
   and likely has no Google calendar to check. Free/busy is therefore a
   Phase 1 gate for the agency tenant only, not a Phase 2 gate for the
   product.
3. **Booking sits in the plan.** Section 6.

## Open questions

4. **Whose Calendly has been receiving Latam's bookings?** Both buttons point
   at Primo's account. Either Latam's bookings have been landing in Primo's
   calendar, or Latam never had its own. Ask before Latam is onboarded, in
   Phase 5.
5. **Browser-to-API, or proxied through the host's server action?** Section
   8. Decided at Phase 3, not before.
