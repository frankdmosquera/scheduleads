// Shared: a name as the setup command compares it: no spaces at the ends, any case. The same rule
// Settings uses to refuse a name already taken (12d, decision 6), so both see one person as one.

export function nameKeyOf(name: string): string {
  return name.trim().toLowerCase();
}
