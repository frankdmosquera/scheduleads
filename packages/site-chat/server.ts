// Site chat, the server side: the two route handlers a site mounts, one line each, and the brief they answer from.
// The keys are the site's own, read from its environment: OPENAI_API_KEY, TYPESAFE_API_KEY (Jev; TYPESAFE_BASE_URL
// for a stand-in) and GOOGLE_TTS_API_KEY (the voice). Without one, that part steps aside: no Jev means the AI
// answers everything, no voice means the browser's voice speaks, no OpenAI key means a person is offered.
//
//   // app/api/chat/route.ts
//   export const POST = createChatRoute({ sites: [{ lang: "en", answers, words, brief }] });
//
//   // app/api/chat/voice/[id]/route.ts
//   export const GET = createVoiceRoute({ sites: [...], cacheSound: (make) => unstable_cache(make, ["chat-voice"]) });

export { createChatRoute, type ChatRouteOptionsType } from "./server/create-chat-route.js";
export {
  createVoiceRoute,
  type MakeSoundType,
  type VoiceRouteOptionsType,
} from "./server/create-voice-route.js";
export type { ChatSiteType } from "./server/chat-site-type.js";
export {
  buildChatBrief,
  type ChatBriefPartsType,
  type ChatBriefType,
} from "./server/chat-brief.js";
export { englishBriefWords, type ChatBriefWordsType } from "./server/english-brief-words.js";
