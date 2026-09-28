// Builds the code drawer's colour theme from VS Code's own Dark 2026, as Frank's editor
// resolves it, and prints it as one JSON line. Run from the repo root:
//   node blueprint/scripts/code-theme.mjs "<VS Code>/resources/app/extensions/theme-defaults/themes"
// Paste the output into the <script id="code-theme"> block of project-log.html. Rerun it
// when VS Code changes the theme; the page's viewer (Shiki) needs nothing else.
import { readFileSync } from "node:fs";

const [themesDir] = process.argv.slice(2);

// Dark 2026 includes Dark Modern, which includes Dark+, which includes Dark (Visual Studio).
// Oldest first, so on a tie the later file wins, as in VS Code. A more specific scope still
// wins over a later one: that is why import is purple (Dark+'s keyword.control beats
// Dark 2026's keyword) and type names are green.
const chain = ["dark_vs", "dark_plus", "dark_modern", "2026-dark"].map((name) =>
  JSON.parse(readFileSync(`${themesDir}/${name}.json`, "utf8"))
);
const colors = Object.assign({}, ...chain.map((theme) => theme.colors ?? {}));
const tokenColors = chain.flatMap((theme) => theme.tokenColors ?? []).filter((rule) => rule.scope);

// VS Code also colours TypeScript by meaning (semantic highlighting), which Shiki cannot see.
// A field in a type ({ weeklyHours: ... }) is a property there and shows as variable.other;
// by grammar alone it is variable.object.property and would come out orange.
tokenColors.push({ scope: "variable.object.property", settings: { foreground: "#c9d1d9" } });

const foreground = colors["editor.foreground"];
const background = colors["editor.background"];

console.log(
  JSON.stringify({
    name: "dark-2026",
    type: "dark",
    fg: foreground,
    bg: background,
    colors: { "editor.foreground": foreground, "editor.background": background },
    tokenColors,
  })
);
