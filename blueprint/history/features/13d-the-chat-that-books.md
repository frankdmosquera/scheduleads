# Feature: The chat that books

**From build-plan:** feature 13d

**Size:** heavy. Three separate risks with real logic: an AI that answers from a site's own words, a booking flow that must follow each business's form, and the AI's cost on a public page.

**Branch:** `feature/13d-the-chat-that-books`

**Status:** verified

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
- [x] **13d.3 Face and Body gets the same chat.** (Built Oct 30 in her worktree, branch `feature/site-chat`; live Oct 30 on Frank's yes, keys in both Vercel projects. Proven: a chat booking on her laptop site landed; on live, his chat booked Mon Nov 2 10:00 (Frank) and hers was started by Frank on his phone, its last "yes" not confirmed. Added on Frank's asks: her treatment cards that open and book, the phone typing box, answers checked against both sites. Chat 0.2.10 is committed in both sites; live runs 0.2.9 until Frank's yes.) Her brief from her data files and `chatFacts`, mounted in her site; her form's rule. **Done when:** on http://localhost:3402 she answers from her words and books a treatment on the laptop. Then both sites live on Frank's yes: the OpenAI key added to each Vercel project, both sites merged and deployed, one real chat booking on each.

## Files / areas

- `packages/site-chat/` (new): `package.json` (`private`, packed like the booking window), `index.ts` (client), `server.ts` (route handlers), `words/`, its tests, `check-dist-imports.mjs` allowing `react`, `react-dom`, `zod`, `ai`, `@ai-sdk/openai`.
- Root `package.json` workspaces: the new package.
- Primo's repo (worktree off his `main`): `app/api/chat/route.ts`, `app/api/chat/booking/route.ts`, `data/chatFacts.ts`, the chat in `app/layout.tsx`, `vendor/`.
- Face and Body's repo: the same.
- Read only: `agency-site-app` files named above; `backend/routes/public-booking-links-routes.ts` for the business answer the flow reads.

## Data / contracts

- Booking goes to the existing `POST /public/:slug/bookings` with `{bookingLinkId, startsAt, customer{name, email?, phone?}, location? (the address, top level, as the window sends it), answers?, details?, language, requestKey}`; its refusals (`answer_needed`, `time_taken`, `request_key_used`, 429) are read, and an `answer_needed` asks the named question in the chat instead of failing.
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

## Implementation walkthrough

**The package.** `packages/site-chat` (`@frankdmosquera/site-chat`, 0.2.10 at the end) is ialaorden.com's chat made into one package every site installs from its own `vendor/`, like the booking window: `index.ts` (the chat, client only), `server.ts` (the route factories `createChatRoute`, `createVoiceRoute`, `createChatBookingRoute` and the brief), `words.ts` (shared shapes and English words). Its build bundles with tsdown and `check-dist-imports.mjs` proves the client chat never reaches `ai` or `@ai-sdk/openai`. The AI runs on each site's own Next server with the same keys IA a la Orden uses; Booking CRM's backend gained nothing.

**13d.1 Answers.** Jev (TypeSafe `jev-latest`) first: a sure pick answers in the site's own words, a fairly sure one offers "did you mean" chips; otherwise `streamText` on gpt-5.4-mini answers only from a brief built from the site's data files plus a short facts file, with "someone from <business> can confirm" for anything the site never says. Voice through Google TTS. Same-origin check and an hourly limit; the visitor's text is never logged.

**13d.2 Booking in the chat.** It follows the business's own form as the public booking-links answer gives it (contact rule, address mode, the project box, extra questions): the AI reads each reply into fields, our code checks every field, asks the next question in our words, reads it all back and books only on a plain yes, through the same public route the window uses, with one request key per booking. A picked time changes only on the visitor's own words.

**13d.3 Face and Body, then live.** Her brief comes from her services (every price and length), groups, FAQ, visit and Eminence shelf. With 37 bookable treatments: a treatment named in the question goes straight to its times, words that could mean several (a massage and its longer lengths) offer only those (F-597), and Frank's idea after his phone test replaced a wall of 37 buttons with her five group cards that open in the chat on their treatments, each with a Book button (built on her server, so her catalogue never reaches the browser). The phone panel takes the visible screen's height (100dvh) so the typing box shows. A 20-questions-per-site check against each live site found nine weak answers; fixed by sending a question that names one of her treatments or groups to the AI unless Jev's pick (or its other wordings) names it too, a rule against claims beyond a site's words, Primo's plain answers for exteriors and small offices as stored answers from his facts, and his banner offer read from the banner. Live Oct 30 on Frank's yes: the three keys in both Vercel projects, both sites merged and deployed; his real chat booking landed.

**Non-obvious decisions.** Each site keeps its own facts in `data/chatFacts.ts`, its lines from the site or from Frank's rules (Primo: interiors only, small commercial yes). Treatments priced at consultation get no Book button and no stated length, as on her pages. The hourly limit is per server instance (a named shortcut kept from IA a la Orden). Primo moved from 0.2.3 to the shared version once the phone fix applied to both.

**State at completion.** Both sites run chat 0.2.9 live; 0.2.10 (the final review's two P2 fixes) is committed on each site's `feature/site-chat` and goes live on Frank's yes. Carried: F-593, F-596, F-598, F-600, F-601 (the answers route caps neither the whole call nor its assistant turns), F-602.

## Findings

### 13d/F-591 [P2] closed - The packed chat held stray build files from the booking window

**File:** primo-painters vendor/frankdmosquera-site-chat-0.1.0.tgz
**Found:** 2026-10-30 by independent review of 13d.1 (ba8e703, Primo 612672e)
**Why it matters:** The tarball carried `dist/site-colours.*` and `readable-on-*.js` (which imports `hono/client`), not built from this commit, so what shipped was not what check-dist-imports approved, and 0.1.0 could never be repacked.
**Suggested fix:** Bump, clean `dist/`, repack.
**Resolution:** Fixed 2026-10-30: 0.1.1 packed from a clean `dist/`, 14 files, none of the strays.

### 13d/F-592 [P2] closed - The chat's stored answer implies Primo does not paint exteriors, while his site says exteriors

**File:** primo-painters data/chatAnswers.ts:39
**Found:** 2026-10-30 by independent review of 13d.1
**Why it matters:** "Do you paint exteriors?" is a wording of "What services do you offer?", whose answer lists interior work only; his gallery copy and projects page mention exteriors. Jev's sure pick skips the brief's "someone can confirm" rule, so the chat implies a no his site contradicts.
**Suggested fix:** Frank decides whether Primo paints exteriors; then the fact goes into `chatFacts` and the stored answer, or the wording is removed so the AI says someone can confirm.
**Resolution:** Closed 2026-10-30: Frank, interiors only, as the site sells; `chatFacts` says so (Primo 0d5e182). The site is the chat's source; what it never says gets "someone can confirm".

### 13d/F-594 [P2] closed - 13d.2 review: three booking-in-the-chat gaps

**File:** packages/site-chat/booking/chat-booking.ts, chat/chat-conversation.tsx, server/create-chat-booking-route.ts
**Found:** 2026-10-30 by independent review of 13d.2 (25fca6b, Primo 8ab0c97)
**Why it matters:** (1) a skipped project box sent the visitor's opening question as details, never read back; (2) a reply that sounds like a time ("Yes, book it for Saturday") restarted an open booking and lost it; (3) the booking AI route took unbounded client text, an open LLM proxy for scripts.
**Suggested fix:** send the opening question only with no project box; skip the time-ask path while a booking is open; cap turns, fields and arrays.
**Resolution:** Fixed 2026-10-30 in 0.2.1, with 0.2.2 and 0.2.3 fixing two booking-turn bugs the browser check found (a re-read of the times dropped the picked one; an AI echo moved the picked time). Needs a later /audit to close. Closed 2026-10-31 by the independent review of a4854f6: `bookingRequest` sends only the project answer, `asksForNewTime` returns null while a booking is open, and the booking route caps turns, fields, lists and the whole call at 6,000 characters; the picked-time guards (`moveTo`, `pickedNow`, `answering`) hold, with tests.

### 13d/F-595 [P3] closed - 13d.2 review: old time buttons, failed corrections, no AI timeout

**File:** packages/site-chat/chat/chat-conversation.tsx:392, booking/chat-booking.ts:350, :230
**Found:** 2026-10-30 by independent review of 13d.2
**Why it matters:** (4) a time button in an older bubble keeps its own key and could book a second time; (6) a correction that fails our check at the read-back still booked the old value; (8) the booking AI call had no time limit.
**Suggested fix:** only the current booking's buttons tap; any field the AI returned counts as a change; a timeout with the word-list fallback.
**Resolution:** Fixed 2026-10-30 in 0.2.1. Needs a later /audit to close. Closed 2026-10-31 by the independent review of a4854f6: `onTime` and `onService` ignore any booking but the open one, a field the AI heard that fails our check counts as `refused` and reads back again, and `bookingAi` gives up after 6 s (`AbortSignal.timeout`) for the word lists, the route aborting with the request.

### 13d/F-597 [P1] closed - 13d.3 review: a treatment named in the question could book the wrong one

**File:** packages/site-chat/booking/booking-flow.ts (namedServices, pickedService), booking/chat-booking.ts (startBooking)
**Found:** 2026-10-30 by independent review of 13d.3 (439ba95, her site ea553b2)
**Why it matters:** (1) "a 90 minute relaxation massage" matched only "Relaxation Massage" and went straight to the 60 minute one's times, the 75 and 90 minute lengths never shown; (2) two separate names ("chemical peel or the hollywood peel facial", "not deep tissue, a relaxation massage") picked the longest; (3) at the service step without the AI, `pickedService` took the first name in the list; (4) no tests for these.
**Suggested fix:** straight to times only when exactly one service is meant; otherwise offer just the services it could mean.
**Resolution:** Fixed 2026-10-30 in 0.2.5: `namedServices` returns every service the words could mean (a name held in another named one counts as the longer; a name other services hold brings them in); one goes straight to its times, several are the only buttons, and the no-AI step asks again instead of taking the first. Five tests with her real names; checked on http://localhost:3402 ("a 90 minute relaxation massage" offered her four relaxation massages). Closed 2026-10-31 by the final independent review of 13d, which probed it with her 37 names.

### 13d/F-599 [P2] closed - 13d final review: two gaps in the new chat paths

**File:** packages/site-chat/server/create-chat-route.ts, booking/chat-booking.ts (startBookingFor)
**Found:** 2026-10-31 by the final independent review of 13d (scheduleads 439ba95..940ad07, her site ea553b2..624536b, his 4da2c9e..4fb586a)
**Why it matters:** (1) her detail words sent her own FAQ wordings ("Do you do facials?", "Is there parking for my massage appointment?") to the AI, losing her exact words, the cards and the ways to a person; (2) a Book whose slug Booking CRM does not list looped back to the same cards.
**Suggested fix:** count a pick's other wordings as naming it and start the AI from Jev's picks; fall back to the service's exact name.
**Resolution:** Fixed 2026-10-31 in 0.2.10, 216 tests; the 40 questions plus the reviewer's five rerun on both laptop sites, all right. Needs a later /audit to close. Closed 2026-10-31 by the independent review of a4854f6: the route counts a pick's `alsoAsked` wordings before handing a named service to the AI and starts it from Jev's picks (tested), and `startBookingFor` falls back to `exactService` by name (tested); no new defect found in either path.

## Independent review

**Status:** passed
**Target commit:** a4854f6681669889c00efc7e0c311852475343c7
**Base commit:** 05b66085f99549b597db32bc40d019258cc807b7
**Base ref:** main
**Spec hash:** 34f6395df0fccb4beac36b78254a61f8f871a4fdce8493c1d216e78ce98f79d2
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-31T00:38:42Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-31T00:42:42Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (HEAD, merge base and spec hash match; only review.md differs)
- `npm run test --workspace=@frankdmosquera/site-chat`: pass (build and dist import check, then 13 files, 216 tests)
- `npm run build --workspace=@frankdmosquera/site-chat`: pass (14 files; dist imports only react, react-dom, zod, ai, @ai-sdk/openai; the chat reaches neither ai nor the provider)
- `npm run test --workspace=@scheduleads-app/shared`: pass (37 files, 232 tests)

### Evidence

- Reviewed the whole 05b6608..a4854f6 delta (85 files): `packages/site-chat/` server routes (answers, booking AI, voice), Jev, the brief and markers, booking API, source, flow, chat-booking, chat UI, build and pack scripts; the Primo client setup, launch.json, AGENTS.md and planning docs.
- Security: both POST routes check JSON and same-origin, parse with zod, rate-limit per address, log counts only and never the provider's error text; the voice route speaks only server-held lines in listed voices; the booking calls omit credentials and time out; the chat renders text only.
- Re-examined F-594, F-595, F-599 in the repaired code and their tests: closed.

### Findings

- F-601 [P2] open: the answers route caps neither the whole call nor visitor-written assistant turns (about 76,500 characters per call).
- F-602 [P3] open: launch.json points at a transient worktree; pack script duplicates F-550; spec line on the opening question as details is stale.
- F-594, F-595, F-599 moved from fixed to closed.

### Remaining risk

- Check not run (not required): no browser or live-site evidence was gathered in this review; the laptop sites and live sites were not exercised.
- No frontend or chat UI tests exist for the card and tile paths (carried in F-600 (11)).
- The site repos' own changes (Primo, Face and Body: data files, chatFacts, mounted routes) are outside this repo and were not reviewed here.
- The hourly limit is per server instance and keys on the first `x-forwarded-for` (F-593 (5)), the spec's named shortcut.
