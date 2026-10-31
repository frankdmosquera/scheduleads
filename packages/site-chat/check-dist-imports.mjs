// The build's last check, on the built package as a site in another repo installs it. dist/ may import only
// what the site installs itself (react, react-dom, ai, @ai-sdk/openai) or with the package (zod). The chat a
// visitor downloads may not reach ai or the provider at all: they belong to the server entry alone.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const distFolder = join(import.meta.dirname, "dist");
const allowed = ["react", "react-dom", "zod", "ai", "@ai-sdk/openai"];
const serverOnly = ["ai", "@ai-sdk/openai"];

const importsIn = (code) =>
  [
    ...code.matchAll(/\bfrom\s*["']([^"']+)["']/g),
    ...code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
    ...code.matchAll(/\bimport\s*["']([^"']+)["']/g),
    ...code.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g),
    ...code.matchAll(/\/\/\/\s*<reference\s+(?:types|path)\s*=\s*["']([^"']+)["']/g),
  ].map((match) => match[1]);

// A scoped package's name is its first two parts ("@ai-sdk/openai"), anything else its first.
const packageOf = (specifier) =>
  specifier
    .split("/")
    .slice(0, specifier.startsWith("@") ? 2 : 1)
    .join("/");

const problems = [];
// Every built file at any depth: a chunk in a subfolder or an .mjs ships just the same.
const files = readdirSync(distFolder, { recursive: true })
  .map(String)
  .filter((file) => /\.[cm]?js$|\.d\.[cm]?ts$/.test(file));
if (files.length === 0) problems.push("dist/ holds no built files");
for (const file of files) {
  const code = readFileSync(join(distFolder, file), "utf8");
  for (const specifier of importsIn(code)) {
    // A chunk shared by the entries ships inside dist/, so it installs wherever they do. A type file names its
    // shared types by the .js they describe, and finds them in the .d.ts beside it.
    const path = join(distFolder, dirname(file), specifier);
    const shipped =
      specifier.startsWith("./") &&
      (existsSync(path) || existsSync(path.replace(/\.js$/, ".d.ts")));
    if (!shipped && !allowed.includes(packageOf(specifier)))
      problems.push(`${file} imports ${specifier}`);
  }
}

// Everything the client entry reaches, through its chunks and lazy chunks, never imports ai or the provider.
const reached = new Set();
const visit = (file) => {
  if (reached.has(file)) return;
  reached.add(file);
  for (const specifier of importsIn(readFileSync(join(distFolder, file), "utf8"))) {
    if (specifier.startsWith("./")) visit(normalize(join(dirname(file), specifier)));
    else if (serverOnly.includes(packageOf(specifier)))
      problems.push(`the chat reaches ${specifier} through ${file}`);
  }
};
visit("index.js");

// Every export of the client entry is a client component: without this a Next site's server components cannot render it.
if (!readFileSync(join(distFolder, "index.js"), "utf8").startsWith('"use client";')) {
  problems.push('index.js does not start with "use client"');
}
// The server and words entries are read by a site's server code: marked client, they would be only references there.
for (const entry of ["server.js", "words.js"]) {
  if (readFileSync(join(distFolder, entry), "utf8").includes('"use client"'))
    problems.push(`${entry} is marked "use client"`);
}

if (problems.length) {
  console.error(
    `The built package would not install outside this repo:\n  ${problems.join("\n  ")}`
  );
  process.exit(1);
}
console.log(
  `dist/ imports only ${allowed.join(", ")} (${files.length} files checked); the chat reaches ${reached.size} files, none with ${serverOnly.join(" or ")}`
);
