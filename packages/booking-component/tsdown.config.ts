// The package's build: one dist/ a site in another repo can install with nothing from this repo.
// The shared helpers and the booking schema are build-time devDependencies, so they are carried
// inside dist/; only react, react-dom, hono and zod are left for the site to install
// (check-dist-imports.mjs, the build's last step, holds that list).
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["index.ts"],
  format: "esm",
  platform: "browser",
  target: "es2022",
  dts: true,
  outDir: "dist",
  clean: true,
  // Every export is a client component: a Next host's server components can render them. The
  // bundle drops each file's own "use client", so it is put back once, at the top.
  outputOptions: { banner: '"use client";' },
  inputOptions: {
    // The shared package's files only define things, so a schema reached through its one
    // zod-validation index but never used (sign-in, client setup) is left out of every site.
    treeshake: { moduleSideEffects: (id) => !/[\\/]shared[\\/]dist[\\/]/.test(id) },
    onLog(level, log, defaultHandler) {
      if (log.code === "MODULE_LEVEL_DIRECTIVE") return; // the banner above stands in for them
      defaultHandler(level, log);
    },
  },
});
