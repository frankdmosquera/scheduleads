# Feature: Booking email works by default

**From build-plan:** feature 25a

**Size:** light - one real piece of logic (which sender and key an email uses, with one fallback); the rest is removing the key from forms.
**Status:** verified
**Branch:** feature/25a-booking-email-works-by-default

## Goal

Every business sends its booking emails (confirmation, move, cancellation, the
"New booking" notices, text replies passed on by email) from day one, with
nothing typed in: through the agency's one Resend key (`RESEND_API_KEY`), from
`bookings@<its domain>` when that domain is set up in the agency's Resend, and
otherwise from `bookings@booking-crm.com` in the business's name. The owner
gets the notices and the replies. A handover becomes "what's your email?".

## In scope

- **Who sends.** Every business email goes out with the agency key. A business's
  own saved Resend key is no longer used (its row stays in the database, unread).
- **Which address.** In order:
  1. the business's own sender address when one is saved (IA a la Orden's
     `hola@ialaorden.com`, Face and Body's `bookings@...`), kept as a choice;
  2. otherwise `bookings@<domain>`, the domain taken from the business's
     Website (`https://www.primopainters.ca/x` gives `primopainters.ca`), when
     public DNS shows Resend's signing record `resend._domainkey.<domain>`;
  3. otherwise `bookings@booking-crm.com`.
  Always shown in the business's name: `"Primo Painters" <bookings@...>`.
- **One fallback.** When Resend refuses an email from 1 or 2 because the domain
  is not verified (a 403 refusal), the same email is sent once more from
  `bookings@booking-crm.com`, so a half-set-up domain never loses a booking
  email. Logged as one line naming the business, never the addresses.
- **Who hears.** "New booking" notices go to the saved notification address, or,
  when none is saved, to the business owner's login email. Replies keep today's
  rules (customer's Reply goes to the booked person or the business).
- **Forms.** The dashboard's email card keeps the two addresses (sender
  optional, notification optional) and drops the Resend key field and its test
  send. The admin "Client setup" form drops its Resend key field. The card
  shows which sender is in use right now and why ("from your domain" or "from
  booking-crm.com until your domain is added").
- **Work emails** (one email per business, 12h): a person's work address must
  be at the business's own domain, as today; the domain now comes from rule 1
  or 2 above. With neither, saving a work email is refused as today.
- **Development.** Outside production, the agency key is not used for booking
  emails: the would-be sender is logged and nothing is sent (seed customers
  have fake addresses). Login codes are unchanged.
- **Docs.** `.env.example` and `AGENTS.md` say the agency key now carries every
  business's booking emails, and that a domain is added in Resend (and its four
  records in Vercel) to send from it.

## Out of scope

- Signup, packages, Stripe (item 25).
- Adding a domain to Resend through its API (item 25 names it as later).
- Deleting stored business keys or the key table (a later clean-up, once 25a
  has run live).
- Texts, WhatsApp, reminder by email (the channels feature).

## Build loop

After Frank's yes on this plan, the one step runs straight through: build,
tests, the build log, commit and push to the feature branch. The review comes
once, at `/complete` (light). Stops only for the three reasons in `AGENTS.md`.

## Build steps

- [x] 1. Sender and key resolution in `backend/lib/email/` (one new function
  that returns the key, the from line and the notify address for a business,
  used by the confirmation, move, cancellation, notice and text-reply paths in
  place of `setup.apiKey`, `setup.senderEmail`, `setup.notifyEmail`); the
  one-time fallback in the send path; the owner's email as notify fallback; the
  work-email domain from the same rule; the card and admin form without the
  key; docs.
  **Done when:** backend tests pass, including new ones for: own sender kept;
  website domain with the signing record gives `bookings@<domain>`; without it
  `bookings@booking-crm.com`; a 403 refusal resends once from
  `booking-crm.com`; no notify address falls back to the owner's email; nothing
  is sent outside production. The frontend and backend builds pass, and the
  email card on http://localhost:3400 shows the sender in use with no key field.

## Files / areas

- `backend/lib/email/`: `find-booking-email-context.ts`,
  `find-business-email-details.ts`, `send-booking-emails.ts`,
  `send-move-emails.ts`, `send-cancellation-emails.ts`, `send-email.ts` (or a
  wrapper beside it for the fallback), `find-email-sending-state.ts`,
  `save-email-sending.ts`, `check-email-sending-key.ts` (its route goes),
  `read-email-settings.ts`; a new resolver file, one export.
- `backend/lib/text/pass-on-reply.ts`, `backend/lib/settings/save-resource.ts`,
  `backend/lib/settings/find-people-settings.ts`, `backend/lib/admin/provision-client.ts`.
- `backend/routes/email-sending-routes.ts`, `backend/routes/admin-routes.ts`.
- `frontend/components/email-sending/email-sending-card.tsx`,
  `frontend/components/admin/client-setup-form.tsx`, their api-client files and
  words.
- `.env.example`, `AGENTS.md`.

## Data / contracts

- No migration. `organization.senderEmail` and `notifyEmail` keep their meaning
  (both optional now); `organization.website` gives the domain.
- The signing-record check is a DNS TXT lookup of `resend._domainkey.<domain>`,
  remembered per domain for an hour inside the process; a lookup failure counts
  as "not set up" (falls to `booking-crm.com`).
- The sender address shown in the card comes from the same resolver as the
  email, so the card never says one thing and the email does another.

## Testing

Backend Vitest beside the code (`*.test.ts`), the DNS lookup and Resend behind
the existing seams so tests make no network calls. The full backend suite runs
before the step is called done.

## Notes for the AI

- One export per backend file; types end in `Type`.
- Never log addresses or keys; the fallback line names the business id only.
- The agency key's own reach is checked before release, not in code (below).

## Open questions

- **Before release, in Resend (Frank, one look):** API Keys, the key Railway
  uses (`scheduleads-live-2026-10`): does its Domain column say "All domains"?
  If it is limited to `booking-crm.com`, a new "Sending access, all domains"
  key replaces it on Railway at release, or every client-domain email falls
  back to `booking-crm.com`.
