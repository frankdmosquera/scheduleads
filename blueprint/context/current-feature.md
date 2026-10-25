# Fix: One card per person on People

**Type:** Fix

**Size:** light - one screen rearranged: a person's hours move into their card and save with its
one Save; the saves and their rules already exist and do not change.

**Status:** verified

**Branch:** fix/one-card-per-person-on-people

## The problem

Since feature 12k, each person on Settings, People shows two boxes: their row (name, on or off,
what customers book them for, Change) and, under it, a second row with their name again and
"Bookable whenever the business is open", which opens their hours with a Save of its own (the
F-500 fix, so a card's Save never dropped hours not yet saved). Walking Summit Painting (dev) on
2026-10-25, Frank read the second row as a second card and found it confusing: one person, two
boxes, two Saves. He wants one card per person (his yes, 2026-10-25). Services' "Runs" row has
the same shape but stays as it is: Frank is not sure about it yet.

- `frontend/components/settings/people-screen.tsx` (`hoursCardOf`, the row and the open card)
- `frontend/components/settings/person-hours-card.tsx`, `own-hours-card.tsx`

## The fix

One box per person, closed or open:

- **The closed row** says it all in one place: name, On or Off, "Booked by customers for: ..."
  (or "Not booked by customers"), when they are bookable ("Bookable whenever the business is
  open", or "Own bookable hours · Mon, Tue", and any one-off dates), "Gets texts", and the
  button. No second row under it.
- **Change opens the whole card**: name, work email, on or off, "What they can do", "Bookable
  hours" (whenever the business is open, or their own week, and "+ A day that's different"),
  texts. **One Save** saves all of it; **Cancel** drops all of it. Nothing is ever saved or
  dropped on its own.
- **One Save, in order**: first every part checks its own form (an hours window that ends
  before it starts is caught here, before anything is saved), then what they can do, their
  texts, their hours, and the card itself (name, email, on or off), each through its existing
  route. A refusal from the server at any of them keeps the card open on its error, as skills
  and texts do today (the parts before it stay saved, as now). Hours change only when edited.
- **After the save**, the page says what happened in one notice, and lists the upcoming bookings
  the new hours leave outside (as the hours card did), above the list, until the next save.
- **A member** (who may not change the business) gets "See" instead of "Change": the same card,
  every field read-only, no Save, "Close" instead of Cancel. So members still see each person's
  hours (F-499).
- **An off person** shows no hours part, as today: their hours cannot change until they are on.
  Before the business has hours, "Set the business's hours on Hours first" stays once above the
  list.
- The hours editor (the week and one-off dates) is shared with the Services page's "Runs" card,
  so the two never drift; the Runs card keeps working as it does now.
- New words in English and Spanish ("Bookable hours", "See", "Close", the outside-hours title on
  the page).

It must not break: every save's own checks and refusals (12k's skills rule, the work email, the
last person on, an hours window that ends before it starts), the outside-hours list, the Services
page's Runs card, and the Spanish screens.

## Build steps

- [x] 1. **One card per person.** The hours part joins the person's card and its one Save; the
  second row goes; the closed row carries the hours line; members get the card read-only.
  **Done when:** on http://localhost:3400/settings/people (Summit Painting (dev), then Riverbend
  Clinic (dev)) every person shows one box; changing Carlos's skills and his own week in one
  open card and pressing Save saves both (read back after a reload), and Cancel drops both; an
  hours error (a window ending before it starts) keeps the card open on it and saves nothing
  else; a booking left outside new hours is listed on the page; the Services page's Runs card
  still saves; every new word reads in Spanish; builds, lint and every suite pass.

## Verify

Open Settings, People. Each person is one box that says what they do and when they are bookable.
Press Change on one person, tick a service and give them their own week, press Save once: the row
now shows both. Open it again and Cancel after changing something: nothing changed. As a member,
each person has "See", which opens the card with nothing to change.
