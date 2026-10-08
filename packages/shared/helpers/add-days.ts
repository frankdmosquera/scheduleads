// Shared: calendar arithmetic on a plain YYYY-MM-DD, done in UTC so no daylight change can shift
// it. Used by the API and the customer's page.

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
