import { describe, expect, it } from "vitest";
import { namesOtherDetail } from "./detail-words.js";

const words = ["Hydra Spa Facial", "Deep Tissue Massage", "Facials", "facial", "Body"];

describe("a message naming a detail the picked answer does not", () => {
  it("goes past a stored answer that only sounds close", () => {
    expect(
      namesOtherDetail(
        "How much is the hydra spa facial?",
        ["Why do some treatments not show a price?"],
        words
      )
    ).toBe(true);
    expect(
      namesOtherDetail(
        "how much is a deep tissue massage",
        ["Do I need a consultation first?"],
        words
      )
    ).toBe(true);
  });
  it("keeps a stored answer that names it too, and one with no detail named", () => {
    expect(namesOtherDetail("do you do facials?", ["Facials: what we offer"], words)).toBe(false);
    expect(
      namesOtherDetail(
        "Where are you, and is there parking?",
        ["Where are you, and is there parking?"],
        words
      )
    ).toBe(false);
  });
  it("matches whole words only, any case and accents", () => {
    expect(namesOtherDetail("somebody help", ["x"], words)).toBe(false);
    expect(namesOtherDetail("BODY treatments?", ["x"], words)).toBe(true);
  });
});
