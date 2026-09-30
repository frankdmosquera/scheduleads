# Scheduleads - Project Overview

<!-- blueprint:source-hash 25cedf40bc793d8507d8f044bd7f2ae9bc2057a698c95d233ab2d7ba6b235be0 -->

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

- **Owner/operator (business owner)** - runs a small local service business.
  Signs in a few times a week. Wants to know who booked, when, what they want,
  and where every lead stands. Sees only their organization. Is also the
  business's first person.
- **Customer/lead** - books on the business's own site. Never authenticates,
  never sees the product's name. Public routes only.
- **Frank, two hats** - as a business, organization number one, no special case
  anywhere. As the **platform admin**, the Better Auth `admin` role and a
  separate admin area that reads across organizations; the only role that can
  delete an organization. Never a client business's owner: a client's business
  is created under the client's email.
- **Crew member** - later, assigned to jobs. No sign-in until a business asks.
- **Self-serve customer** - Phase 9. Signs up and pays without the agency.

Tenants, in order: agents-web (tenant zero), primo-painters (first paying
client, live and ranking), face-and-body (family, cost-cover, 45 services),
the-latam-painters (after its site is finished).

## Features

Build-plan order. Items 1 to 3 are ports of the first repo's features 1 to 3.
The headline feature is 5, booking creation: the first moment a stranger's
booking becomes the business's lead. **Done: 0a, 0b, 1, 2. Next: 3.**

- **0a. Commercial position** - done. Booking sits in the $240/mo plan.
- **0b. Design pass** - done. Static mockups in `prototypes/`, via `/prototype`.
1. **Multi-tenant auth, with the org fix** - done. Email-OTP sign-in, the
   `admin` role, the auto-active-organization hook, the subscription
   middleware with the one tier `agency`. Signup closed.
2. **Booking links, resources and availability rules** - done. Three tables,
   the public read route, the dev seed, the typed `hc<AppType>` seam proved by
   a rename that broke the frontend build. One resolution function for
   bookable hours that every later item calls.
3. **Calendar connection** - one Google calendar per person, never per
   business; the first is the business owner's, each optional. One connection
   asks to read busy times and to add and edit events. Cipher, OAuth connect
   and disconnect, provider seam, free/busy verified against a real event. Not
   a two-way sync.
- **3b. Client access: provisioning** - the admin path that creates a client
  user and puts them in the business made for them, under their email. Hard
  prerequisite for Phase 5 and any client-facing deploy.
4. **CRM spine** - `contact`, `pipeline_stage`, `activity` and their routes.
   Nothing visible yet.
5. **Booking creation** - validate a slot against bookable hours, who does
   what, free people and places, and Google busy times; the commitments table;
   create contact, lead, booking and timeline entry. Owner-made bookings too.
6. **Confirmations** - `.ics` email to the customer, notification to the
   business, always from the business.
7. **Self-serve cancel and reschedule** - tokenized link; cancel removes the
   Google event.
8. **Scheduled messages** - the background job runner, the confirmation text
   and the reminder the evening before. The runner is the load-bearing half.
9. **The booking component** - unstyled trigger, themed modal, one provider
   per host, the face-and-body contract, layout stored on the booking link.
10. **Tenant zero wired: agents-web** - siteConfig slug, the contact seam
    calls the API, the site's theme reaches the modal.
11. **Leads list and contact page** - leads with stages, the contact's
    timeline and next steps, adding a lead by hand.
12. **Settings** - services and buffers, people and places, who does what,
    bookable hours and one-off dates, one-click closed and opened days, the
    holiday picker (none by default), notice, horizon, time zone, calendar.
- **12b. Calendars** - every person and place has an in-app calendar; the
  owner adds phone estimates, walk-ins and time off by hand.
13. **Primo Painters** - the first paying client swaps Calendly for the modal.
    Needs item 22's calendar half first.
14. **Pipeline board** - drag and drop between stages the business names.
15. **Email from the CRM** - Resend sends logged on the timeline; BCC capture.
16. **Quotes** - line items, a total, a tokenized accept link.
17. **Face and Body** - Cal.com out; 45 services, practitioners, rooms.
18. **The Latam Painters** - after its site and siteConfig exist.
19. **Crew and job scheduling** - jobs of daily visits, crews as saved lists.
20. **Reports** - bookings per week, pipeline by stage, lead sources.
21. **WhatsApp** - Meta verification, a number, approved templates.
22. **Google OAuth verification** - calendar scopes (before 13), then Gmail's.
23. **Packages ladder and the admin area** - tiers above `agency`.
24. **Hosted booking page** - `/book/<slug>`.
25. **Self-serve onboarding and billing** - Stripe checkout, webhook.
26. **Two-way Gmail sync** - after 22.

## Data model

Postgres through Drizzle, schema and the one migration ledger in
`packages/shared` (one table per file under `db/*-tables/`). Every app table
carries `organizationId`, and that scope is a security boundary: it comes from
the session on the server, never from a client. Ids are text; timestamps are
`timestamptz`; built tables carry `createdAt` and `updatedAt`.

### Better Auth tables (built, feature 1)

`user`, `session`, `account`, `verification`, `organization`, `member`,
`invitation`, from the `organization`, `emailOTP` and `admin` plugins. Added:

- `organization.plan` (text, default `agency`) - the package tier. Server-set
  only; read by the subscription middleware.

### booking_link (built, feature 2)

A service, the handle a host site stores as `Service.bookingId`.

- `organizationId` (FK organization), `name`, `slug` (unique per organization)
- `description` (nullable), `durationMinutes` (int, > 0)
- `bufferBeforeMinutes`, `bufferAfterMinutes` (int, >= 0, default 0)
- `active` (bool; inactive reads as absent publicly)

### resource (built, feature 2)

One person or one place, never a group; a crew is a saved list of people.
Every business has at least one, its first person, made automatically.

- `organizationId` (FK), `name`, `kind` (`person` | `place`), `active`
- unique (`organizationId`, `id`), so rules can name a person of their own
  business

### availability_rule (built, feature 2)

**Bookable hours**: when customers can book online, not opening hours. A null
`resourceId` is the business's row (one per business); a set one is that
person's (one per person). A person without a week follows the business's.

- `organizationId` (FK), `resourceId` (FK resource, same organization, nullable)
- `weeklyHours` (json: weekday to minute windows; several a day is normal;
  null on a person's row means follow the business)
- `dateHours` (json, default `[]`) - one-off dates with their hours
- Business row only, refused on a person's row: `timezone` (IANA),
  `minimumNoticeMinutes` (>= 0), `horizonDays` (1 to 365), `closedDates`
  (`YYYY-MM-DD` list), `holidayCountry`, `holidayRegion` (province),
  `closedHolidays` (holiday names the owner picked, default `[]`)
- A closed date or picked holiday closes booking for everyone; a one-off date
  opens it again, for one person or the whole business.

### calendar_connection (feature 3)

One per person, never one for the business. Only Google is implemented;
Microsoft, CalDAV and ICS are new files behind the same interface.

- `organizationId` (FK), the person it belongs to (a `resource` of kind
  `person`, one connection each)
- `provider` (`google`), `credentials` (AES-256-GCM under `CALENDAR_TOKEN_KEY`)
- `grantedScope` - must hold both read busy times and add and edit events;
  a half-connection is refused
- `status` (`connected`, `needs_reconnect`, `disconnected`)

### contact, pipeline_stage, activity (feature 4)

- `contact`: `organizationId`, `name`, `email`, `phone` (nullable)
- `pipeline_stage`: `organizationId`, `name`, `position`. Seeded new,
  contacted, booked, done at provisioning; renamed and reordered per business.
- `activity`: the timeline **and the next-step queue**. `organizationId`,
  `contactId`, `type` (`booking_created`, `stage_changed`, `email_sent`,
  `email_received`, `note`, `sms_sent`, `call`, `task`), `payload` (json),
  `actorUserId` (nullable), `occurredAt` for a thing that happened, or
  `dueAt` and `doneAt` for a thing still to do.

### lead, booking, commitment (feature 5)

- `lead`: `organizationId`, `contactId`, `stageId`, `source` (`widget`,
  `hosted`, `manual`), `details`
- `booking`: `organizationId`, `leadId`, `bookingLinkId`, the people it holds
  and a place when the service needs one, `startsAt`, `endsAt`, `status`
  (`confirmed`, `cancelled`, `rescheduled`), `location` (the customer's
  address, required), `calendarEventId`, `cancelToken` (unique). Made by a
  customer online or by the owner; the same booking either way.
- `commitment`: one row per person or place for every booking and every
  stretch of time off, buffers inside its time. The database refuses two
  overlapping active rows for the same person or place. Cancelled rows stop
  blocking.

### quote, quote_item (feature 16)

- `quote`: `organizationId`, `leadId`, `status` (`draft`, `sent`, `accepted`,
  `declined`, `expired`), `currency`, `taxRate`, `subtotal`, `tax`, `total`,
  `expiresOn`, `acceptToken` (unique), `openedCount`, `sentAt`, `acceptedAt`
- `quote_item`: `quoteId`, `position`, `description`, `note`, `quantity`,
  `unit`, `rate`, `amount`

### job (feature 19)

A lead that became work, from an accepted quote or by hand, made of visits,
one per day, each with its own people. How visits sit beside `commitment` is
decided in item 19's spec.

> **Locked.** Organization scope on every table. `availability_rule` is scoped
> to a business and optionally one person, never to a booking link, and
> business-wide settings live only on the business's row. Stages, resources
> and the timeline are tables, never enums. `activity` carries both what
> happened and what is still owed. One `commitment` table refuses overlaps.
> The booking layout is a stored value on the booking link from item 9.
> Nothing about a business's schedule is fixed or on by default (decision 30).

## Tech stack

- **Next.js 16 + React 19** (`frontend`, Vercel) - the CRM, the admin area,
  later the hosted booking page. Tailwind v4, shadcn.
- **Hono** (`backend`, Railway) - the one API the widget and the CRM call.
  Persistent Node: the database pool, token refresh and the job runner live
  here.
- **Hono RPC** - the backend exports `AppType`; `frontend/lib/api-client.ts`
  builds a signed-in client and a public one that never sends the cookie.
- **npm workspaces** - `frontend`, `backend`, `packages/shared` (Drizzle
  schema, migrations, Zod schemas, subscription limits, the crypto). Subpath
  exports to the compiled `dist/`, no barrel.
- **PostgreSQL + Drizzle** - Railway in production; local PostgreSQL 18
  (`scheduleads_dev`) in development, seeded by `db:seed`. Railway only through
  its tunnel, on purpose.
- **Better Auth** on the backend - `organization`, `emailOTP`, `admin`.
- **date-holidays** (backend) - the holiday names a business can pick.
- **Vitest** - unit and route tests beside the code.
- **Resend + React Email** - confirmations, `.ics`, notifications, CRM sends.
- **Google Calendar API** - OAuth, live free/busy at booking time, and writing
  each booking into the booked person's calendar.
- **Twilio** - SMS in Phase 2; WhatsApp can ride the same account.
- **TanStack Query, dnd-kit** (item 14), **shadcn charts** (item 20) - asked
  first. No state manager until one is needed.

Carried over as ports: the first repo's features 1 to 3, codestash's
auto-active-organization hook, `requireOrgRole` and plan-limits shape, Primo's
provider architecture and `contact-lead` email, face-and-body's
swappable-booking contract, agents-web's contact-inquiry seam.

Traps not to relearn: Google silently drops an unknown scope (it is
`calendar.events.freebusy`, not `calendar.freebusy`); a `"use server"` module
exports only async functions.

## Monetization

Agency-provisioned first. The product ships inside the agency's monthly plan;
Frank creates the organization and bills as the agency. The $240/mo plan is
the first tier of a ladder; each tier unlocks modules through the
subscription-limits config, and moving a client up is Frank changing
`organization.plan` until Stripe arrives in Phase 9. Primo pays the first tier;
the clinic pays cost-cover privately. Off-page SEO stays Frank's work; the tool
only reports it.

## UI/UX

The widget is unstyled behaviour plus a themed modal: the trigger brings the
action, the host site brings the look, and the modal never names its provider.
Calendly shape: two screens, pick the time then answer the questions, with a
rail carrying the logo, the service, the duration and the chosen slot. The
one-screen week strip is parked behind the stored layout value.

The login is the CRM, Pipedrive and Salesmate the reference feel. Mockups in
`prototypes/` off one `theme.css`: deep indigo accent, roomy light default, an
explicit light/dark toggle. Every schedule choice is the owner's: pickers,
switches and one-click presets, nothing on by default.

Frontend routes, final names decided at `/feature`:

- `/sign-in` - email OTP (signup closed)
- `/leads`, `/leads/[id]` - list, contact page with timeline (item 11)
- `/settings` - item 12; `/calendar` - item 12b; `/pipeline` - item 14
- `/admin/*` - platform admin only (item 23); `/book/[slug]` - item 24

API (`backend/app.ts`, one chain so `AppType` carries every route):

- Built: `/api/auth/*` (Better Auth), `GET /me`,
  `GET /public/:slug/booking-links`,
  `GET /public/:slug/booking-links/:bookingLinkId`, `GET /health`
- Planned: calendar connect, callback and disconnect (item 3),
  `POST /public/:slug/bookings` (item 5), cancel and reschedule by token
  (item 7), authenticated CRUD for leads, contacts, stages, resources and
  settings

## Deployment

- **frontend** on Vercel (Root Directory `frontend`), **backend** and
  **Postgres** on Railway (Root Directory `backend`). Provisioned.
- Build: `npm run build --workspace=frontend`; `npm run build
  --workspace=backend` then `npm run start --workspace=backend`. Each builds
  `packages/shared` first; the frontend also builds the backend's route types.
- Health: `GET /health`, no database on purpose.
- Env, names only: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `APP_ORIGIN`, `COOKIE_DOMAIN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `CALENDAR_TOKEN_KEY`, `RESEND_API_KEY`, `TWILIO_*`, `PORT`, `WIDGET_ORIGINS`;
  the frontend gets only `NEXT_PUBLIC_API_URL`. Losing `CALENDAR_TOKEN_KEY`
  makes every stored calendar connection undecryptable.
- CORS: public routes allow `WIDGET_ORIGINS` and the dashboard, never with
  credentials; dashboard routes allow only `APP_ORIGIN`, with the cookie. Browser-to-API or proxied through the host's
  server action is decided in Phase 3.
- Google OAuth stays in Testing until item 22's calendar half, finished
  before item 13: Testing-mode tokens expire after seven days. Gmail's
  restricted scopes need verification plus an annual security assessment.
- A failed calendar check never reports "free": the booking fails with
  "temporarily unavailable" and the business is emailed to reconnect.

> TODO: the inbound email path for the BCC capture address (Resend inbound or
> Cloudflare Email Routing), decided in item 15.

## Open questions

Carried from the plans, each with the moment it gets answered:

- Whose Calendly has been receiving Latam's bookings. Before item 18.
- Browser-to-API or proxied through the host's server action. Phase 3.
- Whether the clinic takes deposits at booking. At her onboarding, before 17.
- Which analytics source feeds the visitor package. When that package exists.
- What Primo needs on day one beyond booking and the leads list. Before 13.
- The inbound path for the BCC capture address. Item 15.
- How the agency's own business gets its services and hours before Settings.
  Item 10.
- Whether buffers may fall outside bookable hours, and how "any available"
  picks a person. Item 5.
- How a holiday pick survives a renamed holiday (F-32). Item 12.

Found between the plans on this run, for Frank to settle in the plans:

- **Who connects a second person's calendar (item 3).** The build plan says
  "others connect their own," but crew members have no sign-in (project plan
  §2, and crew sign-in is named, not planned). A person is a `resource` with
  no link to a user, so the spec must say who presses connect for them.
- **The project plan still says the platform admin seeds a client's services
  and hours** (§2), while item 2 and decision 30 say the client always sets
  them in the app.
- **The project plan's Carried over table is stale for items 2 and 3**: it
  lists the seed CLI (dropped Sep 25) and "None" as the fix for
  `calendar_connection`, which is now per person and asks for the write
  permission too.
- **No table is named yet for who does what (skills, rooms) or for standby**,
  both read in item 5. Item 5's spec names them.
- **Item 9 leaves open whether the customer picks the person**, while item 5
  already says the customer picks a person or "any available". Item 9's
  question may already be answered by item 5.
