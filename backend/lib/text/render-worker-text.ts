// Backend: the texts that tell the booked worker about their day (feature 8c, decision 4), under
// the business's name and never the product's: what happened, when, who, what and where, so they
// can show up. A booking taken off their day says no room or address: they no longer go. Never
// the customer's phone or her booking page link. One piece: too long, the business name loses
// words first, then the address from its end, then the service, each down to one word; the time
// and the customer's name are never cut. A text still too long goes in two.

import { fitBusinessName } from "./fit-business-name.js";
import { formatTextTime } from "./format-text-time.js";
import { joinCutWords } from "./join-cut-words.js";
import { plainText } from "./plain-text.js";
import { textPieceLength } from "./text-piece-length.js";

export type WorkerTextKindType = "added" | "moved" | "removed";

export type WorkerTextFactsType = {
  businessName: string;
  startsAt: Date; // the time the text says: for a booking taken off, the one they had
  timezone: string;
  customerName: string; // as typed: made plain here
  serviceName: string;
  placeName: string | null; // the room, when the service needs one
  location: string | null; // the customer's address, as typed; null when none was asked
};

const ONE_PIECE = 160;

// What happened to the worker's day, as the text says it.
const WHAT: Record<WorkerTextKindType, string> = {
  added: "new booking",
  moved: "moved to",
  removed: "off your day,",
};

const wordsOf = (typed: string) => plainText(typed).trim().split(/\s+/);

export function renderWorkerText(kind: WorkerTextKindType, facts: WorkerTextFactsType): string {
  const when = formatTextTime(facts.startsAt, facts.timezone);
  const customer = plainText(facts.customerName).trim();
  const goes = kind !== "removed";
  const place = goes && facts.placeName && plainText(facts.placeName).trim();
  let service = wordsOf(facts.serviceName);
  let address = goes && facts.location ? wordsOf(facts.location) : [];
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
