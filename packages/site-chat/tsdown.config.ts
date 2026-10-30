// The package's build: one dist/ a site in another repo can install with nothing from this repo. Only react,
// react-dom, zod, ai and @ai-sdk/openai are left for the site to install, and ai only from the server entry
// (check-dist-imports.mjs, the build's last step, holds both rules).
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["index.ts", "server.ts", "words.ts"],
  format: "esm",
  platform: "neutral",
  target: "es2022",
  dts: true,
  outDir: "dist",
  clean: true,
  // Every export of index is a client component: a Next host's server components can render them. The bundle
  // drops each file's own "use client", so it is put back once, at its top. The server and words entries never get it.
  outputOptions: {
    banner: (chunk) => (chunk.isEntry && chunk.name === "index" ? '"use client";' : ""),
  },
  inputOptions: {
    onLog(level, log, defaultHandler) {
      if (log.code === "MODULE_LEVEL_DIRECTIVE") return; // the banner above stands in for them
      defaultHandler(level, log);
    },
  },
});
