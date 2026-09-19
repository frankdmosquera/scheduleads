# Build Plan

Phases have exit conditions. A phase is done when its exit condition is true,
not when its boxes are ticked. `/feature` with no number specs the next
unchecked item.

Items 1 to 3 correspond to the first repo's features 1 to 3 and are carried
over with fixes, not rebuilt. Everything from 4 on is new numbering. The first
repo's archived specs stay readable by their own numbers in its own folder.

## Phase 0. Decide

Exit: the commercial questions in `project-plan.md` have written answers,
and static mockups exist for the booking modal and both login screens.

- [x] 0a. **Commercial position** - answered 2026-09-18. Booking sits in
  the $240/mo plan. Tenant order is the agency's own site, the clinic,
  Latam, Primo. Free/busy is proven on Frank's own Google calendar; clients
  answer the calendar question at their onboarding
- [ ] 0b. **Design pass** - static mockups of the booking modal in two
  tenant themes (the agency's and the clinic's) and of the leads list and
  settings screens, via `/prototype`. Runs first thing inside the new repo,
  before item 1 is spec'd

## Phase 1. Foundation, carried over

Exit: a second organization can be created through the app with no database
touch, sign-in lands on that organization without a workaround, and the
free/busy check returns a real event's busy block from Frank's own connected
Google calendar, the agency tenant's.

- [ ] 1. **Multi-tenant auth, with the org fix** - email-OTP sign-in,
  create-organization, the superadmin role, and the auto-active organization
  hook so sign-in resolves the org
- [ ] 2. **Booking links and availability rules** - the two tables, the
  public read route, the seed CLI, and the shared-package layout
- [ ] 3. **Calendar connection** - the table, the cipher, OAuth connect and
  disconnect, the provider seam, and the free/busy query verified against a
  real event

## Phase 2. The booking loop

Exit: a stranger books a real slot on a test page, the business receives the
lead, the confirmation email with its `.ics` arrives, the calendar shows the
event, and the cancel link in that email works.

- [ ] 4. **Booking creation** - validate a requested slot against the rules
  and the live calendar, create contact, lead, and booking
- [ ] 5. **Confirmations** - email with `.ics` to the customer and a
  business-side notification, from Primo's template pattern
- [ ] 6. **Self-serve cancel and reschedule** - a tokenized link in the
  confirmation
- [ ] 7. **SMS confirmation** - Twilio. First to cut if the phase runs long

## Phase 3. The widget in the agency's own site

Exit: agents-web takes a real booking through this product, the lead lands
in the agency's own login, and the site that promises "nothing rented" rents
nothing.

- [ ] 8. **The booking component** - unstyled trigger, themed modal, one
  provider per host wrapping children, the face-and-body contract
- [ ] 9. **Tenant zero wired: agents-web** - the agency's siteConfig holds
  its slug, the existing contact-inquiry seam calls the API, the site's
  theme reaches the modal. Frank is the first customer

## Phase 4. The business's login

Exit: the owner can see every lead and change their hours, services, and
calendar connection without Frank touching the database.

- [ ] 10. **Leads list** - new, contacted, booked, done
- [ ] 11. **Settings** - hours, services, blackout dates, and the calendar
  connection, replacing direct edits to `availability_rule`

## Phase 5. Every client

Exit: four organizations, four live sites, zero rented booking.

- [ ] 12. **Face and Body** - the first client. Cal.com comes out from
  behind the seam its decisions file built for this. Its 45 services become
  booking links. Ask at onboarding whether the clinic keeps a Google
  calendar; Square suggests not
- [ ] 13. **The Latam Painters** - after its own site is finished. First
  find out whose Calendly has been receiving its bookings. It needs a
  siteConfig before it can be a tenant
- [ ] 14. **Primo Painters** - last, because it is live and ranking. The
  shared modal behind one config value is the best seam in the workspace;
  the swap is that one value plus the provider component

## Phase 6. Self-serve

Exit: a business the agency did not build a site for pays and takes its first
booking with no one at the agency involved.

- [ ] 15. **Google OAuth verification** - start first. It is slow
- [ ] 16. **Hosted booking page** - `/book/<slug>`
- [ ] 17. **Self-serve onboarding and billing** - signup, pick a plan, Stripe
  hosted checkout, the webhook writes `organization.plan`
- [ ] 18. **Plan limits enforced** - the config file gates what each tier
  can do

## Named, not planned

Nothing above depends on these. Each gets a phase when something does.

- Crew assignment and job scheduling
- Photo attachments on a lead
- Embed script for a site the agency did not build
- Microsoft, CalDAV, and ICS calendar providers
- SEO tooling, Google Business Profile management, marketing automation
- AI front of house
