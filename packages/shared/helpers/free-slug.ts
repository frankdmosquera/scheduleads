// Shared helper: the first of base, base-2, base-3 that no other row of the business has: a
// service's slug, set once when it is added and never changed by a rename (feature 12d).

export function freeSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  let slug = base;
  for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;
  return slug;
}
