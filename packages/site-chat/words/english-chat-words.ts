import type { ChatWordsType } from "./chat-words-type.js";

/** The chat's English lines, written for any business; a site overrides the ones that should name its work. */
export const englishChatWords: ChatWordsType = {
  float: {
    button: "Ask us",
    title: "Our AI",
    greeting: "Hi! Ask me anything about what we do, how it works or how to get started.",
    hello: "Can I help? I answer questions right away.",
    open: "Open the chat with our AI",
    close: "Close the chat",
    dismiss: "Dismiss",
  },
  placeholder: "Type, or tap the mic and talk...",
  send: "Send",
  voice: {
    mic: "Talk instead of typing",
    listening: "Listening... speak now",
    micBlocked: "The mic is blocked. Allow it in the browser, or type instead.",
    notCaught: "I didn't understand that. Tap the mic and try again.",
    tapAgain: "Tap the mic again.",
    speechLang: "en-US",
  },
  paths: {
    book: "Happy to. Pick a time that suits you on the next screen.",
    call: "Happy to. Tap below to call us.",
    message:
      "A person reads every message and replies as soon as they can. Tap below to write to us.",
  },
  ctas: { book: "Book a time", call: "Call us", message: "Write to us" },
  ways: {
    label: "Ways to talk to a person",
    names: {
      book: { label: "Book", title: "Pick a time that suits you" },
      call: { label: "Call", title: "Call us" },
      message: { label: "Email", title: "Write us an email" },
    },
  },
  handOver:
    "That question goes beyond what I can answer here, and a person will answer it properly. Pick how you'd like to reach us.",
  limit: "That's a lot of questions for one visit! A person can take it from here.",
  offTopic:
    "I can only help with questions about our work. Ask me what we do, or how to get started.",
  greeting: "Happy to help! Ask me anything about what we do, how it works or how to get started.",
  suggest: "Did you mean one of these?",
};
