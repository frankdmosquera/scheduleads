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

// The first of base, base-2, base-3 that no other row of the business has: a service's slug,
// set once when it is added and never changed by a rename (feature 12d).
export function freeSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  let slug = base;
  for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;
  return slug;
}
