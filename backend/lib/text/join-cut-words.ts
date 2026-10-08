// Backend: words left after a text was cut to fit, joined so they never end on a joining mark:
// "Summit Painting, Decorating &" reads "Summit Painting, Decorating" (feature 8b, decision 4).

export function joinCutWords(words: string[]): string {
  return words.join(" ").replace(/[\s&+,;:/(-]+$/, "");
}
