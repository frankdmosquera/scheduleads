// Puts this version of the booking window into a client site, which installs it from its own repo:
// no registry, no token (feature 25c). From the repo root:
//
//   npm run pack:site --workspace=@frankdmosquera/booking-component -- ../face-and-body
//
// npm pack builds the package first (prepack), the file lands in the site's vendor/, older ones
// there are removed, and npm install writes "file:vendor/<file>" into the site's package.json and
// lockfile. It never commits or pushes: the site's commit is the site's own.
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { decidePackIntoSite } from "./decide-pack-into-site.ts";

const siteArgument = process.argv[2];
if (!siteArgument) {
  console.error(
    "Name the site's folder: npm run pack:site --workspace=@frankdmosquera/booking-component -- ../face-and-body"
  );
  process.exit(1);
}
const siteFolder = resolve(process.env.INIT_CWD ?? process.cwd(), siteArgument); // from where it was typed
const readIfThere = (path) => (existsSync(path) ? readFileSync(path) : null);

const { version } = JSON.parse(readFileSync(join(import.meta.dirname, "package.json"), "utf8"));
const packedName = `frankdmosquera-booking-component-${version}.tgz`;
const packFolder = mkdtempSync(join(tmpdir(), "booking-window-"));
execSync(`npm pack --pack-destination "${packFolder}"`, {
  cwd: import.meta.dirname,
  stdio: "inherit",
});
const packedBytes = readFileSync(join(packFolder, packedName));
rmSync(packFolder, { recursive: true });

const vendorFolder = join(siteFolder, "vendor");
const decision = decidePackIntoSite({
  sitePackageJson: readIfThere(join(siteFolder, "package.json"))?.toString("utf8") ?? null,
  packedName,
  packedBytes,
  vendorFiles: existsSync(vendorFolder)
    ? readdirSync(vendorFolder).map((name) => ({
        name,
        bytes: readFileSync(join(vendorFolder, name)),
      }))
    : [],
});
if (decision.kind === "refuse") {
  console.error(`Not installed in ${siteFolder}: ${decision.reason}`);
  process.exit(1);
}

mkdirSync(vendorFolder, { recursive: true });
if (decision.copy) writeFileSync(join(vendorFolder, packedName), packedBytes);
for (const name of decision.remove) rmSync(join(vendorFolder, name));
execSync(`npm install "./vendor/${packedName}"`, { cwd: siteFolder, stdio: "inherit" });

console.log(
  `\nBooking window ${version} is in ${siteFolder}\\vendor (${decision.copy ? "copied" : "already there"}` +
    `${decision.remove.length ? `, removed ${decision.remove.join(", ")}` : ""}).` +
    "\nCommit vendor/, package.json and package-lock.json in the site's own repo."
);
