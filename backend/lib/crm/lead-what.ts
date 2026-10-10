// Backend: what a lead asked for, in one short line: the service it booked, else the first line
// of the customer's own words, else nothing.

const MAX_LENGTH = 120;

export function leadWhat(serviceName: string | null, details: string | null): string | null {
  if (serviceName) return serviceName;
  const firstLine = details?.trim().split(/\r?\n/)[0]?.trim();
  if (!firstLine) return null;
  return firstLine.length > MAX_LENGTH ? `${firstLine.slice(0, MAX_LENGTH - 1)}…` : firstLine;
}
