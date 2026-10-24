// Every message the dashboard can show has its Spanish (feature 12j): the test reads the code itself,
// the API's refusals, the shared rules and the dashboard's client, so a new English message without
// Spanish fails here before it reaches a Spanish screen.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, test } from "vitest";

import { messageInLanguage, spanishMessageOf, spanishMessages } from "./spanish-messages.js";

const repo = join(import.meta.dirname, "..", "..", "..");

function codeFilesUnder(dir: string, keep: (path: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return ["node_modules", "dist", ".next"].includes(entry.name)
        ? []
        : codeFilesUnder(path, keep);
    }
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && keep(path)
      ? [path]
      : [];
  });
}

const literal = String.raw`("(?:[^"\\]|\\.)*"|\x60(?:[^\x60\\]|\\.)*\x60)`;
const refusalRule = new RegExp(String.raw`refuse\(\s*[^,()]+,\s*` + literal, "g");
const messageRule = new RegExp(String.raw`message:\s*` + literal, "g");
const fallbackRule = new RegExp(String.raw`\?\?\s*` + literal, "g");
// A choice inside refuse(): refuse("code", condition ? "one" : "other").
const choiceRule = new RegExp(
  String.raw`refuse\(\s*"[a-z_]+",\s*[^?"\x60]*\?\s*` + literal + String.raw`\s*:\s*` + literal,
  "g"
);
// A refusal's reason, joined when the code writes it in pieces: reason: "one " + "two".
const piecesRule = new RegExp(
  String.raw`reason:\s*(` + literal + String.raw`(?:\s*\+\s*` + literal + String.raw`)*)`,
  "g"
);
const joined = (pieces: string) =>
  [...pieces.matchAll(new RegExp(literal, "g"))].map((piece) => piece[1].slice(1, -1)).join("");
const anyLiteral = new RegExp(literal, "g");
const isSentence = (text: string) => /^[A-Z¿]/.test(text) && / /.test(text) && /[.?!]$/.test(text);

// Every message in the code, as its key: the quotes off, each ${...} written as {}.
function messagesInCode(): Map<string, string> {
  const found = new Map<string, string>();
  const add = (quoted: string, file: string) => {
    const key = quoted
      .slice(1, -1)
      .replace(/\$\{[^}]*\}/g, "{}")
      .replace(/\\'/g, "'");
    if (/[A-Za-z]{2}/.test(key) && !found.has(key)) found.set(key, relative(repo, file));
  };
  const backend = codeFilesUnder(
    join(repo, "backend"),
    (path) => !/[\\/](emails|scripts)[\\/]/.test(path) && !/login-code-words/.test(path)
  );
  for (const file of backend) {
    const code = readFileSync(file, "utf8");
    for (const rule of [refusalRule, messageRule])
      for (const m of code.matchAll(rule)) add(m[1], file);
    for (const m of code.matchAll(fallbackRule)) if (isSentence(m[1].slice(1, -1))) add(m[1], file);
    for (const m of code.matchAll(choiceRule)) [m[1], m[2]].forEach((one) => add(one, file));
    for (const m of code.matchAll(piecesRule)) {
      if (isSentence(joined(m[1]))) add(`"${joined(m[1])}"`, file); // a sentence, not a reason code
    }
  }
  for (const file of codeFilesUnder(
    join(repo, "packages", "shared", "zod-validation"),
    () => true
  )) {
    for (const m of readFileSync(file, "utf8").matchAll(anyLiteral)) {
      if (isSentence(m[1].slice(1, -1))) add(m[1], file);
    }
  }
  const client = codeFilesUnder(
    join(repo, "frontend", "lib", "api-client"),
    (path) => !/[\\/](admin|customer-booking)[\\/]/.test(path) && !/public-api-client/.test(path)
  );
  for (const file of client) {
    const code = readFileSync(file, "utf8");
    for (const rule of [messageRule, fallbackRule])
      for (const m of code.matchAll(rule)) add(m[1], file);
    for (const m of code.matchAll(anyLiteral)) if (isSentence(m[1].slice(1, -1))) add(m[1], file);
  }
  return found;
}

describe("the Spanish for the dashboard's messages", () => {
  test("every message in the code has its Spanish", () => {
    const found = messagesInCode();
    expect(found.size).toBeGreaterThan(150); // the reading itself still finds the code
    const missing = [...found].filter(([key]) => spanishMessages[key] === undefined);
    expect(missing.map(([key, file]) => `${file}: ${key}`)).toEqual([]);
  });

  test("a message is found word for word", () => {
    expect(spanishMessageOf("Enter a name.")).toBe("Escriba un nombre.");
    expect(messageInLanguage("A window has to end after it starts.", "es")).toBe(
      "Una franja tiene que terminar después de empezar."
    );
  });

  test("a message with a value keeps the value and translates the code's own words", () => {
    expect(spanishMessageOf("Use an address at agentsweb.com, the business's own.")).toBe(
      "Use una dirección en agentsweb.com, la del propio negocio."
    );
    expect(spanishMessageOf("The API answered with an unexpected status (502).")).toBe(
      "La API respondió con un estado inesperado (502)."
    );
    expect(spanishMessageOf("Tick at most 500 people.")).toBe("Marque como máximo 500 personas.");
    // A text's time inside the message reads in Spanish too.
    expect(
      spanishMessageOf(
        "Already off from Mon Oct 26, 9:00am to Mon Oct 26, 5:00pm. Remove that time off first, or pick a time around it."
      )
    ).toBe(
      "Ya hay un horario no disponible de lun 26 oct, 9:00 a. m. a lun 26 oct, 5:00 p. m.: quite primero ese horario, o elija una hora fuera de él."
    );
    expect(spanishMessageOf("Christmas Day is not in the holiday list: untick it.")).toBe(
      "Christmas Day no está en la lista de festivos: desmárquelo."
    );
  });

  test("English stays as it came, and a message with no Spanish shows in English, never blank", () => {
    expect(messageInLanguage("Enter a name.", "en")).toBe("Enter a name.");
    expect(spanishMessageOf("A message nobody wrote yet.")).toBeUndefined();
    expect(messageInLanguage("A message nobody wrote yet.", "es")).toBe(
      "A message nobody wrote yet."
    );
  });

  test("Spanish passes through unchanged when it is already Spanish", () => {
    expect(messageInLanguage("Escriba un nombre.", "es")).toBe("Escriba un nombre.");
  });
});
