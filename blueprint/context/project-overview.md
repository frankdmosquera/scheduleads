# Scheduleads - Project Overview

<!-- blueprint:source-hash 71a9cc16fe9ef91b43957c0c0251bc6c52383c790354c8139235b565771f636e -->

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

- **Owner/operator (business owner)** - runs a small local service business,
  signs in a few times a week, wants to know who booked and where every lead
  stands. Sees only their organization. Is also the business's first person.
- **Customer/lead** - books on the business's own site. Never authenticates,
  never sees the product's name. Public routes only.
- **Frank, two hats** - as a business, organization number one, no special case
  anywhere. As the **platform admin** (`user.role` `admin`), sets up clients and,
  later, an admin area that reads across organizations; the only role that can
  delete an organization. Never a client business's owner.
- **Crew member** - later, assigned to jobs. No sign-in until a business asks.
- **Self-serve customer** - Phase 9. Signs up and pays without the agency.

Tenants, in order: agents-web (tenant zero), primo-painters (first paying
client, live and ranking), face-and-body (family, cost-cover, 45 services),
the-latam-painters (after its site is finished).

## Features

Build-plan order. Items 1 to 3 are ports of the first repo's features 1 to 3.
The headline feature is 5, booking creation: the first moment a stranger's
booking becomes the business's lead. **Done: 0a, 0b, 1, 2, 3, 3b, 4. Next: 5a.**

- **0a. Commercial position** - done. Booking sits in the $240/mo plan.
- **0b. Design pass** - done. Static mockups in `prototypes/`.
1. **Multi-tenant auth** - done. Email-OTP sign-in, the `admin` role, the
   auto-active-organization hook, the subscription middleware (one tier,
   `agency`). Signup closed.
2. **Booking links, resources and availability rules** - done. Three tables,
   the public read route, the dev seed, the typed `hc<AppType>` seam, one
   resolution function for bookable hours.
3. **Calendar connection** - done. One Google calendar per person, both
   permissions in one connection, cipher, connect and disconnect, provider
   seam, free/busy proved on a real event. Not a two-way sync.
- **3b. Client access** - done. The platform admin sets up a client's login
  and business in one request, the client its owner; Better Auth's own create
  and invitations are closed.
4. **CRM spine** - done. `pipeline_stage`, `contact`, `activity`, and the
  backend functions the booking loop calls. Nothing visible.
5. **Booking creation** - split into four, each merged as it lands:
   - **5a. People's time** - the commitments table that refuses overlaps,
     time off, and the functions that hold, release and read time.
   - **5b. Who does what** - skills, rooms, standby.
   - **5c. Free times** - the start times a customer can book; public route.
   - **5d. The booking** - lead and booking tables, the book-this-time route,
     the timeline entry, the Google event. Owner-made bookings too.
6. **Confirmations** - `.ics` email to the customer, notification to the
   business, always from the business.
7. **Self-serve cancel and reschedule** - split into two, each merged as it lands:
   - **7a. Cancel** - the private link, the customer's page, the time freed,
     the Google event removed, both sides told.
   - **7b. Reschedule** - free times ignoring the booking's own old time, the
     same booking moved with its event and invite.
8. **Scheduled messages** - the job runner, confirmation and reminder texts.
9. **The booking component** - unstyled trigger, themed modal, one provider
   per host, layout stored on the booking link.
10. **Tenant zero wired: agents-web**.
11. **Leads list and contact page** - timeline, next steps, a lead by hand.
12. **Settings** - services, people and places, who does what, bookable hours,
    closed and opened days, the holiday picker (none by default), notice,
    horizon, time zone, calendar.
- **12b. Calendars** - every person and place has an in-app calendar.
- **12c. Backups, restore and retention** - before any real client's data.
13. **Primo Painters** - Calendly out. Needs 12c and item 22's calendar half.
14. **Pipeline board** - drag and drop between stages the business names.
15. **Email from the CRM** - sends logged on the timeline; BCC capture.
16. **Quotes** - line items, a total, a tokenized accept link.
17. **Face and Body** - Cal.com out; 45 services, practitioners, rooms.
18. **The Latam Painters** - after its site and siteConfig exist.
19. **Crew and job scheduling** - jobs of daily visits, crews as saved lists.
20. **Reports**. 21. **WhatsApp**. 22. **Google OAuth verification**
    (calendar half before 13). 23. **Packages ladder and admin area**.
    24. **Hosted booking page** `/book/<slug>`. 25. **Self-serve and
    billing**. 26. **Two-way Gmail sync**.

## Data model

Postgres through Drizzle; the schema and the one migration ledger live in
`packages/shared` (one table per file under `db/*-tables/`, migrations 0000 to
0008). Every app table carries `organizationId` (FK organization, cascade), a
security boundary taken from the session or a public route's slug lookup on
the server, never from a client. Ids are text; timestamps `timestamptz`;
tables carry `createdAt` and `updatedAt`. A link to another row of the same
business uses a composite FK on `(organizationId, id)`.

### Built

- **Better Auth** (feature 1): `user` (with `role`), `session`, `account`,
  `verification`, `organization`, `member`, `invitation`. Added
  `organization.plan` (text, default `agency`), server-set only.
- **booking_link** (2): a service, the host's `Service.bookingId`. `name`,
  `slug` (unique per business), `description`, `durationMinutes` (> 0),
  `bufferBeforeMinutes`, `bufferAfterMinutes` (>= 0), `active`.
- **resource** (2, 3): one person or one place, never a group. `name`, `kind`
  (`person` | `place`), `active`, `userId` (the login this person is; one per
  business, persons only). Every business gets its first person, linked to its
  owner.
- **availability_rule** (2): bookable hours. `resourceId` null is the
  business's row, set is that person's. `weeklyHours` (minute windows per
  weekday, several a day normal), `dateHours` (one-off dates). Business row
  only: `timezone`, `minimumNoticeMinutes`, `horizonDays` (1 to 365),
  `closedDates`, `holidayCountry`, `holidayRegion`, `closedHolidays`.
- **calendar_connection** (3): one per person. `provider` (`google`),
  `accountEmail`, `credentials` (AES-256-GCM under `CALENDAR_TOKEN_KEY`, sealed
  to the person), `grantedScopes` (must hold both), `status` (`connected` |
  `needs_reconnect`), `lastCheckedAt`. Tokens never leave the backend.
  `calendar_oauth_state`: ten-minute connect tickets by SHA-256 of the state.
- **client_setup_claim** (3b): `key` (`email:` or `slug:` plus the value,
  primary key), `claimId`, `claimedAt`. A setup in progress; expires after
  five minutes. Holds no database connection while it runs.
- **pipeline_stage** (4): `name` (unique per business ignoring capitals),
  `position` (not unique). Every business starts with New, Contacted, Booked,
  Done (migration backfill, the create hook, the seed); first = lowest.
- **contact** (4): `name`, `email` (optional, stored lowercase and trimmed,
  unique per business), `phone` (optional). The same email in a business is
  the same contact; no email is always a new one.
- **activity** (4): the timeline and the next-step queue. `contactId`
  (same business, cascade), `type` (`booking_created`, `stage_changed`,
  `email_sent`, `email_received`, `note`, `sms_sent`, `call`, `task`),
  `payload` (jsonb), `actorUserId` (set null when the login goes), and either
  `occurredAt` (happened) or `dueAt` then `doneAt` (to do), never both.

### Planned

- **lead** (5): `contactId`, `stageId`, `source` (`widget`, `hosted`,
  `manual`), `details`. Likely also linked from `activity`.
- **booking** (5): `leadId`, `bookingLinkId`, the people and place it holds,
  `startsAt`, `endsAt`, `status`, `location` (the customer's address,
  required), `calendarEventId`, `cancelToken`. Online or owner-made.
- **commitment** (5): one row per person or place per booking or time off,
  buffers inside; the database refuses overlapping active rows.
- **quote**, **quote_item** (16): status, currency, tax, totals, expiry, accept
  token, open count; items with description, quantity, unit, rate, amount.
- **job** (19): a lead that became work, made of daily visits.

> **Locked.** Organization scope on every table. Stages, resources and the
> timeline are tables, never enums. `activity` carries what happened and what
> is owed. One `commitment` table refuses overlaps. `availability_rule` is per
> business and optionally a person, never per booking link. Nothing about a
> business's schedule is fixed or on by default (decision 30).

## Tech stack

- **Next.js 16 + React 19** (`frontend`, Vercel) - the CRM, the admin pages,
  later the hosted booking page. Tailwind v4, shadcn, react-hook-form.
- **Hono** (`backend`, Railway) - the one API; persistent Node, so the job
  runner and token refresh live there.
- **npm workspaces** - `packages/shared` holds the schema, migrations, Zod
  schemas, crypto and fixed lists; subpath exports point at compiled `dist/`.
- **PostgreSQL 18 + Drizzle** - Railway; locally `scheduleads_dev` from the
  migrations and `db:seed`.
- **Better Auth** - `organization`, `emailOTP`, `admin` plugins.
- **Resend + React Email** - confirmations, `.ics`, later CRM email.
- **Google Calendar API** - free/busy and writing each booking.
- **Twilio** - SMS from item 8; WhatsApp later.
- Installed at the feature that needs them: TanStack Query (CRM lists),
  dnd-kit (board), shadcn charts (reports). No state manager yet.

## Monetization

Agency-provisioned first: booking ships inside the $240/mo plan, the first
tier of a ladder. Frank sets up each client and bills as the agency; moving a
client up is changing `organization.plan` until Stripe (Phase 9). Primo pays
the first tier; the clinic pays cost-cover privately.

## UI/UX

The widget is unstyled behaviour plus a themed modal that never names its
provider; Calendly shape, two screens. The login is the CRM, Pipedrive the
reference feel; mockups in `prototypes/` off one `theme.css`.

- `/sign-in` - email OTP, sign-in only
- `/admin/clients/new` - the platform admin sets up a client (3b)
- `/leads`, `/leads/[id]` (11); `/settings` (12); `/calendar` (12b);
  `/pipeline` (14); more of `/admin/*` (23); `/book/[slug]` (24)

API (`backend/app.ts`, one chain so `AppType` carries every route):

- Built: `/api/auth/*`, `GET /me`, `GET /public/:slug/booking-links`,
  `GET /public/:slug/booking-links/:bookingLinkId`, `GET /calendar/connection`,
  `POST /calendar/connect`, `GET /calendar/callback`,
  `POST /calendar/disconnect`, `POST /admin/clients`, `GET /health`.
- CRM writes so far are backend functions, not routes (`lib/crm/`): routes
  arrive with their screens.
- Planned: `POST /public/:slug/bookings` (5), cancel and reschedule by token
  (7), authenticated CRUD for leads, contacts, stages, resources, settings.

## Deployment

- **frontend** on Vercel (Root Directory `frontend`); **backend** and
  **Postgres** on Railway (Root Directory `backend`). Provisioned.
- Health: `GET /health`, no database on purpose.
- Env, names only: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `APP_ORIGIN`, `COOKIE_DOMAIN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `CALENDAR_TOKEN_KEY`, `RESEND_API_KEY`, `LOGIN_EMAIL_FROM`, `TWILIO_*`, `PORT`, `WIDGET_ORIGINS`;
  the frontend gets only `NEXT_PUBLIC_API_URL`. Losing `CALENDAR_TOKEN_KEY`
  makes every stored calendar connection undecryptable.
- CORS: public routes allow `WIDGET_ORIGINS` and the dashboard, never with
  credentials; dashboard routes only `APP_ORIGIN`, with the cookie.
- Google OAuth stays in Testing (seven-day tokens) until item 22's calendar
  half, finished before item 13.
- **Client data is never lost by one mistake**: daily backups, a nightly copy
  outside Railway and a tested restore before the first real client (12c).
- Login codes go by email from the agency's address (feature 6, decision 7);
  production refuses to start without `RESEND_API_KEY` and `LOGIN_EMAIL_FROM`.
- A failed calendar check never reports "free".

## Open questions

Carried from the plans, each with the moment it gets answered:

- Whose Calendly has been receiving Latam's bookings. Before item 18.
- Browser-to-API or proxied through the host's server action. Phase 3.
- Whether the clinic takes deposits at booking. At her onboarding.
- Which analytics source feeds the visitor package. When it exists.
- What Primo needs on day one beyond booking and the leads list. Before 13.
- The inbound path for the BCC capture address. Item 15.
- How the agency's own business gets its services and hours before Settings.
  Item 10.
- Whether buffers may fall outside bookable hours, and how "any available"
  picks a person. Item 5.
- How a holiday pick survives a renamed holiday (F-32). Item 12.
- Who connects a second person's calendar, since crew have no sign-in.
  Items 13 and 17, the first tenants with more than one person.

Found between the plans, settled in feature 5's spec:

- **No table is named yet for who does what (skills, rooms) or standby**,
  both read in item 5. Item 5's spec names them.
- **Item 9 leaves open whether the customer picks the person**, while item 5
  says the customer picks a person or "any available".
