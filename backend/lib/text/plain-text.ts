// Backend: text as a text message may carry it without costing double (feature 8b, decision 4).
// One character outside the plain set, a curly apostrophe or an accent, re-encodes the whole text
// at 70 characters a piece instead of 160. Accents lose their mark, typographic quotes, dashes and
// spaces become plain ones, and anything else outside printable ASCII goes; so does the backtick,
// which texts cannot carry either.

export function plainText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // the accent marks NFKD split off: "e" + accent becomes "e"
    .replace(/[\u2018\u2019\u201a\u2032\u02bc]/g, "'")
    .replace(/[\u201c\u201d\u201e\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s/g, " ")
    .replace(/[^\x20-\x5f\x61-\x7e]/g, "");
}
