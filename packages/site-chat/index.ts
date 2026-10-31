// Site chat: the corner chat a client site mounts once, in its root layout, inside a client component of its own.
//
// A site in any repo installs it from a packed file committed in its own vendor/ folder, like the booking window.
// From this repo's root:
//
//   npm run pack:site --workspace=@frankdmosquera/site-chat -- ../primo-painters
//
// It needs react, react-dom, ai and @ai-sdk/openai in the site. Three entries:
//
//   "@frankdmosquera/site-chat"           this one, the chat (client)
//   "@frankdmosquera/site-chat/server"    the route handlers and the brief (server only)
//   "@frankdmosquera/site-chat/words"     the words, the answers' types and their checks (both sides)
//
// The site's answers (`ChatAnswersType`) live in a data file both sides import from "/words", never from here:
// a value imported from a "use client" module on the server is only a reference.
//
//   <SiteChat words={chatWords} loadAnswers={() => import("@/data/chatAnswers").then((m) => m.chatAnswers)}
//     links={{ call: "tel:+1...", message: "mailto:..." }} onWay={(path) => openBooking()}
//     booking={{ apiUrl: siteConfig.booking.apiUrl, slug: siteConfig.booking.slug }} />
//
// With `booking` (the same CRM address and slug the booking window gets), the chat books in the conversation,
// following the business's own booking form; `onWay("book")` then opens the booking window only when the chat
// cannot read the calendar or a booking fails.
//
// The routes, one file each (see server.ts): app/api/chat/route.ts, app/api/chat/voice/[id]/route.ts and
// app/api/chat/booking/route.ts.
// A page's own control opens the chat with openSiteChat(), from this entry, inside a client component.
// The look comes from the host: import "@frankdmosquera/site-chat/site-chat.css" and define the --sc-* tokens.

export { SiteChat, type SiteChatPropsType } from "./chat/site-chat.js";
export { openSiteChat } from "./chat/open-site-chat.js";
export type { PersonWayLinksType } from "./chat/person-ways.js";
export type { BookingAccountType } from "./booking/booking-api.js";
