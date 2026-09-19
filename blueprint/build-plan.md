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
  evening: the plan is the first rung of a ladder of packages, the product
  is a CRM, and the tenant order is the agency's own site, Primo, the
  clinic, Latam
- [ ] 0b. **Design pass** - static mockups of the booking modal in two
  tenant themes (the agency's and Primo's), the leads list, the pipeline
  board and the settings screen, via `/prototype`. Runs first thing inside
  the new repo, before item 1 is spec'd

## Phase 1. Foundation, carried over

Exit: a second organization can be created through the app with no database
touch, sign-in lands on that organization without a workaround, a route
behind the package gate refuses an organization whose rung does not include
it, and the free/busy check returns a real event's busy block from Frank's
own connected Google calendar, the agency tenant's.

- [ ] 1. **Multi-tenant auth, with the org fix** - email-OTP sign-in,
  create-organization, the superadmin role through the `admin` plugin, the
  auto-active organization hook so sign-in resolves the org, and the package
  gate: `organization.plan`, the plan-limits config with the one rung
  `agency`, and the check every module route calls. The rule that tenant
  code never reads across organizations starts here
- [ ] 2. **Booking links and availability rules** - the two tables, the
  public read route, the seed CLI, and the shared-package layout. Several
  windows per day, a booking horizon, and statutory holidays resolved from
  a country code.
  **The typed front-to-back seam lands here, and does not close on a
  claim.** The backend exports `AppType`, the frontend calls this item's
  public route through `hc<AppType>` from `hono/client`, and the spec must
  carry a `Done when` that renames the route on purpose and confirms the
  frontend stops compiling. The first repo exported `AppType` and never
  consumed it once; this item is where that stops being true
- [ ] 3. **Calendar connection** - the table, the cipher, OAuth connect and
  disconnect, the provider seam, and the free/busy query verified against a
  real event

## Phase 2. The booking loop

Exit: a stranger books a real slot on a test page, the business receives the
lead in its first pipeline stage, the confirmation email with its `.ics`
arrives, the calendar shows the event, the cancel link in that email works,
and a second resource can hold the same time as the first.

- [ ] 4. **CRM spine** - `contact`, `pipeline_stage` seeded with the four
  defaults at provisioning, `resource`, and `activity` carrying both the
  timeline and the next-step queue. The tables and the API routes the loop
  writes to. Nothing visible yet
- [ ] 5. **Booking creation** - validate a requested slot against the rules,
  the free resources and the live calendar; take the customer's address;
  create the contact, the lead in the first stage, the booking on a
  resource, and the timeline entry
- [ ] 6. **Confirmations** - email with `.ics` to the customer and a
  business-side notification, from Primo's template pattern
- [ ] 7. **Self-serve cancel and reschedule** - a tokenized link in the
  confirmation
- [ ] 8. **Scheduled messages** - the background job runner, then the
  confirmation text when a booking is made and the reminder text the
  evening before. Primo already sends both through Calendly, a
  confirmation immediately and a reminder 20 hours ahead, so shipping
  without them hands him a downgrade. **Nothing else in this plan creates
  a runner**, and reminders, follow-ups and the calendar token refresh all
  need one, which is why it is here rather than left to Phase 8

## Phase 3. The widget in the agency's own site

Exit: agents-web takes a real booking through this product, the lead lands
in the agency's own organization, and the site that promises "nothing
rented" rents nothing.

- [ ] 9. **The booking component** - unstyled trigger, themed modal, one
  provider per host wrapping children, the face-and-body contract. The
  layout is a stored value on the booking link, not a hardcoded shape, so
  the week strip in `prototypes/modal-primo.html` can return later without
  a rewrite. Only the Calendly-shaped month flow gets built now
- [ ] 10. **Tenant zero wired: agents-web** - the agency's siteConfig holds
  its slug, the existing contact-inquiry seam calls the API, the site's
  theme reaches the modal. Frank is the first customer

## Phase 4. The CRM, first release

Exit: the owner can see every lead, open a contact and read its timeline, and
change hours, services, resources, blackout dates and the calendar
connection, without Frank touching the database.

- [ ] 11. **Leads list and contact page** - every lead with its stage, the
  contact page with its timeline and its open next steps, and adding a lead
  by hand. A painter takes phone calls; with no way to type one in he keeps
  the notebook and the CRM sits half empty
- [ ] 12. **Settings** - hours with several windows a day, services,
  resources, blackout dates, statutory holidays, the booking horizon, and
  the calendar connection, replacing direct edits to `availability_rule`

## Phase 5. The first paying client

Exit: Primo takes a real booking through this product, the lead is in his
list, Calendly is gone from his site, and the ranking is untouched.

- [ ] 13. **Primo Painters** - the shared modal behind one config value plus
  the provider component; his crews become resources. Ask first what he
  needs on day one beyond booking and the leads list

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
  practitioners become resources. Ask at onboarding whether the clinic keeps
  a Google calendar and whether it takes deposits
- [ ] 18. **The Latam Painters** - after its own site is finished. First
  find out whose Calendly has been receiving its bookings. It needs a
  siteConfig before it can be a tenant

## Phase 8. The CRM grows

Exit: Primo's crews are scheduled from the CRM, and the owner of any tenant
reads a report page instead of asking Frank how the month went.

- [ ] 19. **Crew and job scheduling** - a job is a lead that became work, on
  a resource, across days. The internal calendar shows crews by day
- [ ] 20. **Reports** - bookings per week, pipeline by stage, lead sources,
  on shadcn charts
- [ ] 21. **WhatsApp** - Meta verification, a dedicated number, approved
  templates; sent and logged like SMS

## Phase 9. Packages and self-serve

Exit: a business the agency did not build a site for pays and takes its first
booking with no one at the agency involved.

- [ ] 22. **Google OAuth verification** - calendar scopes first, then the
  Gmail restricted scopes and their security assessment. Start as soon as
  Phase 3 is done; it is a form and a wait, not code
- [ ] 23. **Packages ladder and the admin area** - the rungs above `agency`
  in the plan-limits config, what each unlocks, and the admin screens: who
  is on what, move a client up. The gate itself exists since item 1
- [ ] 24. **Hosted booking page** - `/book/<slug>`
- [ ] 25. **Self-serve onboarding and billing** - signup, pick a package,
  Stripe hosted checkout, the webhook writes `organization.plan`
- [ ] 26. **Two-way Gmail sync** - after 22. The owner's mailbox threads land
  on the contact timeline

## Named, not planned

Nothing above depends on these. Each gets a phase when something does.

- Photo attachments on a lead
- Per-resource working hours
- Crew member sign-in
- Embed script for a site the agency did not build
- Microsoft, CalDAV, and ICS calendar providers
- SEO reporting and Google Business Profile posting, as a package
- Visitor analytics, as a package, source undecided
- Marketing automation
- AI front of house
