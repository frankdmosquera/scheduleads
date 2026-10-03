# Feature: Cancel

**From build-plan:** feature 7a

**Branch:** feature/07a-cancel

## Goal

Jane's confirmation carries a private link. It opens a page, under the
business's brand, showing her booking, with a Cancel button. Cancelling frees
the time so someone else can book it, removes the event from the booked
person's Google, tells Jane and the business by email (Jane's calendar
invite is withdrawn too), and records it on her timeline. Nobody signs in:
the link is the key. This is Phase 2's exit line "the cancel link in that
email works". Moving a booking to another time is 7b, on the same page.

## In scope

- The booking's private link: a token that names one booking and cannot be
  guessed or altered, and the public route that answers what the page shows.
- Cancel: one public route, one transaction (the booking cancelled, its held
  time released, a `booking_cancelled` timeline entry), safe to press twice.
- After the cancel, without Jane's answer waiting: the event removed from the
  booked person's Google, the cancellation email to Jane with her invite
  withdrawn, and the business's notification.
- Jane's page in the frontend: her booking under the business's name, logo
  and colour, a Cancel button with a confirm step, and every state (not
  found, already cancelled, already started, failure).
- The link in Jane's confirmation email.

### Decisions made in the spec

1. **The link is the only key.** No sign-in and no account, like accepting a
   quote later (the project plan). Whoever holds the link can see and cancel
   that one booking, nothing else; every other booking, the customer's
   details and the business's data stay out of reach.
2. **A wrong, altered or unknown link answers exactly like a missing
   booking**: 404 `not_found`, nothing said about why. A link cannot be used
   to learn whether a booking exists.
3. **The page shows the booking, never the customer.** The service, the day
   and time in the business's zone, the person, the business's name, logo,
   colour and phone. Not Jane's name, email, phone, address or words: a
   forwarded email must not hand those on.
4. **Cancelling twice is one cancel.** The second press answers the same
   cancelled booking; no second timeline entry, no second email (each email's
   idempotency key is the booking id and its kind).
5. **A cancel never waits for Google or Resend** (feature 6's decision 1, 5d's
   decision 6). The booking is cancelled and its time free the moment the
   answer goes back; a failed event removal or email logs one line, and
   feature 8 retries.
6. **The time is free at once.** Its held rows are cancelled in the same
   transaction, so the free-times route offers it again straight away. The
   rows are kept, as feature 5a decided.
7. **The lead stays where it is.** A cancel does not move the lead to another
   stage or close it; the pipeline (feature 14) decides what a cancel does to
   a lead. The timeline entry is what the owner sees.
8. **Jane's invite is withdrawn, not left behind.** Her cancellation email
   carries an `invite.ics` with `METHOD:CANCEL`, the same UID and a higher
   `SEQUENCE`, so her calendar removes the event instead of keeping a
   booking that no longer exists.
9. **Jane's page names the business, never the product.** Its title, icon and
   text come from the business; nothing on it says the product's name. The
   domain the app runs on must not either (a deploy note, below).
10. **The link is signed, nothing stored** (Frank, 2026-10-03, open question
    1). The token is the booking id and an HMAC-SHA256 of it under a new key,
    `BOOKING_LINK_KEY`. A stolen copy of the database opens no booking; every
    later email (7b's moved email, feature 8's reminder) can carry the same
    link; changing the key ends every link at once. Rejected: a random token
    stored on the booking (the overview's `cancelToken`), where a database
    copy opens every booking; a stored hash of a random token, safe at rest
    but no later email could carry the link again.
11. **Jane may cancel until the appointment starts** (Frank, 2026-10-03,
    open question 2). From its start the page shows the business's phone
    instead: once the worker is on site it is a conversation, not a button. A
    late cancel still frees the time. A business's own cutoff ("not within 24
    hours") comes with Settings, feature 12. Rejected: a 24-hour cutoff for
    every business, a rule nobody chose.

## Out of scope

- Moving a booking: 7b, on the same page and the same link.
- The owner cancelling from the dashboard: features 11 and 12b, which can call
  the same cancel function.
- A business's own cancellation rule (for example "not within 24 hours"):
  Settings, feature 12. Until then it is decision 11: until the start.
- Retrying a failed event removal or email: feature 8.
- What a cancel does to the lead's stage: feature 14.
- Rate limits on the public routes: feature 9.
- A text to the customer with the link: feature 8; a phone-only booking has no
  email, so it gets no link yet.

## Build loop

Steps are built one at a time on `feature/07a-cancel`. Each step's plan gets
Frank's yes just before it is built. After that yes nothing stops until the
review: build, tests, tick the box, the build log entry, commit with the step
number and push to the feature branch, `/audit` scoped to the step, then the
independent review (`workflow.stepReview: "every"`,
`workflow.checkpointCommits: "enabled"`). Findings are talked through after
the review; P0/P1 are fixed before the next step. `/complete` makes the merge
commit, on Frank's yes.

No package is planned. Installing one is a line only Frank crosses.

## Build steps

- [x] **7a.1 The booking's private link.**
  - The token is signed, nothing stored (decision 10): the booking id and an
    HMAC-SHA256 of it under a new key `BOOKING_LINK_KEY` (32 random bytes,
    base64), compared in constant time.
  - `backend/lib/booking/booking-page-token.ts`: `makeBookingPageToken(bookingId)`
    and `readBookingPageToken(token)` (the booking id, or null for anything
    altered, truncated or made up). The key is read with the other settings at
    start: production refuses to start without it, as without
    `CALENDAR_TOKEN_KEY`; `.env.example` names it.
  - `backend/lib/booking/find-booking-page.ts` and
    `GET /public/bookings/:token` (public CORS, never with credentials,
    `Cache-Control: no-store`): the page's view of one booking (Data /
    contracts), read through the booking's own business. Unknown, altered or
    another business's: 404 `not_found` (decision 2).
  - **Done when** saved tests: a made token reads back to its booking; one
    changed character, a cut-off token, another booking's signature or a
    made-up string reads as null; the route answers the view for a real link
    and 404 for every bad one, with the same body; the view carries none of
    the customer's details; production without the key refuses to start; the
    answer is never cached. The frontend build passes and the typed public
    client sees the route.

- [x] **7a.2 Cancel.**
  - Jane may cancel until the appointment starts (decision 11). The page's
    view gains `canCancel`: confirmed and not started.
  - `backend/lib/booking/cancel-booking.ts`: in one transaction, the booking
    row locked, then, when it is confirmed and not started: its status
    `cancelled`, its held rows released (`releaseTime`), and a
    `booking_cancelled` timeline entry on the contact. Already cancelled:
    answers that, writes nothing (decision 4). Started: refuses, writes
    nothing.
  - `booking_cancelled` joins the activity types in `packages/shared`, and
    migration 0017 regenerates the timeline's type check.
  - `POST /public/bookings/:token/cancel`: answers the page's view with status
    `cancelled`; 404 for a bad link; 409 `already_started` once the
    appointment has started.
  - **Done when** saved tests, against the local database: a cancel marks the
    booking cancelled, releases its rows and writes one timeline entry; the
    free-times route offers the time again; a second cancel answers the same
    and writes nothing more; a started booking is refused and nothing
    changes; two cancels at the same instant make one cancel; another
    business's booking is never touched; nothing in the answer, the log or
    the timeline payload carries the customer's details.

- [x] **7a.3 The event leaves the booked person's Google.**
  - The provider seam gains `deleteEvent(accessToken, eventId)`: Google's
    `DELETE`, an event already gone (404, 410) being the answer too; throws
    on any other failure. `backend/lib/calendar/remove-booking-event.ts`
    removes a cancelled booking's event by the id made from the booking,
    saved or not, and clears its `calendarEventId`; no connection does
    nothing, and a person with a connection but no event gets a DELETE that
    Google answers 404, which counts as done.
  - Started by the cancel after its transaction, not awaited, beside the
    Google write and in its shape (decision 5); the removals still running
    can be awaited by tests.
  - **Done when** saved tests, with Google faked: a cancel removes the event
    and clears its id; an event already gone (404 or 410) counts as removed,
    with no warning; no connection makes no call; the DELETE carries the
    person's own access key; a Google error keeps the cancel,
    logs one line with no customer details and leaves the id; the cancel's
    answer does not wait for Google.

- [x] **7a.4 Both are told.**
  - `bookingIcs` gains the cancelling form: `METHOD:CANCEL`,
    `STATUS:CANCELLED`, the same UID, `SEQUENCE:1` (decision 8).
  - `backend/emails/booking-cancelled.tsx` to Jane: "Your booking is
    cancelled", the service and the time it was, the business's phone, never
    the product's name; the withdrawn invite attached
    (`text/calendar; charset=utf-8; method=CANCEL`).
    `backend/emails/booking-cancelled-notification.tsx` to the business:
    "Cancelled: <service>, <day and time>", the customer's name, phone and
    email, Reply to the customer.
  - Sent after the cancel, not awaited, in the shape of the confirmation
    emails: Jane's when she gave an email, the business's always (the
    customer cancelled, so the business needs to hear even for a booking the
    owner made). Keys `booking-cancelled/<id>` and
    `booking-cancelled-notification/<id>`. Each email that went gets an
    `email_sent` timeline entry. Decision 4 of feature 6 holds: a business
    without its addresses, key or time zone sends nothing and logs it.
  - `npm run email:preview` writes the two new emails as well.
  - **Done when** saved tests, with Resend faked: a cancel sends both, the
    cancelling invite attached to Jane's with the booking's UID; a
    phone-only booking sends only the business's; a second cancel sends
    nothing more; Resend failing keeps the cancel and logs one line; the
    templates render the time in the business's zone, no product name, the
    customer's text as text; the preview writes four files, the two new ones
    opened by hand, the screenshots in the log.

- [ ] **7a.5 Jane's page.**
  - `frontend/app/b/[token]/page.tsx`: the booking under the business's name,
    logo and colour; the service, the day and time with the zone named, the
    person; a Cancel button that asks once more ("Cancel this booking?")
    before it sends, locks while sending, and ends on "Your booking is
    cancelled". States: not found ("This link doesn't work. Call the
    business."), already cancelled, already started (with the business's
    phone), and an unexpected failure that keeps the button usable. Called
    through the typed public client, never with the login cookie.
  - The page names the business and never the product (decision 9): its own
    title and no product icon; `noindex`, `Referrer-Policy: no-referrer` so
    the link never leaks to another site, and never cached.
  - Accessible: the confirm step and the result are announced, focus moves to
    the result, the button has a clear name.
  - **Done when** the frontend build and lint pass; checked by hand in the
    browser on a dev booking: the page as Jane sees it, the confirm step, the
    cancelled page, a bad link, a booking already started; the page's title
    and icon carry no product name; the screenshots in the log.

- [ ] **7a.6 The link in Jane's confirmation.**
  - The confirmation email gains "Need to change it? Manage your booking",
    linking `<APP_ORIGIN>/b/<token>`, in the HTML and the plain-text twin.
    Only the customer's email carries it; the business's notification never
    does.
  - **Done when** saved tests: the confirmation carries a link that opens
    the same booking's page (its token reads back to that booking); the
    notification carries none; the preview shows it, opened by hand.

## Files / areas

- `backend/lib/booking/`: `booking-page-token.ts`, `find-booking-page.ts`,
  `cancel-booking.ts`, the after-cancel starts beside
  `booking-event-writes.ts` and `booking-confirmation-emails.ts`
- `backend/lib/calendar/`: `calendar-provider.ts`,
  `google-calendar-provider.ts` (`deleteEvent`), `remove-booking-event.ts`
- `backend/lib/email/`: `booking-ics.ts`, the sending of the two new emails,
  `find-booking-email-recipients.ts` if the cancel rule lives there
- `backend/emails/`: `booking-cancelled.tsx`,
  `booking-cancelled-notification.tsx`, `booking-confirmation.tsx` (the link),
  the preview script
- `backend/routes/public-bookings-routes.ts` (or a new
  `public-booking-page-routes.ts`), `backend/app.ts`, `backend/server.ts`
  and the settings reader (the key)
- `packages/shared/crm/activity-types.ts`, migration 0017
- `frontend/app/b/[token]/`, `frontend/lib/api-client.ts`
- `.env.example`
- their tests

## Data / contracts

**The token** (7a.1, decision 10): `<booking id>.<signature>`,
the signature `base64url(HMAC-SHA256(BOOKING_LINK_KEY, "booking-page:" + bookingId))`,
43 characters. Read back only when it is exactly that shape and the signature
matches in constant time. Never logged, never stored.

**The page's view** (`GET /public/bookings/:token`, 200):

```ts
type BookingPageType = {
  status: "confirmed" | "cancelled";
  canCancel: boolean; // confirmed and not started (decision 11); added in 7a.2
  service: string;
  startsAt: string; // ISO 8601 UTC
  endsAt: string;
  timezone: string; // the business's IANA zone
  person: string; // the booked person's name
  business: {
    name: string;
    logo: string | null;
    brandColor: string | null;
    phone: string | null;
    website: string | null;
  };
};
```

No customer details, no ids but what the link already carries. 404
`not_found` for every bad link, the same body each time.

**Cancel** (`POST /public/bookings/:token/cancel`): 200 the view with
`status: "cancelled"`; 404 `not_found`; 409 `already_started`. Safe to repeat.

**The timeline entry** (7a.2): `type: "booking_cancelled"`, payload
`{ bookingId }`, `actorUserId` null (the customer did it).

**The withdrawn invite** (7a.4): `invite.ics`,
`text/calendar; charset=utf-8; method=CANCEL`; `METHOD:CANCEL`,
`STATUS:CANCELLED`, the booking's UID, `SEQUENCE:1`, the original times.
Stamped (`DTSTAMP`) with the moment of the cancel, read from its timeline
entry, so a retry sends the very same invite.

**The cancellation emails** (7a.4): keys `booking-cancelled/<id>` and
`booking-cancelled-notification/<id>`; each that went gets an `email_sent`
entry with `kind` `booking_cancellation` or
`booking_cancellation_notification` (feature 6's two kinds keep theirs).

**The page** (7a.5): `/b/<token>` on the frontend's origin (`APP_ORIGIN`).

## Testing

Backend Vitest against the local database, as feature 6: businesses of the
tests' own, removed after; Google and Resend faked, no test reaches either.
The token functions are pure. Each case on the feature's Simulate page is a
saved test under the same name, in the step that builds its rule. The page is
checked by hand in the browser (there is no browser test harness), with
screenshots in the log.

## Notes for the AI

- The booking's id is a `randomUUID()`; the token adds the signature, so the
  id alone opens nothing.
- Read the booking through its own business: the token gives the booking id,
  the booking row gives its business, and every other read uses that
  business.
- `releaseTime` takes commitment ids: select the booking's own active rows
  first, inside the transaction.
- Lock the booking row (`for update`) before deciding, so two cancels at once
  make one.
- The Google event's id is the booking id without dashes; removing it must
  treat 404 and 410 as done.
- The root layout's title says the product's name: the page overrides it.
- Never put a token, a customer's details or a key in a log line. Railway's
  and Vercel's own access logs do record request paths, the link included:
  that comes with the link being the key (decision 10), and is named at
  deploy.
- From step 7a.3: the event is removed by the id made from the booking, so a
  cancel before its id was saved still removes it. One gap is left: a cancel
  in the first moment after booking, whose Google write finishes after the
  removal, leaves the event in place. Feature 8's retries close it.
- From step 7a.3's review, for 7b: Google keeps a deleted event's id, and a
  new event with the same id is refused (409), which `createEvent` reads as
  "already there". So 7b moves an event by updating it in place, never by
  deleting and writing it again.
- From step 7a.2's review: 7a.3 and 7a.4 start Google and the emails only
  when the cancel changed something (`alreadyCancelled` false), so a second
  press never removes or emails twice. `cancelBooking` fixes the actor to the
  customer and refuses after the start; the owner's screens (features 11 and
  12b) will need their own actor, and may need to cancel after the start.
- From step 7a.1's review: a business may have the slug `bookings`, which
  sits where `/public/bookings/...` does. Nothing collides today; reserve the
  slug before 7b adds more routes there. 7a.2 adds a test that a cancelled
  booking's page still opens.
- Deploy note: `BOOKING_LINK_KEY` on Railway; migration 0017; the domain in
  `APP_ORIGIN` is what Jane sees in her link, so it must not carry the
  product's name.

## Open questions

Each blocks only the step named; Frank answers it when that step's plan is
gone through.

1. Answered 2026-10-03: decision 10.
2. Answered 2026-10-03: decision 11.
