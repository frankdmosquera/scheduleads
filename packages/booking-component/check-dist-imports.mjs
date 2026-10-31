// The build's last check, on the built package as a site in another repo installs it. dist/ may
// import only what the site installs itself (react, react-dom) or with the package (hono, zod).
// This repo's shared code, the backend's types or a database type dragged in by them would break
// an install outside this repo, so the build fails instead of shipping it.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

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
    // A chunk shared by the two entries ships inside dist/, so it installs wherever they do.
    // A declaration file names a shared chunk by its .js name; its types ship as that chunk's .d.ts.
    const sibling = join(distFolder, dirname(file), specifier);
    const shipped =
      specifier.startsWith("./") &&
      (existsSync(sibling) ||
        (/.d.[cm]?ts$/.test(file) && existsSync(sibling.replace(/.([cm]?)js$/, ".d.$1ts"))));
    if (!shipped && !allowed.includes(specifier.split("/")[0])) {
      problems.push(`${file} imports ${specifier}`);
    }
  }
}
// Every export is a client component: without this a Next site's server components cannot render it.
if (!readFileSync(join(distFolder, "index.js"), "utf8").startsWith('"use client";')) {
  problems.push('index.js does not start with "use client"');
}
// The site-colours and page-calendar entries are for a site's server code: marked client, a server
// component could not call them.
for (const serverEntry of ["site-colours.js", "page-calendar.js"]) {
  if (readFileSync(join(distFolder, serverEntry), "utf8").includes('"use client"')) {
    problems.push(`${serverEntry} is marked "use client"`);
  }
}

if (problems.length) {
  console.error(
    `The built package would not install outside this repo:\n  ${problems.join("\n  ")}`
  );
  process.exit(1);
}
console.log(`dist/ imports only ${allowed.join(", ")} (${files.length} files checked)`);
