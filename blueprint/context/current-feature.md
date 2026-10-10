# Fix: Settings layout

**Type:** Fix

**Size:** light - layout only, on one screen: the hours logic, the saves and the API do not
change; one step, reviewed at `/complete` (`AGENTS.md`, "Each feature is heavy or light").

**Status:** built 2026-10-10: the one step passed its check in the browser; the frontend builds and lints, backend 917 and shared 172 tests pass.

**Branch:** `fix/settings-layout`

**Fixes:** F-336

## The problem

Settings (`/settings`, feature 12a) shows every person's card fully open under the
business's card. Summit Painting (dev) has eight people, most on their own week, so the
page is about 4,200 pixels tall at 1280x720, six screens of time fields; Frank, on
2026-10-10: the settings are spread out on one page and the screen needs improving. The
heading outline is also wrong (F-336): the business card's h2 ends the Hours section, so
"Each person" falls under the business's card, and each person's name is a sibling of
"Each person" instead of under it.

## The fix

- **Each person is one closed row**, opened to edit, one at a time: a native `<details>`
  per person sharing one `name`, so opening one closes the others and the browser gives the
  keyboard and screen reader behaviour. The row says the name and the state in plain words:
  "Follows the business's week", or "Own week" with the days they work ("Mon, Tue, Wed, Thu,
  Fri"), plus "2 one-off dates" when they have any, and "Not saved" while the card holds
  edits not yet saved. Closing a row keeps its edits (the form stays mounted).
- **The section list on the left**, as in `prototypes/settings.html`: Hours only for now;
  each later Settings feature (12d onward) adds its own entry. Below about 768px wide it sits
  above the content instead of beside it.
- **Headings (F-336)**: h1 Settings, h2 Hours, h3 for the business card's title and for
  "Each person", h4 inside the business card (one-off dates, the outside list) and for each
  person's name in their row, h5 inside a person (one-off dates, the outside list).
  `OutsideHoursList` takes `"h4" | "h5"`.
- The business card stays open: it is the one most owners change.
- Added while building, because the rows alone left the page three screens tall (the business
  week stacked every window on its own line): a day's windows sit side by side as chips, as the
  prototype draws them, with a small "+" to add one and "×" to remove; the day names take a
  narrower column; on a phone the cards have less padding and the time fields are wider.

Must not change: what each card saves, its messages, focus on the first bad field after a
refused save (the row is open, since Save is inside it), the list of bookings left outside,
the read-only view for a role that may not change the business.

## Build steps

- [x] **The Settings page fits on a screen or two.** "I open Settings, see the business's
  week and one line per person, open Marco, change his Tuesday, and save."
  **Done when:** at http://localhost:3400/settings as `admin@example.com` (Summit Painting
  (dev)), at 1280x720: the page with every person closed is at most two screens tall; each
  row reads the person's name and their state; opening one person closes the one open
  before; an edit left in a closed person shows "Not saved" on its row and is still there
  when reopened; saving a person still saves (reload shows it) and still lists any booking
  it leaves outside; a refused save focuses the bad field; the heading outline reads as
  above; at 375px wide the section list sits above the content with no sideways scroll; the
  frontend builds and lints.

## Verify

The Done when above, by hand in the browser pane, with a screenshot of the page closed and
with one person open. No logic is added, so no new saved test; the backend and shared suites
still pass.
