// What pack:site does with a freshly packed site chat in a site's vendor/ folder, decided apart from npm and the
// disk so it is tested without either (pack-into-site.mjs does the work).

const packageName = "@frankdmosquera/site-chat";
const packedFilePattern = /^frankdmosquera-site-chat-.+\.tgz$/;
// What the chat's server entry needs the site to install itself: a site with both is ready for its first copy.
const serverPeers = ["ai", "@ai-sdk/openai"];

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
  // One version is one build: a version number must always say which chat a site has.
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

// Asked again before packing, so a wrong folder is refused before the build runs. A site uses the chat when it
// lists the package, or, for its first copy, when it already lists what the chat's server needs.
export function refuseNotASite(sitePackageJson: string | null): string | null {
  const listed = dependenciesOf(sitePackageJson);
  if (listed.has(packageName) || serverPeers.every((name) => listed.has(name))) return null;
  return `this folder's package.json lists neither ${packageName} nor ${serverPeers.join(" and ")}, so it is not a site that uses the chat`;
}

function dependenciesOf(packageJson: string | null): Set<string> {
  if (packageJson === null) return new Set();
  try {
    const parsed = JSON.parse(packageJson) as Record<string, Record<string, string> | undefined>;
    return new Set([
      ...Object.keys(parsed.dependencies ?? {}),
      ...Object.keys(parsed.devDependencies ?? {}),
    ]);
  } catch {
    return new Set();
  }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}
