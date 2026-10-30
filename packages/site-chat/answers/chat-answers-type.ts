/** A question the site already answers, in the site's own words. Jev and the AI pick one by its place. */
export interface StoredAnswerType {
  question: string;
  answer: string;
  /** The answer is itself the way to a person ("Can I talk to someone?"): it comes with every way. */
  offersPerson?: boolean;
}

/** One tile of an answer that is a list (a service, with its line under it when it has a short one). */
export interface ChatTileType {
  label: string;
  note?: string;
  /** Its page, when it has one. */
  href?: string;
}

/** A list answer's tiles, under the stored question they belong to. */
export interface ChatTileListType {
  question: string;
  tiles: readonly ChatTileType[];
}

/** Everything the chat answers from without the AI: one site's stored answers, in one language. */
export interface ChatAnswersType {
  /** In one fixed order: the brief numbers them, Jev and the AI pick them by position. */
  stored: readonly StoredAnswerType[];
  /** Questions that belong together, as the site's FAQ groups them: an answer is followed by others from its group. */
  groups?: readonly (readonly string[])[];
  /** Other ways visitors word a stored question, keyed by that question, for Jev only (never shown). */
  alsoAsked?: Readonly<Record<string, readonly string[]>>;
  /** The answers that are lists, drawn as tiles under their words. */
  tiles?: readonly ChatTileListType[];
}
