// TypeSafe's answer as the tests stand it in: what Jev would send back for one message.

export interface JevStandInType {
  pick?: string; // "q0", "q1"... or "none"
  pickConfidence?: number;
  intent?: string;
  intentConfidence?: number;
  oneThing?: number;
  clarity?: number;
  english?: number;
  spanish?: number;
}

export function jevAnswers(read: JevStandInType = {}) {
  const pick = read.pick ?? "q0";
  const pickConfidence = read.pickConfidence ?? 0.9;
  const intent = read.intent ?? "question";
  const intentConfidence = read.intentConfidence ?? 0.9;
  return {
    answers: {
      answer: {
        type: "choice",
        choice: pick,
        confidence: pickConfidence,
        probabilities: { [pick]: 0.9, none: 0.05, q1: 0.03 },
      },
      intent: {
        type: "choice",
        choice: intent,
        confidence: intentConfidence,
        probabilities: { [intent]: 0.9 },
      },
      oneThing: { type: "noul", noul: read.oneThing ?? 0.9 },
      clarity: { type: "score", score: read.clarity ?? 3 },
      english: { type: "noul", noul: read.english ?? 0.95 },
      spanish: { type: "noul", noul: read.spanish ?? 0.02 },
    },
  };
}

/** A `fetch` that answers every Jev call with `read`, and remembers what it was sent. */
export function jevFetch(read: JevStandInType | (() => Response)) {
  const sent: { url: string; body: unknown }[] = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return typeof read === "function" ? read() : Response.json(jevAnswers(read));
  }) as typeof fetch;
  return { fetchFn, sent };
}
