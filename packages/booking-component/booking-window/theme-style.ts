// Booking component: the business's colours on the window (feature 25e), as the --sa-* tokens set on
// the dialog itself, so they win over any colour a site sets in its own CSS; the site's font and
// corners still apply. The softer tokens (muted text, borders, a second surface) are mixed from the
// text and the background, so a dark background never gets light-theme greys. No theme: nothing set.

import type { CSSProperties } from "react";

import type { BookingBusinessType } from "../api-client/booking-api-types.js";

export function themeStyle(theme: BookingBusinessType["theme"] | undefined): CSSProperties {
  if (!theme) return {};
  const style: Record<string, string> = {};
  if (theme.main && theme.mainInk) {
    style["--sa-action"] = theme.main;
    style["--sa-action-ink"] = theme.mainInk;
    style["--sa-identity"] = theme.main;
    style["--sa-identity-ink"] = theme.mainInk;
  }
  const background = theme.background ?? "#ffffff";
  const text = theme.text ?? "#18181b";
  if (theme.background || theme.text) {
    style["--sa-bg"] = background;
    style["--sa-surface"] = background;
    style["--sa-text"] = text;
    style["--sa-muted"] = `color-mix(in srgb, ${text} 68%, ${background})`;
    style["--sa-border"] = `color-mix(in srgb, ${text} 14%, transparent)`;
    style["--sa-surface-2"] = `color-mix(in srgb, ${text} 6%, ${background})`;
  }
  return style as CSSProperties;
}
