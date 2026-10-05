// Backend tests: each file starts from vitest.setup.ts, which gives its worker a jobs schema of its
// own and pins the jobs' clock. Tests that book, move and work jobs against the real database
// take a few seconds each on a busy machine, past Vitest's 5 second default.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
