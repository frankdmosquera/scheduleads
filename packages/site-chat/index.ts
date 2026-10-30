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
//     links={{ call: "tel:+1...", message: "mailto:..." }} onWay={(path) => openBooking()} />
//
// The routes, one file each (see server.ts): app/api/chat/route.ts and app/api/chat/voice/[id]/route.ts.
// The look comes from the host: import "@frankdmosquera/site-chat/site-chat.css" and define the --sc-* tokens.

export { SiteChat, type SiteChatPropsType } from "./chat/site-chat.js";
export type { PersonWayLinksType } from "./chat/person-ways.js";
