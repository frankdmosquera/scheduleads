# Fix: Settings layout

**Type:** Fix

**Size:** light - layout only, on one screen: the hours logic, the saves and the API do not
change; one step, reviewed at `/complete` (`AGENTS.md`, "Each feature is heavy or light").

**Status:** verified 2026-10-10: built, reviewed and its findings fixed; the frontend builds and lints, backend 917 and shared 172 tests pass, and the page was checked in the browser at 1280x720 and 375 wide.

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

## Implementation walkthrough

One step, as the spec planned (light). Frank asked for it right after feature 12a merged: the
Settings page showed every person fully open, about 4,200 pixels tall. It is now 1,431 at
1280x720.

### frontend/components/settings: the person rows

`person-hours-card.tsx` wraps each person in a native `<details name="people">`, so opening one
closes the others and the browser gives the keyboard behaviour. The `<summary>` holds the name (h4)
and a line built by `rowState` from what the form holds now (`useWatch`): "Follows the business's
week", or "Own week" with its days, the number of one-off dates, and "N bookings outside" after a
save leaves some outside. "Not saved" shows while `formState.isDirty`. Closing a row keeps its
edits because the form stays mounted. A refused save opens its row before it shows the error or
moves focus (F-338), since opening another person while a save runs would otherwise hide it. The
day names come from `WEEK_DAYS`, exported once by `week-editor.tsx` (F-339).

### frontend/components/settings: the page and the week

`settings-screen.tsx` puts a section list on the left (Hours only; each later Settings feature adds
its entry) and the Hours section beside it, the list above it on a phone. The headings now nest
(F-336): h1 Settings, h2 Hours, h3 the business card and "Each person", h4 inside the business card
and each person's name, h5 inside a person; `OutsideHoursList` takes h4 or h5. The rows alone left
the page three screens tall, so `day-windows-editor.tsx` draws a day's windows side by side as
chips, as the prototype does, with a small "+" and "×" (their accessible names unchanged), and
`week-editor.tsx` gives the day names a narrower column. On a phone the cards take less padding and
the time fields are wider, so "07:30 AM" is not cut.

### not changed

What each card saves, its messages, focus on the first bad field, the list of bookings left outside,
and the read-only view (the fieldset is disabled; the row still opens). No backend change.

## Findings

### settings-layout/F-336 [P3] closed - The Settings screen's heading levels put "Each person" and every person's card under the business card

**File:** frontend/components/settings/business-hours-card.tsx:105; frontend/components/settings/settings-screen.tsx:44,84; frontend/components/settings/person-hours-card.tsx:89
**Found:** 2026-10-10 by the final review of feature 12a (scope: main...76850fe; lenses: quality, security, performance, tests)
**Why it matters:** Only visible with the three components together. The screen draws h1 Settings, h2 Hours, then the business card's own h2 "When you take bookings", which ends the Hours section in the outline; "Each person" (h3) follows it, so a screen reader moving by headings files it under the business's card; and each person's name is also h3, a sibling of "Each person" instead of under it. F-333 fixed the same kind of slip for the list alone.
**Suggested fix:** One level down for the cards: the business card's title h3 (its "One-off dates" and list h4), "Each person" h3, each person's name h4 (their one-off dates and list h5), or make "Each person" visually a label and keep the names at h3 under an h2-level "When you take bookings".
**Resolution:** Fixed 2026-10-10 on fix/settings-layout: h1 Settings, h2 Hours (its section), h3 the business card and "Each person", h4 inside the business card and each person's name in their row, h5 inside a person; checked in the browser by reading the heading outline. Closed 2026-10-10 by the review of fix/settings-layout (main...9b6ec21): the code and the running page at /settings both read h1 Settings > h2 Hours > h3 "When you take bookings" (h4 One-off dates, h4 the outside list) and h3 "Each person" > h4 each person's name in their row's summary (h5 their one-off dates, h5 their outside list); OutsideHoursList takes "h4" | "h5" and both callers pass the right one; no new defect from the repair. A heading inside <summary> is exposed in Chrome; Safari with VoiceOver, which may flatten a summary's content, was not tried.

### settings-layout/F-338 [P3] closed - A person's row can close on its own save, hiding what the save answered

**File:** frontend/components/settings/person-hours-card.tsx:76-81, 91, 179-180
**Found:** 2026-10-10 by the review of fix/settings-layout (scope: main...9b6ec21; lenses: quality, security, performance, tests)
**Why it matters:** The notice, the field error and the outside list all sit inside the person's `<details>`, and opening another person closes it (the shared `name`). Two paths: (1) the owner presses Save on Marco and opens Diego before the answer comes back; a refused save then calls setError and focusFirstInvalid, but focus() on a field inside a closed row does nothing (checked in the browser pane at /settings: the focus fails and the row stays closed), so the refused field is neither seen nor focused and the row only says "Not saved"; a failed save's message is hidden the same way. (2) More likely: a save lists bookings now outside Marco's hours, the owner opens the next person, and the list (kept "until the card is saved again or the page is left") disappears with nothing on Marco's row saying it exists. Before this fix every card stayed open, so the list stayed on the page; the spec puts "the list of bookings left outside" under Must not change.
**Suggested fix:** Keep a ref on the `<details>` and set `open = true` before setError/focusFirstInvalid and before a failure notice; and add the count to the row's line while a list is held (for example "2 bookings outside"), so a closed row still says it.
**Resolution:** Fixed 2026-10-10 on fix/settings-layout: a refused save (a field error or a failure notice) opens its row before showing the error or moving focus, and the row line counts the bookings the last save left outside ("1 booking outside"), so a closed row still says the list is there. Checked in the browser: Carlos saved back onto the business's week, then Diego opened; Carlos's closed row read "Follows the business's week · 1 booking outside". Closed 2026-10-10 by the check of the settings layout fixes (9b6ec21..c9a0034): saveHours sets rowRef.current.open = true after the ok branch has returned and before both refused paths, so setError, focusFirstInvalid (whose focus runs in an effect after the next render, by then inside an open row) and the failure notice all land in an open row; the ok path is unchanged; the row line's count reads outside?.bookings.length, the same state the list draws, and clears with it when setOutside(null) starts the next save; the `<details>` stays uncontrolled (no open prop), so React never overrides the opened row. Build, lint and Prettier pass; no new defect. Not re-run in the browser.

### settings-layout/F-339 [P3] closed - The row's day names are a second copy of the week's day list

**File:** frontend/components/settings/person-hours-card.tsx:193-201; frontend/components/settings/week-editor.tsx:13-21
**Found:** 2026-10-10 by the review of fix/settings-layout (scope: main...9b6ec21; lenses: quality, security, performance, tests)
**Why it matters:** WeekEditor already holds the seven day keys in order with their names (`as const`, which gives DayKeyType); the new DAYS in person-hours-card repeats the keys with short labels. The type checks each key, but nothing ties the two lists' order or completeness, the same kind of quiet copy F-332 records on the API side.
**Suggested fix:** Export WeekEditor's DAYS and derive the short label in rowState (`name.slice(0, 3)`), or move the one list to a small module both import.
**Resolution:** Fixed 2026-10-10 on fix/settings-layout: week-editor.tsx exports WEEK_DAYS and the person row reads it, taking each day's first three letters; the second list is gone. Closed 2026-10-10 by the check of the settings layout fixes (9b6ec21..c9a0034): WEEK_DAYS (SCREAMING_SNAKE_CASE, as the standards ask) is exported once from week-editor.tsx, which maps over it and derives DayKeyType from it; rowState filters it and slices each name to Mon..Sun, the same labels as before; a search of frontend finds no other day list. No new defect.

## Independent review

**Status:** passed
**Target commit:** c9a00344c0ba024ae1ffaf0a001a010c8d695e10
**Base commit:** e5fa76d165d728088532fc1e0028a6345846d489
**Base ref:** main
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested execution:** automatic
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent, read-only, one per review
**Actual execution:** automatic
**Reviewed at:** 2026-10-10
**Scope:** main...9b6ec21, then the fixes 9b6ec21..c9a0034
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Rounds

1. The whole fix at 9b6ec21: no P0 or P1. Saving unchanged, the read-only view intact, every
   accessible name and error id kept; F-336 closed. Found F-338 (a row could close on its own save,
   hiding a refusal or the outside list) and F-339 (a second day list), both P3, fixed in e7fc6ad.
2. Check of the fixes 9b6ec21..c9a0034: both closed, nothing new.

### Commands

`npm run build --workspace=frontend`, `npm run lint --workspace=frontend`,
`npx prettier --check frontend/components/settings`, all passing at c9a0034;
`npm run test --workspace=backend` (917) and `--workspace=@scheduleads-app/shared` (172) on the branch.

### Remaining risk

Keyboard and screen-reader behaviour checked in Chrome only (a heading inside `<summary>` may be
dropped by Safari with VoiceOver). The read-only view was not opened by hand: no seed login lacks
the permission, and its code did not change. The refusal-opens-the-row path was read, not raced
in a browser.
