// Backend tests: each file starts from vitest.setup.ts, which gives its worker a jobs schema of its
// own and pins the jobs' clock (8a.2).

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
  },
});
