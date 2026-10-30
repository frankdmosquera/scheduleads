import { describe, expect, it } from "vitest";

import { answerParagraphs, finishedSentences } from "./sentences.js";

describe("finishedSentences", () => {
  it.each([
    [
      "A small room is $1,490. Want an estimate? ",
      ["A small room is $1,490.", "Want an estimate?"],
      "",
    ],
    ["It takes 1.5 days. Then we", ["It takes 1.5 days."], "Then we"],
    ["Yes!\nA person replies", ["Yes!"], "A person replies"],
    ["Still writing", [], "Still writing"],
    [
      "Un cuarto cuesta $4.470.000 una vez. ¿Quiere una cita? ",
      ["Un cuarto cuesta $4.470.000 una vez.", "¿Quiere una cita?"],
      "",
    ],
    ["¡Con gusto! Una persona", ["¡Con gusto!"], "Una persona"],
  ])("splits %j as it is spoken, never inside a price or a decimal", (text, sentences, rest) => {
    expect(finishedSentences(text)).toEqual({ sentences, rest });
  });

  it('keeps "8:00 a. m." whole: a period before a small letter is not a sentence end', () => {
    expect(
      finishedSentences("Estas están libres: 8:00 a. m. o 9:30 a. m. ¿Cuál le sirve? ")
    ).toEqual({
      sentences: ["Estas están libres: 8:00 a. m. o 9:30 a. m.", "¿Cuál le sirve?"],
      rest: "",
    });
  });

  it('holds "a." at the end of a stream until the next word shows whether it ends the sentence', () => {
    expect(finishedSentences("Free at 8:00 a. ")).toEqual({
      sentences: [],
      rest: "Free at 8:00 a. ",
    });
  });
});

describe("answerParagraphs", () => {
  it.each([
    ["Yes. We paint the room. What else?", ["Yes. We paint the room.", "What else?"]],
    ["Services:\nWalls.\nCeilings.", ["Services:\nWalls.\nCeilings."]],
    ["Not yet. Exteriors are not on our list.", ["Not yet. Exteriors are not on our list."]],
    [
      "No entendí qué hora. Estas están libres: 8:00 a. m., 9:30 a. m. o 10:30 a. m.",
      ["No entendí qué hora.", "Estas están libres: 8:00 a. m., 9:30 a. m. o 10:30 a. m."],
    ],
  ])("puts %j into paragraphs as meant", (text, paragraphs) => {
    expect(answerParagraphs(text)).toEqual(paragraphs);
  });
});
