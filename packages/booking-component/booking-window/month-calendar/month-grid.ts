// Booking component: a month's days as the calendar lays them out, Monday first. Blank cells (null)
// fill the week before the 1st and after the last day, so every row has seven.

export function monthGrid(month: string): (string | null)[] {
  const [year, monthNumber] = month.split("-").map(Number);
  // Plain dates in UTC, so no daylight change can move a day.
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay(); // 0 = Sunday
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const blanksBefore = (firstWeekday + 6) % 7; // Monday first

  const cells: (string | null)[] = Array(blanksBefore).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
