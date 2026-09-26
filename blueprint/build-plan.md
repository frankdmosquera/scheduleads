# Build Plan

Phases have exit conditions. A phase is done when its exit condition is true,
not when its boxes are ticked. `/feature` with no number specs the next
unchecked item.

Items 1 to 3 correspond to the first repo's features 1 to 3 and are carried
over with fixes, not rebuilt. Everything from 4 on is new numbering,
renumbered on the evening of 2026-09-18 when the CRM items came in, and
again later the same evening when Quotes landed as 16 and pushed what was
16 to 25 down one. Only 0a was done by then, so nothing archived changes.
The first repo's archived specs stay readable by their own numbers in its
own folder.

## Phase 0. Decide

Exit: the commercial questions in `project-plan.md` have written answers,
and static mockups exist for the booking modal, the leads list, the pipeline
board and the settings screen.

- [x] 0a. **Commercial position** - answered 2026-09-18. Booking sits in
  the $240/mo plan. Free/busy is proven on Frank's own Google calendar;
  clients answer the calendar question at their onboarding. Revised the same
  evening: the plan is the first tier of a ladder of packages, the product
  is a CRM, and the tenant order is the agency's own site, Primo, the
  clinic, Latam
- [x] 0b. **Design pass** - static mockups of the booking modal in two
  tenant themes (the agency's and Primo's), the leads list, the pipeline
  board and the settings screen, via `/prototype`. Runs first thing inside
  the new repo, before item 1 is spec'd

## Phase 1. Foundation, carried over

Exit: a second organization can be created through the app with no database
touch, sign-in lands on that organization without a workaround, a route
behind the subscription middleware refuses an organization whose tier does not include
it, and the free/busy check returns a real event's busy block from Frank's
own connected Google calendar, the agency tenant's. A client user the
agency provisioned can also sign in and reach that business and nothing
else.

- [x] 1. **Multi-tenant auth, with the org fix** - email-OTP sign-in,
  create-organization, the superadmin role through the `admin` plugin, the
  auto-active organization hook so sign-in resolves the org, and the subscription
  middleware: `organization.plan`, the subscription-limits config with the one tier
  `agency`, and the check every module route calls. The rule that tenant
  code never reads across organizations starts here
- [ ] 2. **Booking links, resources and availability rules** - the three
  tables, the public read route, the dev seed, and the shared-package layout.
  (The seed CLI for real clients was dropped on 2026-09-25: a client's hours
  are always set by the client in the app.)
  Shaped by version 8 of the booking model, approved 2026-09-25 (the build
  log's "How it all fits together").
  A booking link is a service: a length, and a buffer before and after it,
  any number including zero, set per service.
  A resource is one person or one place (a room, a chair), never a group, and
  says which. Every business gets its first person automatically, its
  business owner, so the database always has someone to hold a booking.
  `availability_rule` holds **bookable hours**, meaning when customers can
  book online, not opening hours and not time at work. It is unique per
  organization **and resource**: a null resource is the business's own
  weekly hours, a set one is that person's. A person uses their own week if
  they have one, otherwise the business's, and can have one-off dates (hours
  on one date) without copying the week. Closed days and statutory holidays
  (country **and province**, the whole year's list on by default) belong to
  the business and close online booking for everyone; a one-off date opens a
  closed day or holiday again, for one person or the whole business. Time
  zone, minimum notice and how far ahead customers can book are set once per
  business, each business choosing its own. One resolution function, written
  here and called by every later item. Null-safe uniqueness is not automatic
  in Postgres; see the trap in `resource-model-proposal.md` section 4.
  **The typed front-to-back seam lands here, and does not close on a
  claim.** The backend exports `AppType`, the frontend calls this item's
  public route through `hc<AppType>` from `hono/client`, and the spec must
  carry a `Done when` that renames the route on purpose and confirms the
  frontend stops compiling. The first repo exported `AppType` and never
  consumed it once; this item is where that stops being true
- [ ] 3. **Calendar connection** - the table, the cipher, OAuth connect and
  disconnect, the provider seam, and the free/busy query verified against a
  real event. **Every Google calendar belongs to one person**, never to "the
  business": a calendar for the business cannot say which worker is busy.
  The first one connected is the business owner's (the business's first
  person); others connect their own when a business has more people, and
  Google stays optional for each person. One connection asks for both
  permissions: reading busy times, and adding and editing events, so each
  booking shows on the booked person's phone. Asking for the second later
  would make every client reconnect. It is not a two-way sync: bookings are
  moved in the app, never in Google, because a change made in Google is not
  read back. Google keeps a Testing app's connection for seven days only,
  which is why item 22 is finished before item 13

- [ ] 3b. **Client access: provisioning, and closing signup** - the two
  halves of one door, which have to land together. Today any address that
  can receive mail may verify a code and get a user row, while only the
  platform admin may create a business. So an onboarded client ends up with
  a login and nothing to log in to: no path puts a client user inside the
  business the agency created for them, and there is no invitation flow
  anywhere in the code. Better Auth ships both pieces already -
  `admin.createUser` and the organization plugin's `addMember` - so this is
  an admin path over machinery that already exists. Note that
  `organization/create` skips the platform-admin check for direct server-side
  `auth.api` calls carrying a `userId` and no headers, which is the sanctioned
  provisioning path and also the one place a later server-side caller could
  create a business without that check; say so where this item uses it.
  **Who owns a client's business** (decided 2026-09-25): when the platform
  admin creates a client's business, it is created under the client's email,
  so that email is its business owner and its first person. The platform
  admin reaches it through the admin area and is never its business owner.
  Today's code does the opposite: `creatorRole: "owner"` makes whoever
  clicks create the business owner, which would be the platform admin.
  **Now a hard blocker rather than a deadline.** This item originally carried
  closing signup as its second half; signup was closed on 2026-09-23 instead,
  while item 1 was still open, because the door had no legitimate user. So a
  new client can no longer sign in at all, and nothing except this item can
  let them. Nobody new reaches the product until it ships, which makes it a
  prerequisite for Phase 5 and for any client-facing deploy. Found while
  reviewing item 1, not planned before it

## Phase 2. The booking loop

Exit: a stranger books a real slot on a test page, the business receives the
lead in its first pipeline stage, the confirmation email with its `.ics`
arrives, the calendar shows the event, the cancel link in that email works,
and a second resource can hold the same time as the first.

- [ ] 4. **CRM spine** - `contact`, `pipeline_stage` seeded with the four
  defaults at provisioning, and `activity` carrying both the timeline and the
  next-step queue. The tables and the API routes the loop writes to.
  `resource` moved to item 2, because availability is defined per resource and
  cannot reference a table that arrives two items later. Nothing visible yet
- [ ] 5. **Booking creation** - validate a requested slot against the rules,
  the free resources and the live calendar; take the customer's address;
  create the contact, the lead in the first stage, the booking on a
  resource, and the timeline entry. From version 8:
  - **Who does what** is built here: which person can do which service
    (skills) and which place a service needs (rooms). A time shows only when
    someone has the skill, is bookable, is free, and the room the service
    needs is free. Nobody ticked for a service means anyone can do it; no
    room ticked means no room check. Item 12 is where the owner ticks them.
  - **The customer picks a person or "any available"**; the rule for how
    "any available" picks is decided here.
  - **Free time** is bookable hours minus busy: bookings, time off, and
    Google busy times with the service's buffers applied. Worked out, never
    stored. Standby (at work, hidden from customers, the owner can still
    assign them) and off are dated per person and read here. The owner
    decides who is bookable: a job never hides anyone from customers.
  - **One commitments table**: every booking writes a row per person, and
    per place when one is needed, with the buffers inside its time, and the
    database refuses two overlapping rows for the same person or place, so
    two customers cannot both take 3pm. Time off writes rows too. Cancelled
    rows stop blocking. No double booking, the owner included.
  - A booking can also be made by the owner (a phone estimate, a walk-in):
    the same booking, with the customer, the lead and the texts.
  - Start times repeat every service length by default, and the owner can
    change it. Whether buffers may fall outside bookable hours (Primo's
    one-hour windows) is decided in this item's spec
- [ ] 6. **Confirmations** - email with `.ics` to the customer and a
  business-side notification, from Primo's template pattern. Customers only
  ever hear from the business, never from a worker's own address. A booked
  worker with no login and no Google has no way to be told yet; this item or
  item 19 decides how they are
- [ ] 7. **Self-serve cancel and reschedule** - a tokenized link in the
  confirmation. A cancel frees the slot and removes the event from the
  booked person's Google; a reschedule is never refused because of the
  booking's own old time
- [ ] 8. **Scheduled messages** - the background job runner, then the
  confirmation text when a booking is made and the reminder text the
  evening before. Primo already sends both through Calendly, a
  confirmation immediately and a reminder 20 hours ahead, so shipping
  without them hands him a downgrade. **Nothing else in this plan creates
  a runner**, and reminders, follow-ups and the calendar token refresh all
  need one, which is why it is here rather than left to Phase 8. Every
  message goes out through one place in the code, Twilio for all of it for
  now, so moving WhatsApp to Meta directly later changes that one place

## Phase 3. The widget in the agency's own site

Exit: agents-web takes a real booking through this product, the lead lands
in the agency's own organization, and the site that promises "nothing
rented" rents nothing.

- [ ] 9. **The booking component** - unstyled trigger, themed modal, one
  provider per host wrapping children, the face-and-body contract. The
  layout is a stored value on the booking link, not a hardcoded shape, so
  the week strip in `prototypes/modal-primo.html` can return later without
  a rewrite. Only the Calendly-shaped month flow gets built now. Open until
  this item's spec: whether each service lets the customer pick the person
  (a salon) or the business assigns one (Primo's estimates)
- [ ] 10. **Tenant zero wired: agents-web** - the agency's siteConfig holds
  its slug, the existing contact-inquiry seam calls the API, the site's
  theme reaches the modal. Frank is the first customer.
  Open, from 2026-09-25: this item goes live before Settings (item 12), so
  the agency's own business has no in-app way to get its services and hours
  yet. Decide here: move the needed part of Settings earlier, or a small
  one-off command for this one business

## Phase 4. The CRM, first release

Exit: the owner can see every lead, open a contact and read its timeline,
change hours, services, resources, closed days and the calendar
connection, and put a phone estimate or time off on anyone's calendar,
without Frank touching the database.

- [ ] 11. **Leads list and contact page** - every lead with its stage, the
  contact page with its timeline and its open next steps, and adding a lead
  by hand. A painter takes phone calls; with no way to type one in he keeps
  the notebook and the CRM sits half empty
- [ ] 12. **Settings** - hours with several windows a day, services,
  resources, blackout dates, statutory holidays, the booking horizon, and
  the calendar connection, replacing direct edits to `availability_rule`.
  From version 8:
  - Services with their length and buffers; people and places.
  - Who does what: the owner ticks each person's services and the rooms
    each service needs (item 5 checks them).
  - Bookable hours per person, and one-off dates.
  - One click closes a day for online booking for everyone. It stops new
    bookings only: bookings made before the click are shown to the owner,
    who keeps them or cancels them, all at once or one by one. One click
    opens a closed day or a holiday again, for one person or everyone.
  - The holiday list for the business's province, the whole year on by
    default, with a switch on each.
  - Notice, how far ahead and time zone, once for the business.
  - Changing a service's length or someone's hours keeps existing bookings
    and warns the owner which ones now fall outside.
  - Opening hours for the public (the website, the Google profile) are a
    separate setting from bookable hours, often the same, never forced to
    be. Not built here; nothing needs them yet
- [ ] 12b. **Calendars** - every person and every place has a calendar in
  the app, showing their bookings, time off and Google busy times, over
  their bookable hours. The owner adds things by hand: a phone estimate or
  a walk-in (a real booking, with the customer, the lead and the texts),
  time off, a blocked afternoon. He can place work any time someone is not
  off and not already busy; bookable hours only limit customers. Marking
  someone off over existing bookings moves or cancels them in the same
  save. Added 2026-09-25 from version 8: until this item the owner has no
  way to put anything in by hand, and the website could sell a slot he
  already gave away on the phone. After item 5 because it shows bookings,
  before item 13 because Primo takes phone calls. Numbered 12b so nothing
  after it renumbers

## Phase 5. The first paying client

Exit: Primo takes a real booking through this product, the lead is in his
list, Calendly is gone from his site, and the ranking is untouched.

- [ ] 13. **Primo Painters** - the shared modal behind one config value plus
  the provider component; his people become resources, one each, and his
  crews become saved lists of them in item 19. Ask first what he needs on
  day one beyond booking and the leads list. Before switching him to
  Alberta's holiday list, write down the holidays his Calendly closes today
  (Canada's list, with Sep 30 on and no Family Day), so the switch changes
  nothing he did not choose. Needs item 22 finished first: his Google
  connection would otherwise drop every seven days

## Phase 6. The CRM, second release

Exit: the owner drags a lead between stages he named himself, sends an email
from a contact, sees the reply on that contact's timeline, and sends a quote
the customer accepts from the link.

- [ ] 14. **Pipeline board** - drag and drop between stages, stages renamed
  and reordered per business. TanStack Query and dnd-kit arrive here
- [ ] 15. **Email from the CRM** - templates sent under the business's name
  through Resend, logged on the timeline, and the BCC capture address that
  files replies on the contact. The inbound path is decided in this item's
  spec
- [ ] 16. **Quotes** - line items, a total, and a tokenized link the
  customer opens in the business's own theme to accept or decline.
  Accepting moves the lead and schedules the job. The project plan promises
  the journey "to the job is done and paid" and every other item stops at
  booked; this is where the money is decided, and without it the owner
  leaves the CRM for a notebook. Mocked in `prototypes/quote.html`

## Phase 7. Every client

Exit: four organizations, four live sites, zero rented booking.

- [ ] 17. **Face and Body** - Cal.com comes out from behind the seam its
  decisions file built for this. Its 45 services become booking links, its
  practitioners become resources, and its treatment rooms become places
  that the services needing them are ticked to. Ask at onboarding whether
  the clinic keeps a Google calendar and whether it takes deposits
- [ ] 18. **The Latam Painters** - after its own site is finished. First
  find out whose Calendly has been receiving its bookings. It needs a
  siteConfig before it can be a tenant

## Phase 8. The CRM grows

Exit: Primo's crews are scheduled from the CRM, and the owner of any tenant
reads a report page instead of asking Frank how the month went.

- [ ] 19. **Crew and job scheduling** - a job is a lead that became work.
  From version 8:
  - A job always belongs to a customer, and comes from an accepted quote
    (item 16) or is added by hand.
  - It is made of visits, one per day, each with its own people, so a
    three-day job never covers the evenings between (Primo's estimate
    hours).
  - A crew is a saved list of people with a lead hand per job, never one
    resource.
  - The owner places a visit any time its people are not off and not
    already busy.
  - A job never hides anyone from customers: who is bookable stays the
    owner's call, through bookable hours and standby. How visits sit beside
    the commitments table without breaking that is decided in this item's
    spec.
  - The crew view is everyone's calendar from item 12b, side by side by day
- [ ] 20. **Reports** - bookings per week, pipeline by stage, lead sources,
  on shadcn charts
- [ ] 21. **WhatsApp** - Meta verification, a dedicated number, approved
  templates; sent and logged like SMS

## Phase 9. Packages and self-serve

Exit: a business the agency did not build a site for pays and takes its first
booking with no one at the agency involved.

- [ ] 22. **Google OAuth verification** - calendar scopes first, then the
  Gmail restricted scopes and their security assessment. Start as soon as
  Phase 3 is done; it is a form and a wait, not code. **The calendar half is
  finished before item 13**, though it sits in Phase 9: while the app is in
  Google's Testing mode a client's connection drops every seven days and
  their booking page shows no times until they reconnect, which is what
  stalled the first repo. Decided 2026-09-25
- [ ] 23. **Packages ladder and the admin area** - the tiers above `agency`
  in the subscription-limits config, what each unlocks, and the admin
  screens: who is on what, move a client up. The subscription middleware
  itself exists since item 1
- [ ] 24. **Hosted booking page** - `/book/<slug>`
- [ ] 25. **Self-serve onboarding and billing** - signup, pick a package,
  Stripe hosted checkout, the webhook writes `organization.plan`
- [ ] 26. **Two-way Gmail sync** - after 22. The owner's mailbox threads land
  on the contact timeline

## Named, not planned

Nothing above depends on these. Each gets a phase when something does.

- Photo attachments on a lead
- An owner booking two clients into one sales talk on purpose, the only
  double booking ever discussed. Only if a client asks
- No-show handling: a card on file, a fee, or a deposit held
- Recurring appointments, weekly or every few weeks
- Multiple locations for one business
- Travel time between jobs, as distinct from a flat buffer
- Crew member sign-in
- Custom roles per business (Better Auth's dynamic access control). Frank
  creates them for a business from item 23's admin area first; owners
  design their own only once self-serve exists (item 25). Capped per
  business with `maximumRolesPerOrganization`. Kept cheap to switch on by
  the permission-check rule in `coding-standards.md`: code asks
  `hasPermission`, never `role === "owner"`
- Embed script for a site the agency did not build
- Microsoft, CalDAV, and ICS calendar providers
- SEO reporting and Google Business Profile posting, as a package
- Visitor analytics, as a package, source undecided
- Marketing automation
- AI front of house. An AI booking on a client's site asks this product
  when someone is free, the same way the booking page does; comparing the
  customer's own calendar is on the AI's side. Raised 2026-09-25
- Tryout access requested from agents-web. Deliberately not self-serve
  signup: agents-web is tenant zero (item 10), so the request arrives as a
  lead in the agency's own CRM and the agency provisions from there through
  item 3b's path, so the email the trial is made under is its business
  owner, as with any client. If it ever ships, a trial is a new tier in item 23's
  ladder with its own module set, never open creation on `agency`. The
  "template site to play with" half is a far larger thing than the dashboard
  half, because that is the agency's actual deliverable rather than a
  feature of this product. Raised 2026-09-23; not the original plan
