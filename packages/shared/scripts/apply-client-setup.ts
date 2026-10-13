// Shared script: sets a business up from its setup file (feature 10), until Settings (feature 12).
// The business must already exist, made on /admin/client-setup. Prints what it would add and
// every difference from the file; writes only with --apply, and only what is missing.
// The local *_dev database only, unless --live; even then a dry run unless --apply.
// Run: npm run client:setup --workspace=@scheduleads-app/shared -- client-setups/<file>.ts [--live] [--apply]

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { runClientSetup, setupDatabase } from "@scheduleads-app/shared/client-setup";
import * as schema from "@scheduleads-app/shared/db";
import { clientSetupValidationSchema } from "@scheduleads-app/shared/zod-validation";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const live = args.includes("--live");
const file = args.find((arg) => !arg.startsWith("--"));
if (!file) {
  console.error(
    "Name the setup file: npm run client:setup -- client-setups/<file>.ts [--live] [--apply]"
  );
  process.exit(1);
}

// First, before anything is read: which database this is about to use.
const database = setupDatabase(process.env.DATABASE_URL, { live });
console.log(`Database: ${database}`);

const loaded: { default?: unknown } = await import(pathToFileURL(resolve(file)).href);
const parsed = clientSetupValidationSchema.safeParse(loaded.default);
if (!parsed.success) {
  console.error(`${file} is not a valid setup file:`);
  for (const issue of parsed.error.issues)
    console.error(`  ${issue.path.join(".") || "(file)"}: ${issue.message}`);
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
try {
  const result = await runClientSetup(drizzle(client, { schema }), parsed.data, { apply });
  if (!result.ok) {
    console.error(result.reason);
    process.exitCode = 1;
  } else {
    console.log(result.business);
    console.log(result.made.length ? `  to add: ${result.made.join(", ")}` : "  nothing to add");
    for (const difference of result.differences) console.log(`  differs, kept: ${difference}`);
    console.log(result.applied ? "Applied." : "Dry run, nothing written. Add --apply to write it.");
  }
} finally {
  await client.end();
}
