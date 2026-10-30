// A small made-up site the tests answer from: three stored answers, one group, other wordings and tiles.
import type { ChatAnswersType } from "./answers/chat-answers-type.js";
import type { ChatSiteType } from "./server/chat-site-type.js";
import { englishChatWords } from "./words/english-chat-words.js";

export const testAnswers: ChatAnswersType = {
  stored: [
    { question: "What services do you offer?", answer: "We paint walls, ceilings and cabinets." },
    { question: "How long does a project take?", answer: "Most take one to five days." },
    {
      question: "Can I talk to someone?",
      answer: "Of course. Pick how to reach us.",
      offersPerson: true,
    },
  ],
  groups: [
    ["What services do you offer?", "How long does a project take?", "Can I talk to someone?"],
  ],
  alsoAsked: { "What services do you offer?": ["What do you paint?"] },
  tiles: [
    {
      question: "What services do you offer?",
      tiles: [{ label: "Walls", note: "Smooth finishes" }],
    },
  ],
};

export const testSite: ChatSiteType = {
  lang: "en",
  answers: testAnswers,
  words: englishChatWords,
  brief: {
    business: {
      name: "Test Painters",
      about: "a painting company in Calgary",
      area: "Calgary",
      phone: "(555) 555-0100",
    },
    facts: ["We paint interiors only."],
    pages: [{ title: "Our Process", lines: ["Book your estimate.", "We prepare every surface."] }],
  },
};
