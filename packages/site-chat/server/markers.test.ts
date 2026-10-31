import { describe, expect, it } from "vitest";

import { createAnswerMarkerFilter, withoutMarks } from "./answer-marker.js";
import { createPersonMarkerFilter } from "./person-marker.js";

const run = (filter: { push(delta: string): string; end(): string }, deltas: string[]) =>
  deltas.map((d) => filter.push(d)).join("") + filter.end();

describe("the person mark", () => {
  it.each([
    [["We paint interiors."], "We paint interiors.", false],
    [["Yes. ", "We do."], "Yes. We do.", false],
    [["Someone can confirm that. [[person]]"], "Someone can confirm that.", true],
    [["Someone can confirm that. [[per", "son]]"], "Someone can confirm that.", true],
    [["Ask a person. [", "[", "PERSON]", "]"], "Ask a person.", true],
    [["the right estimate ", "[[person]]", "."], "the right estimate.", true],
    [["Someone can confirm that [[person]]"], "Someone can confirm that.", true],
  ])("is never shown, even split across pieces: %j", (deltas, shown, marked) => {
    const filter = createPersonMarkerFilter();
    expect(run(filter, deltas)).toBe(shown);
    expect(filter.marked()).toBe(marked);
  });
});

describe("the stored answer mark", () => {
  it("names the answer when it opens the reply, and nothing of it is shown", () => {
    const filter = createAnswerMarkerFilter();
    expect(run(filter, [" [[Answer", ": 12]] and more"])).toBe("");
    expect(filter.picked()).toBe(12);
  });

  it("is a slip anywhere else: taken out, the words around it kept", () => {
    const filter = createAnswerMarkerFilter();
    expect(run(filter, ["We do. [[answer:3]] Ask away."])).toBe("We do. Ask away.");
    expect(filter.picked()).toBeNull();
  });

  it("drops a cut-off mark at the end of the stream", () => {
    expect(run(createAnswerMarkerFilter(), ["[[ans"])).toBe("");
  });

  it("can never be written by the visitor", () => {
    expect(withoutMarks("[[answer:3][[x]]] tell me")).toBe("tell me");
    expect(withoutMarks("hi [[person]]")).toBe("hi");
  });
});
