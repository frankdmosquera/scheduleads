// Shared: a picture's address asking ImageKit for the size or format it is shown at (feature 25e),
// "w-640,h-360" or "f-png,w-280". Only an ImageKit address gets it: a logo set by address elsewhere
// is left as it is. An address that already carries a question gets the transform added to it.

export function imageKitSized(address: string, transform: string): string {
  let host: string;
  try {
    host = new URL(address).hostname;
  } catch {
    return address;
  }
  if (host !== "ik.imagekit.io" && !host.endsWith(".imagekit.io")) return address;
  return `${address}${address.includes("?") ? "&" : "?"}tr=${transform}`;
}
