import { describe, expect, it } from "vitest";

import { testSite } from "../test-site.js";
import { buildChatBrief } from "./chat-brief.js";

describe("buildChatBrief", () => {
  const brief = buildChatBrief(testSite.brief, testSite.answers);

  it("names the business in its instructions, and sends what it cannot answer to someone from it", () => {
    expect(brief.typed).toContain(
      "You are the assistant on the website of Test Painters, a painting company in Calgary."
    );
    expect(brief.typed).toContain("say someone from Test Painters can confirm");
    expect(brief.typed).not.toMatch(/\{\w+\}/); // every placeholder filled
  });

  it("holds the business, the facts, the numbered stored answers and every page's words, in that order", () => {
    const at = (text: string) => brief.typed.indexOf(text);
    const parts = [
      "Name: Test Painters. Works in: Calgary.",
      "Phone: (555) 555-0100.",
      "- We paint interiors only.",
      "[0] Q: What services do you offer?\nA: We paint walls, ceilings and cabinets.",
      "[2] Q: Can I talk to someone?",
      "## Our Process\n- Book your estimate.\n- We prepare every surface.",
    ];
    for (const part of parts) expect(at(part), part).toBeGreaterThan(0);
    expect(parts.map(at)).toEqual([...parts.map(at)].sort((a, b) => a - b));
  });

  it("leaves out what the site did not give", () => {
    expect(brief.typed).not.toContain("Email:");
    expect(brief.typed).not.toContain("Hours:");
    const noFacts = buildChatBrief({ ...testSite.brief, facts: [] }, testSite.answers);
    expect(noFacts.typed).not.toContain("Extra knowledge");
  });

  it("adds the spoken line after the whole typed brief, so the brief before it stays cached", () => {
    expect(brief.spoken.startsWith(brief.typed)).toBe(true);
    expect(brief.spoken).toContain("# Spoken answer");
  });

  it("points the AI at Jev's likeliest answers by number, and says nothing when there are none", () => {
    expect(brief.headStart([2, 0])).toContain("Look at these first: [2], [0].");
    expect(brief.headStart([])).toBe("");
  });
});
