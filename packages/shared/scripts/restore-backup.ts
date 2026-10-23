// Shared script: restores a backup copy from R2 into a scratch database on this laptop, then
// prints every table's rows. Never the working database, never a remote one.
// The key is BACKUP_PASSPHRASE from the root .env; without it, gpg asks for it.
// Run: npm run backup:restore --workspace=@scheduleads-app/shared -- <copy.dump.gpg> --into <name>

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import postgres from "postgres";

import { restoreTargetUrl } from "@scheduleads-app/shared/backups";
import { databaseLabel } from "@scheduleads-app/shared/database-label";

// Where the tools live when they are not on PATH: PostgreSQL's and Git's own installs on Windows.
const WINDOWS_PG_BIN = "C:\\Program Files\\PostgreSQL\\18\\bin";
const WINDOWS_GPG = "C:\\Program Files\\Git\\usr\\bin\\gpg.exe";

const args = process.argv.slice(2);
const intoAt = args.indexOf("--into");
const into = intoAt >= 0 ? args[intoAt + 1] : undefined;
const copy = args.find((arg, at) => !arg.startsWith("--") && at !== intoAt + 1);
if (!copy || !into) {
  console.error(
    "Name the copy and the target: npm run backup:restore -- <copy.dump.gpg> --into scheduleads_restore_dev"
  );
  process.exit(1);
}
const copyPath = resolve(copy);
if (!existsSync(copyPath)) {
  console.error(`No such file: ${copyPath}`);
  process.exit(1);
}

// First, before anything is touched: which database this is about to replace.
let targetUrl: string;
try {
  targetUrl = restoreTargetUrl(process.env.DATABASE_URL, into);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
console.log(`Restoring into: ${databaseLabel(targetUrl)} (made fresh)`);

const pgBin =
  process.env.PG_BIN ??
  (process.platform === "win32" && existsSync(WINDOWS_PG_BIN) ? WINDOWS_PG_BIN : "");
const pgRestore = pgBin ? join(pgBin, "pg_restore") : "pg_restore";
const gpg =
  process.env.GPG ??
  (process.platform === "win32" && existsSync(WINDOWS_GPG) ? WINDOWS_GPG : "gpg");

// Both tools must run before anything is opened or dropped, so a missing one is named.
for (const [tool, path, hint] of [
  ["gpg", gpg, "GPG"],
  ["pg_restore", pgRestore, "PG_BIN"],
]) {
  if (spawnSync(path, ["--version"], { stdio: "ignore" }).error) {
    console.error(`${tool} was not found at ${path}. Install it, or set ${hint} in the root .env.`);
    process.exit(1);
  }
}

// An opened copy left by a run stopped with Ctrl+C holds every client's data: remove it first.
for (const leftover of readdirSync(tmpdir()).filter((name) =>
  name.startsWith("scheduleads-restore-")
)) {
  rmSync(join(tmpdir(), leftover), { recursive: true, force: true });
}

const work = mkdtempSync(join(tmpdir(), "scheduleads-restore-"));
const plain = join(work, "copy.dump");
try {
  // 1. Open the copy. The key goes in on stdin, never on the command line.
  const passphrase = process.env.BACKUP_PASSPHRASE;
  const opened = passphrase
    ? spawnSync(
        gpg,
        [
          "--batch",
          "--yes",
          "--pinentry-mode",
          "loopback",
          "--passphrase-fd",
          "0",
          "--output",
          plain,
          "--decrypt",
          copyPath,
        ],
        {
          input: passphrase,
          stdio: ["pipe", "ignore", "inherit"],
        }
      )
    : spawnSync(gpg, ["--output", plain, "--decrypt", copyPath], { stdio: "inherit" });
  if (opened.status !== 0) {
    console.error("The copy did not open: wrong key, or not a backup copy.");
    process.exitCode = 1;
  } else {
    // 2. A fresh target: dropped and made again on the same local server.
    const server = new URL(targetUrl);
    server.pathname = "/postgres";
    const admin = postgres(server.toString(), { max: 1, onnotice: () => {} });
    try {
      await admin.unsafe(`drop database if exists "${into}" with (force)`);
      await admin.unsafe(`create database "${into}"`);
    } finally {
      await admin.end();
    }

    // 3. Restore. Owners and grants are the live server's, so they are left out. The address goes
    // in as separate flags, the password through PGPASSWORD, and no other PG* setting from this
    // shell reaches pg_restore, so nothing can point it at another database.
    const target = new URL(targetUrl);
    const env: NodeJS.ProcessEnv = Object.fromEntries(
      Object.entries(process.env).filter(([name]) => !name.startsWith("PG"))
    );
    env.PGPASSWORD = decodeURIComponent(target.password);
    const restored = spawnSync(
      pgRestore,
      [
        "--no-owner",
        "--no-privileges",
        "--host",
        target.hostname.replace(/^\[|\]$/g, ""), // [::1] in a URL is ::1 to pg_restore
        "--port",
        target.port || "5432",
        "--username",
        decodeURIComponent(target.username),
        "--dbname",
        into,
        plain,
      ],
      { stdio: "inherit", env }
    );
    if (restored.status !== 0) {
      console.error(
        `pg_restore ended with errors (exit ${restored.status ?? "none"}); the counts below show what arrived.`
      );
      process.exitCode = 1;
    }

    // 4. Every table's rows, to compare with the live database.
    const db = postgres(targetUrl, { max: 1, onnotice: () => {} });
    try {
      const tables = await db<{ schema: string; name: string }[]>`
        select table_schema as schema, table_name as name from information_schema.tables
        where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog', 'information_schema')
        order by 1, 2`;
      for (const { schema, name } of tables) {
        const quoted = `"${schema.replaceAll('"', '""')}"."${name.replaceAll('"', '""')}"`;
        const [{ rows }] = await db.unsafe<{ rows: number }[]>(
          `select count(*)::int as rows from ${quoted}`
        );
        console.log(`${schema}.${name}: ${rows}`);
      }
      console.log(`${tables.length} tables.`);
    } finally {
      await db.end();
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true }); // the opened copy never stays on disk
}
