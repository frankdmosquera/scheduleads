/** The languages the chat's words and brief can be written in. */
export type ChatLanguageType = "en" | "es";

/** The ways a visitor can ask for a person, each opened by the site (a link, or its own booking). */
export const personPaths = ["book", "call", "message"] as const;
export type PersonPathType = (typeof personPaths)[number];

/** Every fixed line the chat says, in one language. A site overrides any of them. */
export interface ChatWordsType {
  /** The chat in the corner of every page. */
  float: {
    /** The corner button's words. */
    button: string;
    /** Over the open chat. */
    title: string;
    /** The chat's first line when opened. */
    greeting: string;
    /** Said once per visit beside the button, after a while. */
    hello: string;
    /** The buttons' names for screen readers. */
    open: string;
    close: string;
    dismiss: string;
  };
  placeholder: string;
  send: string;
  /** Asking out loud. `speechLang` is the browser's recognizer language ("en-US"). */
  voice: {
    mic: string;
    listening: string;
    micBlocked: string;
    notCaught: string;
    tapAgain: string;
    speechLang: string;
  };
  /** The reply when a visitor asks for that way to a person; its button opens under it. */
  paths: Record<PersonPathType, string>;
  /** The button under that reply. */
  ctas: Record<PersonPathType, string>;
  /** The ways to a person, as pills under a hand-over: each one's name and the longer line a pointer shows. */
  ways: { label: string; names: Record<PersonPathType, { label: string; title: string }> };
  /** When nobody can answer (the AI's person mark, no connection, no key): the line above every way to a person. */
  handOver: string;
  /** When one visit has asked the AI more than its limit. */
  limit: string;
  /** A question that has nothing to do with the business: a fixed polite reply, no AI. */
  offTopic: string;
  /** A message that only says hello, thanks or goodbye: a friendly reply, never a person. */
  greeting: string;
  /** Jev is fairly sure: the line above its likeliest stored questions, shown as buttons. */
  suggest: string;
}
