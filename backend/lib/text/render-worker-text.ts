// Backend: the text that tells the booked worker about their day (feature 8c, decision 4), under
// the business's name and never the product's: what happened, when, who, what and where, so they
// can show up. Never the customer's phone or her booking page link. One piece: too long, the
// business name loses words first, then the address from its end, then the service, each down to
// one word; the time and the customer's name are never cut. A text still too long goes in two.

import { fitBusinessName } from "./fit-business-name.js";
import { formatTextTime } from "./format-text-time.js";
import { joinCutWords } from "./join-cut-words.js";
import { plainText } from "./plain-text.js";
import { textPieceLength } from "./text-piece-length.js";

export type WorkerTextKindType = "added";

export type WorkerTextFactsType = {
  businessName: string;
  startsAt: Date;
  timezone: string;
  customerName: string; // as typed: made plain here
  serviceName: string;
  placeName: string | null; // the room, when the service needs one
  location: string; // the customer's address, as typed
};

const ONE_PIECE = 160;

// What happened to the worker's day, as the text says it.
const WHAT: Record<WorkerTextKindType, string> = { added: "new booking" };

const wordsOf = (typed: string) => plainText(typed).trim().split(/\s+/);

export function renderWorkerText(kind: WorkerTextKindType, facts: WorkerTextFactsType): string {
  const when = formatTextTime(facts.startsAt, facts.timezone);
  const customer = plainText(facts.customerName).trim();
  const place = facts.placeName && plainText(facts.placeName).trim();
  let service = wordsOf(facts.serviceName);
  let address = wordsOf(facts.location);
  const write = () =>
    fitBusinessName(facts.businessName, (name) => {
      const who = [customer, joinCutWords(service), place, joinCutWords(address)].filter(Boolean);
      return `${name}: ${WHAT[kind]} ${when}. ${who.join(", ")}`;
    });

  let text = write();
  while (textPieceLength(text) > ONE_PIECE && address.length > 1) {
    address = address.slice(0, -1);
    text = write();
  }
  while (textPieceLength(text) > ONE_PIECE && service.length > 1) {
    service = service.slice(0, -1);
    text = write();
  }
  return text;
}
