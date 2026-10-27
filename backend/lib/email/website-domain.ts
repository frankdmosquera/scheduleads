// Backend: the domain of a business's website, the only domain its emails may come from (feature
// 25a, F-531). "https://www.primopainters.ca/contact" gives "primopainters.ca"; anything that
// cannot be read gives null.

export function websiteDomain(website: string | null): string | null {
  if (!website) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}
