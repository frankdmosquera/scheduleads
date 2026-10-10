// Shared helper: builds a business's web address (slug) from its name.

// The slug is built from the name, never typed: it is unique across every business, so
// letting one pick it would let them take a name a later business wanted.
export function toSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
