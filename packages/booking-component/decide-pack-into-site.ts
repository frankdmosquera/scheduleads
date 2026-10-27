// What pack:site does with a freshly packed booking window in a site's vendor/ folder, decided
// apart from npm and the disk so it is tested without either (pack-into-site.mjs does the work).

const packageName = "@frankdmosquera/booking-component";
const packedFilePattern = /^frankdmosquera-booking-component-.+\.tgz$/;

export type PackIntoSiteDecisionType =
  { kind: "refuse"; reason: string } | { kind: "install"; copy: boolean; remove: string[] };

export function decidePackIntoSite(input: {
  sitePackageJson: string | null; // the site's package.json as text, null when it has none
  packedName: string;
  packedBytes: Uint8Array;
  vendorFiles: { name: string; bytes: Uint8Array }[]; // what the site's vendor/ holds today
}): PackIntoSiteDecisionType {
  const notASite = refuseNotASite(input.sitePackageJson);
  if (notASite) return { kind: "refuse", reason: notASite };

  const packedFiles = input.vendorFiles.filter((file) => packedFilePattern.test(file.name));
  const sameName = packedFiles.find((file) => file.name === input.packedName);
  // One version is one build: a version number must always say which window a site has.
  if (sameName && !sameBytes(sameName.bytes, input.packedBytes)) {
    return {
      kind: "refuse",
      reason: `vendor/${input.packedName} is a different build of this version: bump the version in package.json first`,
    };
  }

  return {
    kind: "install",
    copy: !sameName,
    remove: packedFiles.filter((file) => file.name !== input.packedName).map((file) => file.name),
  };
}

// Asked again before packing, so a wrong folder is refused before the build runs.
export function refuseNotASite(sitePackageJson: string | null): string | null {
  if (usesBookingWindow(sitePackageJson)) return null;
  return `this folder's package.json does not list ${packageName}, so it is not a site that uses the booking window`;
}

function usesBookingWindow(packageJson: string | null): boolean {
  if (packageJson === null) return false;
  try {
    const parsed = JSON.parse(packageJson) as Record<string, Record<string, string> | undefined>;
    return Boolean(parsed.dependencies?.[packageName] ?? parsed.devDependencies?.[packageName]);
  } catch {
    return false;
  }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}
