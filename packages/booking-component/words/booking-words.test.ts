import { describe, expect, it } from "vitest";

import { englishWords } from "./english-words.js";
import { spanishWords } from "./spanish-words.js";

// Every message the shared rules can show on the window's form.
const formMessages = [
  "Enter a name.",
  "That name is too long.",
  "Enter a valid email address.",
  "Enter an email.",
  "Enter a phone number.",
  "That phone number is too long.",
  "Enter an email or a phone number. At least one is required.",
  "Enter a phone that can get texts.",
  "Enter the address.",
  "That address is too long.",
  "Keep it to 2000 characters.",
  "Answer this question.",
  "Keep each answer to 500 characters.",
  "That is too many answers.",
];

describe("the window's words", () => {
  it("says every Spanish word in Spanish, never the English one", () => {
    const sameInBoth = new Set(["language", "minutes"]); // "30 min" reads the same
    // A word as shown: a function with sample names filled in, anything else as it is.
    const shown = (word: unknown) =>
      typeof word === "function" ? String(word("Ana", "9:00")) : JSON.stringify(word);
    for (const [key, english] of Object.entries(englishWords)) {
      if (sameInBoth.has(key)) continue;
      const spanish = spanishWords[key as keyof typeof spanishWords];
      expect(shown(spanish), key).not.toBe(shown(english));
    }
    expect(spanishWords.bookWith("IA a la Orden")).toBe("Reserve con IA a la Orden");
    expect(spanishWords.weekdays).toHaveLength(7);
  });

  it("puts every form message into Spanish, and an unknown one into a general line", () => {
    for (const message of formMessages) {
      expect(spanishWords.formError(message), message).not.toBe("Revise este dato.");
    }
    expect(spanishWords.formError("A message added later.")).toBe("Revise este dato.");
    expect(englishWords.formError("Enter a name.")).toBe("Enter a name.");
  });
});
