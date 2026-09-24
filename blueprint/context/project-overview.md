# Scheduleads - Project Overview

<!-- blueprint:source-hash 3e673de208c0c76379bb2db8e268cd25e1689db3d634bee28d7084c289c0f899 -->

> A CRM for the small service businesses the agency builds sites for. Booking
> is its first module: a themed component in the client's own site, one API
> behind it, and a login where the business sees its leads, moves them through
> a pipeline, and changes its hours.

## Problem

The agency promises "everything included, nothing rented," then every site it
ships rents booking from Calendly or Cal.com: an iframe that cannot match the
site, one flat list for every service, and a lead that lands in a third party's
calendar. Small service businesses stitch together a booking tool, a contact
form that emails into a void, a CRM they never open, and a Google listing with
the wrong hours. Nobody owns the journey from "I found you" to "the job is done
and paid." This product does, starting with the booking.

## Users

- **Owner/operator** - runs a small local service business. Signs in a few
  times a week. Wants to know who booked, when, what they want, and where
  every lead stands. Sees only their organization.
- **Customer/lead** - books on the business's own site. Never authenticates,
  never sees the product's name. Public routes only.
- **Frank, as the agency** - two hats. As a business, organization number one,
  no special case anywhere. As the platform, the Better Auth `admin` role and
  a separate admin area that reads across organizations. Only role that can
  delete an organization.
- **Crew member** - later, assigned to jobs. No sign-in until asked for.
- **Self-serve customer** - Phase 9. Signs up and pays without the agency.

Tenants, in order: agents-web (tenant zero), primo-painters (first paying
client, live and ranking), face-and-body (family, cost-cover, 45 services),
the-latam-painters (after its site is finished).

## Features

Build-plan order, 26 items. Items 1 to 3 are ports of the first repo's
features 1 to 3.
The headline feature is 5, booking creation: the first moment a stranger's
booking becomes the business's lead.

- **0b. Design pass** - static mockups of the modal in two themes, the leads
  list, the board and settings. Runs through `/prototype`, not `/feature`.
1. **Multi-tenant auth, with the org fix** - email-OTP sign-in,
   create-organization, the `admin` role, the auto-active-organization hook,
   and the subscription middleware with the one tier `agency`.
2. **Booking links and availability rules** - the two tables, the public read
   route, the seed CLI, the shared-package layout. Also the typed RPC seam:
   the backend exports `AppType`, the frontend consumes it with `hc<AppType>`,
   proved by renaming a route and watching the frontend fail to compile.
3. **Calendar connection** - encrypted Google OAuth, connect and disconnect,
   the provider seam, free/busy verified against a real event.
4. **CRM spine** - `contact`, `pipeline_stage`, `resource`, `activity` and
   their routes. Nothing visible yet.
5. **Booking creation** - validate a slot against rules, free resources and
   the live calendar; create contact, lead, booking and timeline entry.
6. **Confirmations** - `.ics` email to the customer, notification to the
   business.
7. **Self-serve cancel and reschedule** - tokenized link in the confirmation.
8. **Scheduled messages** - the background job runner, the confirmation text
   and the reminder the evening before. The runner is the load-bearing half:
   nothing else in the plan creates one, and reminders, follow-ups and the
   calendar token refresh all need it.
9. **The booking component** - unstyled trigger, themed modal, one provider
   per host, the face-and-body contract, layout stored on the booking link.
10. **Tenant zero wired: agents-web** - siteConfig slug, the contact seam
    calls the API, the site's theme reaches the modal.
11. **Leads list and contact page** - every lead with its stage, the contact's
    timeline and open next steps, and adding a lead by hand.
12. **Settings** - hours with several windows a day, services, resources,
    blackout dates, statutory holidays, the booking horizon, the calendar.
13. **Primo Painters** - the first paying client swaps Calendly for the modal.
14. **Pipeline board** - drag and drop between stages the business names.
15. **Email from the CRM** - templated sends via Resend, logged; BCC capture
    files replies on the contact.
16. **Quotes** - line items, a total, and a tokenized link the customer opens
    in the business's own theme to accept.
17. **Face and Body** - Cal.com out, 45 services in, practitioners as
    resources.
18. **The Latam Painters** - after its site is finished and its siteConfig
    exists.
19. **Crew and job scheduling** - jobs on resources across days.
20. **Reports** - bookings per week, pipeline by stage, lead sources.
21. **WhatsApp** - Meta verification, a number, approved templates.
22. **Google OAuth verification** - calendar scopes, then Gmail's restricted
    scopes.
23. **Packages ladder and the admin area** - tiers above `agency`, who is on
    what, move a client up.
24. **Hosted booking page** - `/book/<slug>`.
25. **Self-serve onboarding and billing** - Stripe hosted checkout, webhook
    writes `organization.plan`.
26. **Two-way Gmail sync** - after 22.

## Data model

Postgres through Drizzle. Every app table carries `organizationId` and that
scope is a security boundary: it comes from the session on the server, never
from a client. All ids are text (Better Auth style); timestamps are `timestamptz`.

### Better Auth tables

`user`, `session`, `account`, `verification`, `organization`, `member`,
`invitation`. Managed by the `organization`, `emailOTP` and `admin` plugins.
One added field:

- `organization.plan` (text, default `agency`) - the package tier. Server-set
  only. Read by the subscription middleware on every module route.

### booking_link

An event type, the per-service handle a host site stores as `Service.bookingId`.

- `id`, `organizationId` (FK organization)
- `name` (text), `slug` (text, unique per organization)
- `durationMinutes` (int), `description` (text, nullable)
- `active` (bool), `createdAt`

### availability_rule

One per organization, enforced unique. Shared by every booking link.

- `id`, `organizationId` (FK, unique)
- `timezone` (IANA text)
- `weeklyHours` (json: weekday to a list of `{ startMinute, endMinute }`).
  Several windows a day is the normal case. Primo's live schedule is Sunday
  daytime, three evenings, two early mornings and Saturday afternoon.
- `minNoticeMinutes` (int), `bufferMinutes` (int)
- `horizonDays` (int) - how far ahead a customer may book
- `holidayCountry` (text, nullable) - statutory holidays resolved from it
- `blackoutDates` (date[])

### calendar_connection

One per organization. Only Google is implemented; other providers are new
files behind the same interface.

- `id`, `organizationId` (FK, unique)
- `provider` (text: `google`)
- `credentials` (text, AES-256-GCM under `CALENDAR_TOKEN_KEY`)
- `grantedScope` (text), `status` (text: `connected`, `needs_reconnect`,
  `disconnected`)
- `createdAt`, `updatedAt`

### contact

- `id`, `organizationId` (FK)
- `name` (text), `email` (text), `phone` (text, nullable)
- `createdAt`

### pipeline_stage

Seeded with new, contacted, booked, done at provisioning. A table, not a fixed
set, so a business can rename and reorder.

- `id`, `organizationId` (FK)
- `name` (text), `position` (int)

### lead

- `id`, `organizationId` (FK), `contactId` (FK contact)
- `stageId` (FK pipeline_stage)
- `source` (text: `widget`, `hosted`, `manual`), `details` (text)
- `createdAt`, `updatedAt`

### resource

A crew, a practitioner, an estimator. Capacity is the number of resources free
at a time; an organization with none behaves as one.

- `id`, `organizationId` (FK)
- `name` (text), `active` (bool)

### booking

- `id`, `organizationId` (FK), `leadId` (FK lead), `bookingLinkId` (FK)
- `resourceId` (FK resource, nullable until resources exist)
- `startsAt`, `endsAt` (timestamptz)
- `status` (text: `confirmed`, `cancelled`, `rescheduled`)
- `location` (text) - the customer's own address, typed at booking. A trade
  travels to the job, so this is required, not optional.
- `calendarEventId` (text, nullable), `cancelToken` (text, unique)
- `createdAt`

### activity

The timeline **and the next-step queue**. Every module writes here; the CRM
screens read here. Two kinds of row in one table: most record something that
already happened, while a row carrying `dueAt` is something still to do.

- `id`, `organizationId` (FK), `contactId` (FK contact)
- `type` (text: `booking_created`, `stage_changed`, `email_sent`,
  `email_received`, `note`, `sms_sent`, `call`, `task`)
- `payload` (json), `actorUserId` (FK user, nullable)
- `occurredAt` (timestamptz, nullable) - set on a thing that happened
- `dueAt`, `doneAt` (timestamptz, nullable) - set on a thing still to do
- `createdAt`

### quote (item 16)

- `id`, `organizationId` (FK), `leadId` (FK lead)
- `status` (text: `draft`, `sent`, `accepted`, `declined`, `expired`)
- `currency` (text), `taxRate` (numeric), `subtotal`, `tax`, `total` (numeric)
- `expiresOn` (date), `acceptToken` (text, unique), `openedCount` (int)
- `sentAt`, `acceptedAt`, `createdAt`

### quote_item

- `id`, `quoteId` (FK quote), `position` (int)
- `description` (text), `note` (text, nullable)
- `quantity` (numeric), `unit` (text), `rate` (numeric), `amount` (numeric)

### job (Phase 9)

- `id`, `organizationId`, `leadId`, `resourceId`, `startsOn`, `endsOn`, `status`

> **Locked.** Organization scope on every table. `availability_rule` is
> org-scoped, not per booking link; per-resource hours come later on top of it.
> Stages, resources and the timeline are tables from item 4 onward so later
> modules never migrate an enum. `activity` carries both what happened and
> what is still owed, from item 4, so the next-step queue is never a second
> table bolted on. The booking layout is a stored value on the booking link
> from item 9, never a hardcoded shape.

## Tech stack

- **Next.js 16 + React 19** (`frontend`) - the CRM, the admin area, later the
  hosted booking page. Tailwind v4, shadcn v4 on Base UI.
- **Hono** (`backend`, Railway) - the one API the widget and the CRM call.
  Persistent Node: database pool and calendar token refresh live here.
- **npm workspaces** - `frontend`, `backend`, `packages/shared` (Drizzle
  schema, migrations, Zod schemas, the Hono `AppType`, the crypto). Subpath
  exports to the compiled `dist/`, no barrel.
- **PostgreSQL + Drizzle** on Railway. Development uses a local PostgreSQL 18
  seeded by `db:seed`; Railway only through its tunnel, on purpose. When port
  5433 listens but every query resets, restart the tunnel.
- **Better Auth** - `organization`, `emailOTP`, `admin` plugins. Codestash's
  config is the reference, owner role without `organization:delete`.
- **Resend + React Email** - confirmations, `.ics`, notifications, CRM sends.
- **Google Calendar API** - OAuth plus live free/busy at booking time.
- **Twilio** - SMS in Phase 2; WhatsApp can ride the same account later.
- **TanStack Query, dnd-kit, shadcn charts** - installed at the feature that
  needs them (14, 14, 19), asked first. No state manager until one is needed.

Carried over as ports, not copies: the first repo's features 1 to 3,
codestash's `use-auto-active-organization`, `require-org-role` and
`plan-limits` shapes, Primo's `calendly-provider` architecture and
`contact-lead` email, face-and-body's swappable-booking contract, and
agents-web's contact-inquiry seam.

## Monetization

Agency-provisioned first. The product ships inside the agency's monthly plan;
Frank creates the organization and bills as the agency. The $240/mo plan is
the first tier of a ladder of packages; each tier unlocks modules through the
subscription-limits config, and moving a client up is Frank changing
`organization.plan` until Stripe arrives in Phase 9. Primo pays the first tier;
the clinic pays cost-cover privately. Off-page SEO stays Frank's work; the tool
only reports it. Self-serve with Stripe hosted checkout and a webhook writing
`organization.plan` is Phase 9.

## UI/UX

The widget is unstyled behaviour plus a themed modal: the trigger brings the
action, the host site brings the look, and the modal never names its provider.
The widget takes the Calendly shape: two screens, pick the time then answer
the questions, with a rail carrying the business's logo, the service and the
duration, gaining the chosen slot on screen two. The one-screen week strip is
parked behind the stored layout value, not dropped.

The login is the CRM with Pipedrive and Salesmate as the reference feel.
Mockups are done, in `prototypes/`, off one `theme.css`: deep indigo accent,
roomy light default, an explicit light/dark toggle with no system setting.
Reference links live in `blueprint/reference/links.md` and screenshots of
Primo's live Calendly and of Pipedrive in `blueprint/reference/`.

Frontend routes, final names decided at `/feature`:

- `/sign-in`, `/create-organization` - email OTP, first organization
- `/leads` - the list; `/leads/[id]` - contact page with timeline and composer
- `/pipeline` - the board (item 14)
- `/settings` - hours, services, resources, blackout dates, calendar
- `/admin/*` - platform hat, `admin` role only (item 22)
- `/book/[slug]` - hosted booking page (item 23)

API shape (`backend`), public routes keyed by organization slug:

- `GET /public/:slug/booking-links`, `GET /public/:slug/availability`,
  `POST /public/:slug/bookings`
- `GET|POST /bookings/:cancelToken` - cancel and reschedule
- authenticated CRUD under `/leads`, `/contacts`, `/stages`, `/resources`,
  `/settings`, plus `/calendar/connect`, `/calendar/callback`,
  `/calendar/disconnect`

## Deployment

- **frontend** on Vercel, **backend** on Railway, **Postgres** on Railway. All
  provisioned in the first repo's time.
- Build and start: `npm run build --workspace=frontend`,
  `npm run build --workspace=backend` then `npm run start --workspace=backend`.
- Env, names only: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CALENDAR_TOKEN_KEY`,
  `RESEND_API_KEY`, `TWILIO_*`, `PORT`, `WIDGET_ORIGINS`,
  `NEXT_PUBLIC_API_URL`. Losing `CALENDAR_TOKEN_KEY` makes every stored
  calendar connection undecryptable.
- CORS allow-list from `WIDGET_ORIGINS`. Whether the host calls the API from
  the browser or proxies through its own server action is decided in Phase 3.
- Google OAuth consent stays in Testing until Phase 9; refresh tokens expire
  after seven days in that mode. Gmail's restricted scopes need verification
  plus an annual security assessment.
- A failed calendar check never reports "free."

> TODO: health path for the Railway service, and the inbound email path for
> the BCC capture address (Resend inbound or Cloudflare Email Routing).

## Open questions

Carried from the plans, each with the moment it gets answered:

- Whose Calendly has been receiving Latam's bookings. Before item 18.
- Browser-to-API or proxied through the host's server action. Phase 3.
- Whether the clinic takes deposits at booking. At her onboarding, before 17.
- Which analytics source feeds the visitor package. When that package exists.
- What Primo needs on day one beyond booking and the leads list. Before 13.
- The inbound path for the BCC capture address. Item 15's spec.
- Which job runner carries item 8. A table-backed poller in the Hono process
  is the cheap answer on Railway; decided in that item's spec.

Plan-shape notes, not conflicts:

- Item 0b is a design pass, not a feature. It stays in the checklist as the
  Phase 0 exit gate and runs through `/prototype`; `/feature` should skip it.
- Item 4 is data and routes only. It is deliberate: item 5 reads it the next
  day.
- Item 8 carries a runner as well as two messages. It is the one item whose
  hidden half other items depend on, so it should not be cut when Phase 2
  runs long. Cut the WhatsApp item instead; it is already in Phase 8.
