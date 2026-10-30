# Feature: The chat that books

**From build-plan:** feature 13d

**Size:** heavy. Three separate risks with real logic: an AI that answers from a site's own words, a booking flow that must follow each business's form, and the AI's cost on a public page.

**Branch:** `feature/13d-the-chat-that-books`

**Status:** specced

## Goal

Primo Painters' and Face and Body's sites get the same chat ialaorden.com runs (feature 32 in `agency-site-app`, live and proven on Oct 30): it answers a visitor's questions from the site's own words, and books a service in the conversation. The AI reads the visitor's words; our code checks every field and books only on a yes, through the same public booking routes the booking window uses. No Agent app, no new Booking CRM route, no sign-in. Built once as a package both sites install, so a fix reaches every site.

## In scope

- One package, `@frankdmosquera/site-chat`, in `packages/site-chat/`, packed into a site's `vendor/` like the booking window:
  - **client part**: the corner chat (button, panel, hello once per visit), the questions-and-answers chat, the booking steps, times as buttons, the read-back, the dev inspector on the laptop only;
  - **server part**: two Next route handlers a site mounts with one line each, `/api/chat` (answers, streamed) and `/api/chat/booking` (booking fields only), with the same rules as IA a la Orden's: same-origin check, JSON only, hourly limit per visitor, fields-only structured output for booking, the visitor's text never logged.
- Ported from `agency-site-app` as built (hand-off `agency-site-app/blueprint/reference/chat-booking-handoff.md`, sections 3, 3b, 5): `askedDay`, `chatTimes`, `chatBookingFlow`, `chatBooking`, `sentences`, `fromOurSite`, `hourlyLimit`, the booking route, the answers route, the inspector.
- **Jev** (Frank, Oct 30: "that's the main thing"), as IA a la Orden runs it: stored answers picked by Jev (TypeSafe, `jev-latest`) before the AI, its chips and related answers; each site's answer bank made from its own FAQ and services.
- **Voice** (Frank, Oct 30), as IA a la Orden runs it: listening and speaking aloud through Google TTS, the voice choice, the spoken lines.
- **The booking follows each business's form**, read from the public `booking-links` answer: name, then its contact rule (`email`, `phone`, `either`, `both`), the address when the service requires it, the project box (its words, required or not), the business's own questions. Primo: name, email, phone, address, project, all required. Face and Body: her rule.
- **What the visitor asked reaches the CRM**: the booking's `details` carry the project answer, or the visitor's question when the form has no project box (hand-off point 2).
- **The site's words**: each site gives the chat a brief built from its own data files (Primo: `data/serviceData.ts`, `faqData.ts`, `processSteps.ts`, `promiseData.ts`, `siteConfig.ts`; Face and Body: `servicesData.ts`, `faqData.ts`, `visitData.ts`, `siteConfig.ts`) plus one `chatFacts` file of decided facts no page says. The AI answers only from it; anything else gets "someone from <business> can confirm".
- Primo first (13d.1, 13d.2), then Face and Body (13d.3), each on the laptop, then live on Frank's yes.

## Out of scope

- IA a la Orden's package-total tool (it prices the agency's own packages); each site's prices reach the chat through its own words. WebMCP is its own later part (Primo's part 3).
- Any change to `agency-site-app` (told to the IA a la Orden session first if one is ever needed).
- Booking CRM backend routes, tables or migrations: the chat uses the existing public booking routes as they are.
- Counting each business's AI cost in the CRM, a chat Settings page, self-serve setup: later, named.
- Spanish on these two sites (both are English today); the words file has a Spanish shape ready because the package carries both.

## Build loop

Heavy: each step is planned with Frank (both parts) and gets his yes; then it runs straight through without stopping: build, its tests, tick the box, the build log entry, commit (not pushed: Frank, Oct 29, push once per feature), `/audit` scoped to the step, then an independent review. The one planned stop is after the review. Installing a package, touching a client's live site, Vercel or real data stops for his yes.

## Build steps

- [x] **13d.1 Primo's chat answers from his site.** The package's client chat and its `/api/chat` handler with Jev first and the AI after, voice on; Primo's answer bank and brief from his data files and `chatFacts`; mounted in Primo's site (a branch off his `main`, a worktree like 13). Jev, the AI and voice are IA a la Orden's: TypeSafe `jev-latest`, Vercel AI SDK `streamText`, `gpt-5.4-mini`, reasoning none, Google TTS, same limits. **Done when:** on http://localhost:3403 the corner chat opens, Jev answers a stored question ("do you paint exteriors?") with its chips, the AI answers "how does the estimate work?" from his words, it says a person can confirm for something his site never says, an answer is spoken aloud, a call from another origin is refused, and the package's tests pass.
- [x] **13d.2 Primo books in the chat.** The booking steps, the `/api/chat/booking` handler and the field checks, following his form (name, email, phone, address, project); times from his live `times` route; one request key per booking; `time_taken`, `request_key_used` and 429 handled. **Done when:** on http://localhost:3403 a conversation like Frank's Oct 30 test books a Free Estimate on the laptop's Primo, a second "yes" never books twice, a missing phone or address is asked for, and the lead shows the project answer in its details; the 83 cases of `check-chat-booking.mjs`, ported, pass with a stand-in CRM and a stand-in AI.
- [ ] **13d.3 Face and Body gets the same chat.** Her brief from her data files and `chatFacts`, mounted in her site; her form's rule. **Done when:** on http://localhost:3402 she answers from her words and books a treatment on the laptop. Then both sites live on Frank's yes: the OpenAI key added to each Vercel project, both sites merged and deployed, one real chat booking on each.

## Files / areas

- `packages/site-chat/` (new): `package.json` (`private`, packed like the booking window), `index.ts` (client), `server.ts` (route handlers), `words/`, its tests, `check-dist-imports.mjs` allowing `react`, `react-dom`, `zod`, `ai`, `@ai-sdk/openai`.
- Root `package.json` workspaces: the new package.
- Primo's repo (worktree off his `main`): `app/api/chat/route.ts`, `app/api/chat/booking/route.ts`, `data/chatFacts.ts`, the chat in `app/layout.tsx`, `vendor/`.
- Face and Body's repo: the same.
- Read only: `agency-site-app` files named above; `backend/routes/public-booking-links-routes.ts` for the business answer the flow reads.

## Data / contracts

- Booking goes to the existing `POST /public/:slug/bookings` with `{bookingLinkId, startsAt, customer{name, email?, phone?, address?}, answers?, details?, language, requestKey}`; its refusals (`answer_needed`, `time_taken`, `request_key_used`, 429) are read, and an `answer_needed` asks the named question in the chat instead of failing.
- The booking route returns fields only: `{understood: {time (index into the offered list), day, part, name, email, phone, address, details, book, cancel, other, reply}}`; the AI never books and never says "booked".
- A site's server needs `OPENAI_API_KEY`, `TYPESAFE_API_KEY`, `TYPESAFE_BASE_URL` and `GOOGLE_TTS_API_KEY`, the same keys IA a la Orden uses (laptop `.env.local`, then Vercel). Nothing new in Booking CRM's `.env`.
- The visitor's text is never logged; only token counts.

## Testing

- `npm run test --workspace=@frankdmosquera/site-chat` (Vitest): the field checks, the form-following steps, `askedDay`, `sentences`, the ported booking cases with a stand-in CRM and AI.
- By hand on the laptop sites (3403, 3402) for each step's Done when; live only on Frank's yes.

## Notes for the AI

- Copy IA a la Orden's behaviour, not a redesign. Where a coupling must be cut (its cards beside the chat, video/phone kinds, `siteConfig`), say so in the step report.
- New packages (`ai`, `@ai-sdk/openai` in the two sites and the package's dev setup) need Frank's yes before install.
- Named shortcut, kept from IA a la Orden: the hourly limit lives in memory and the spend cap is the browser's count plus the provider's monthly limit. On Vercel each site is its own; a real per-business cap belongs to the later "count AI cost in the CRM" work.
