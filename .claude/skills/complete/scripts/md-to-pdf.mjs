#!/usr/bin/env node

// Renders any Blueprint markdown file (planning docs, context files, archived
// history, not just the walkthrough-record step in ai-interaction.md /
// SKILL.md) to a matching PDF. No markdown-to-PDF dependency is assumed to be
// installed, so this does its own minimal markdown -> HTML conversion
// (headings, bold, italic, inline/fenced code, links, blockquotes,
// flat/nested bullet and checkbox lists - the subset this project's docs
// actually use) and prints via a local headless Chrome/Edge, since neither is
// an npm dependency worth adding for one occasional step. Styled with IBM
// Plex Sans/Mono and a teal accent (falls back to system fonts if the Google
// Fonts request has no network access at print time).
//
// Usage: node md-to-pdf.mjs <input.md> <output.pdf> [title]
// Set CHROME_PATH to override the auto-detected browser binary.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const [, , inputPath, outputPath, title] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Usage: node md-to-pdf.mjs <input.md> <output.pdf> [title]");
  process.exit(1);
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(text) {
  let t = escapeHtml(text);
  // Double-backtick spans (``code with a literal ` inside``) must resolve
  // before single-backtick spans, or the single-backtick pass pairs each
  // outer backtick with the next unrelated one it finds anywhere in the line.
  t = t.replace(/``\s?(.+?)\s?``/g, "<code>$1</code>");
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Runs after **bold** so a bold span's own asterisks are already gone and
  // can't be mistaken for an italic delimiter.
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return t;
}

function mdToHtml(md) {
  const lines = md.split("\n");
  let html = "";
  let inCode = false;
  let inQuote = false;
  const listStack = []; // [{ indent }]
  // A paragraph or list item can wrap across several source lines (this
  // file is hand-wrapped prose, not one-logical-line-per-line markdown).
  // pending holds the in-progress logical line until a blank line, a new
  // block, or EOF closes it, so inline() sees the whole joined text and
  // bold/code spans that wrapped mid-span still match correctly.
  let pending = null; // { type: 'p' | 'li', text, checked? }

  function flushPending() {
    if (!pending) return;
    if (pending.type === "li") {
      const box =
        pending.checked === undefined
          ? ""
          : `<input type="checkbox" disabled ${pending.checked ? "checked" : ""}/> `;
      html += `<li>${box}${inline(pending.text)}</li>\n`;
    } else {
      html += `<p>${inline(pending.text)}</p>\n`;
    }
    pending = null;
  }

  function closeLists(toIndent = -1) {
    while (
      listStack.length &&
      (toIndent < 0 || listStack[listStack.length - 1].indent > toIndent)
    ) {
      listStack.pop();
      html += "</ul>\n";
    }
  }

  for (const raw of lines) {
    if (raw.startsWith("```")) {
      flushPending();
      if (!inCode) {
        closeLists();
        html += "<pre><code>";
      } else {
        html += "</code></pre>\n";
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      html += escapeHtml(raw) + "\n";
      continue;
    }

    if (raw.trim() === "") {
      flushPending();
      closeLists();
      if (inQuote) {
        html += "</blockquote>\n";
        inQuote = false;
      }
      continue;
    }

    const heading = raw.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPending();
      closeLists();
      const level = heading[1].length;
      html += `<h${level}>${inline(heading[2])}</h${level}>\n`;
      continue;
    }

    const quote = raw.match(/^>\s?(.*)$/);
    if (quote) {
      flushPending();
      closeLists();
      if (!inQuote) {
        html += "<blockquote>\n";
        inQuote = true;
      }
      html += `<p>${inline(quote[1])}</p>\n`;
      continue;
    }
    if (inQuote) {
      flushPending();
      html += "</blockquote>\n";
      inQuote = false;
    }

    const listItem = raw.match(/^(\s*)-\s+(?:\[([ xX])\]\s+)?(.*)$/);
    if (listItem) {
      flushPending();
      const indent = listItem[1].length;
      closeLists(indent);
      if (!listStack.length || listStack[listStack.length - 1].indent < indent) {
        html += "<ul>\n";
        listStack.push({ indent });
      }
      pending = {
        type: "li",
        checked: listItem[2] === undefined ? undefined : !!listItem[2].trim(),
        text: listItem[3],
      };
      continue;
    }

    // A lazy-continuation line: keep joining it onto the open paragraph or
    // list item rather than starting a new block, matching how the source
    // was hand-wrapped.
    if (pending) {
      pending.text += " " + raw.trim();
    } else {
      closeLists();
      pending = { type: "p", text: raw.trim() };
    }
  }
  flushPending();
  closeLists();
  if (inQuote) html += "</blockquote>\n";
  if (inCode) html += "</code></pre>\n";
  return html;
}

const md = fs.readFileSync(inputPath, "utf8");
const body = mdToHtml(md);

const page = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title || path.basename(inputPath))}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  @page { margin: 20mm 18mm; }
  body { font-family: "IBM Plex Sans", -apple-system, "Segoe UI", Arial, sans-serif; font-size: 10.5pt; line-height: 1.55; color: #1a1a1a; }
  h1 { font-size: 19pt; font-weight: 600; color: #0f172a; border-bottom: 3px solid #0d9488; padding-bottom: 7px; margin-top: 0; }
  h2 { font-size: 14pt; font-weight: 600; color: #0f172a; margin-top: 24px; border-bottom: 1px solid #99f6e4; padding-bottom: 4px; }
  h3 { font-size: 12pt; font-weight: 600; color: #0f172a; margin-top: 16px; }
  p { margin: 6px 0; }
  em { font-style: italic; }
  code { font-family: "IBM Plex Mono", Consolas, "SF Mono", monospace; background: #f0fdfa; color: #0f766e; padding: 1px 4px; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f8fafa; padding: 10px 12px; border-radius: 5px; overflow-x: auto; border: 1px solid #ccfbf1; }
  pre code { background: none; padding: 0; color: #1a1a1a; }
  ul { margin: 4px 0; padding-left: 22px; }
  li { margin: 3px 0; }
  blockquote { border-left: 3px solid #2dd4bf; margin: 8px 0; padding: 2px 14px; color: #555; }
  a { color: #0d9488; }
  strong { font-weight: 600; color: #0f172a; }
</style>
</head><body>${body}</body></html>`;

const tmpHtml = path.join(os.tmpdir(), `blueprint-walkthrough-${Date.now()}.html`);
fs.writeFileSync(tmpHtml, page, "utf8");

const candidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/microsoft-edge",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
].filter(Boolean);
const browser = candidates.find((p) => fs.existsSync(p));
if (!browser) {
  console.error(
    "No headless-capable Chrome/Edge binary found. Set CHROME_PATH or install one.",
  );
  process.exit(1);
}

const absOut = path.resolve(outputPath);
try {
  execFileSync(browser, [
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    `--print-to-pdf=${absOut}`,
    `file:///${tmpHtml.replace(/\\/g, "/")}`,
  ]);
} finally {
  fs.rmSync(tmpHtml, { force: true });
}

console.log(`Wrote ${absOut}`);
