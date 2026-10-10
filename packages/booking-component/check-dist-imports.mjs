// The build's last check, on the built package as a site in another repo installs it. dist/ may
// import only what the site installs itself (react, react-dom) or with the package (hono, zod).
// This repo's shared code, the backend's types or a database type dragged in by them would break
// an install outside this repo, so the build fails instead of shipping it.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const distFolder = join(import.meta.dirname, "dist");
const allowed = ["react", "react-dom", "hono", "zod"];

const importsIn = (code) =>
  [
    ...code.matchAll(/\bfrom\s*["']([^"']+)["']/g),
    ...code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
    ...code.matchAll(/\bimport\s*["']([^"']+)["']/g),
    ...code.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g),
    ...code.matchAll(/\/\/\/\s*<reference\s+(?:types|path)\s*=\s*["']([^"']+)["']/g),
  ].map((match) => match[1]);

const problems = [];
// Every built file at any depth: a chunk in a subfolder or an .mjs ships just the same.
const files = readdirSync(distFolder, { recursive: true })
  .map(String)
  .filter((file) => /\.[cm]?js$|\.d\.[cm]?ts$/.test(file));
if (files.length === 0) problems.push("dist/ holds no built files");
for (const file of files) {
  const code = readFileSync(join(distFolder, file), "utf8");
  for (const specifier of importsIn(code)) {
    if (!allowed.includes(specifier.split("/")[0])) problems.push(`${file} imports ${specifier}`);
  }
}
// Every export is a client component: without this a Next site's server components cannot render it.
if (!readFileSync(join(distFolder, "index.js"), "utf8").startsWith('"use client";')) {
  problems.push('index.js does not start with "use client"');
}

if (problems.length) {
  console.error(
    `The built package would not install outside this repo:\n  ${problems.join("\n  ")}`
  );
  process.exit(1);
}
console.log(`dist/ imports only ${allowed.join(", ")} (${files.length} files checked)`);
