// Builds a step's "What changed in the code" drawer for the build log, from the real
// files and git diff, so line numbers match the files. Run from the repo root:
//   node blueprint/scripts/code-drawer.mjs . <diffBase> <githubLink> <path:new|changed>... > drawer.html
// Paste the output into the step's row in project-log.html; the page already carries
// the viewer (Shiki in Dark 2026 colours, line numbers, green and red bars).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const [repo, base, link, ...specs] = process.argv.slice(2);
const escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const langOf = (path) => (path.endsWith(".sql") ? "sql" : "typescript");

function block({ label, lang, start, mark, kind, lines }) {
  const head = label ? `<div class="code-label">${label}</div>` : "";
  return `${head}<pre class="code" data-lang="${lang}" data-start="${start}" data-mark="${mark}" data-kind="${kind}"><code>${escapeHtml(lines.join("\n"))}</code></pre>`;
}

const ranges = (numbers) => numbers.join(",");
let totalAdded = 0;
let totalRemoved = 0;

const files = specs.map((spec) => {
  const [path, status] = spec.split(":");
  const lang = langOf(path);
  if (status === "new") {
    const lines = readFileSync(join(repo, path), "utf8").replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
    totalAdded += lines.length;
    return { path, tag: `new &middot; ${lines.length} lines`, body: block({ lang, start: 1, mark: "all", kind: "added", lines }) };
  }
  const diff = execFileSync("git", ["-C", repo, "diff", "-U3", base, "--", path], { encoding: "utf8" }).replace(/\r\n/g, "\n");
  const parts = [];
  let added = 0;
  let removed = 0;
  for (const hunk of diff.split(/^(?=@@ )/m).slice(1)) {
    const [header, ...rest] = hunk.replace(/\n$/, "").split("\n");
    const [, oldStart, newStart] = header.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)/);
    const before = [], after = [], oldMarks = [], newMarks = [];
    let oldLine = +oldStart, newLine = +newStart;
    for (const line of rest) {
      const sign = line[0], text = line.slice(1);
      if (sign === "-") { before.push(text); oldMarks.push(oldLine++); removed++; }
      else if (sign === "+") { after.push(text); newMarks.push(newLine++); added++; }
      else if (sign === " ") { before.push(text); after.push(text); oldLine++; newLine++; }
    }
    if (oldMarks.length) parts.push(block({ label: `Before &middot; line ${oldStart}`, lang, start: oldStart, mark: ranges(oldMarks), kind: "removed", lines: before }));
    parts.push(block({ label: oldMarks.length ? `After &middot; line ${newStart}` : `Added &middot; line ${newStart}`, lang, start: newStart, mark: ranges(newMarks), kind: "added", lines: after }));
  }
  totalAdded += added;
  totalRemoved += removed;
  return { path, tag: `changed &middot; +${added} &minus;${removed}`, body: parts.join("\n") };
});

const fileDrawers = files
  .map((file) => `<details class="codefile"><summary><code>${file.path}</code> <span class="tag-drift">${file.tag}</span></summary><div class="codefile-body">\n${file.body}\n</div></details>`)
  .join("\n");

process.stdout.write(`<details class="drawer" data-kind="code">
  <summary>What changed in the code <span class="tag-drift">${files.length} files &middot; +${totalAdded} &minus;${totalRemoved} lines</span></summary>
  <div class="drawer-body">
    <p class="drawer-what">The real code of this step, file by file, coloured like VS Code's Dark 2026. A green bar marks a new line, a red bar a removed one; a changed file shows the old block above the new. Only this project's own code: generated files and packages are left out.</p>
${fileDrawers}
    <p class="rstep-what"><a href="${link}">The full diff on GitHub</a></p>
  </div>
</details>
`);
