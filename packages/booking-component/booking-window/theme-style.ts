// Booking component: the business's colours on the window (feature 25e), as the --sa-* tokens set on
// the dialog itself, so they win over any colour a site sets in its own CSS; the site's font and
// corners still apply. The main colour fills the buttons; where it is text (days, times, the
// business's name) a shade of it that reads at 4.5 on the background is used. The softer tokens are
// mixed from the text and the background, so a dark background never gets light-theme greys.
// No theme: nothing set.

import type { CSSProperties } from "react";

import { readableOn } from "@scheduleads-app/shared/readable-on";
import { textColorOn } from "@scheduleads-app/shared/text-color-on";

import type { BookingBusinessType } from "../api-client/booking-api-types.js";

const WINDOW_BACKGROUND = "#ffffff";
const WINDOW_TEXT = "#18181b";
const WINDOW_SURFACE_2 = "#f4f4f5"; // the free days' disc, the hover wash

// The second surface as the CSS mixes it: 6% of the text into the background.
const mixed = (text: string, background: string) => {
  const at = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const channel = (i: number) =>
    Math.round(at(text, i) * 0.06 + at(background, i) * 0.94)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
};

export function themeStyle(theme: BookingBusinessType["theme"] | undefined): CSSProperties {
  if (!theme) return {};
  const background = theme.background ?? WINDOW_BACKGROUND;
  const text = theme.text ?? WINDOW_TEXT;
  const action = theme.main ?? text; // no main colour: the buttons take the text colour
  // Text in the window's colour sits on the background and on the second surface (the free days'
  // disc): it must read on both, so it is shaded against the disc, then checked on the background.
  const surface2 = theme.background || theme.text ? mixed(text, background) : WINDOW_SURFACE_2;
  const identity = readableOn(readableOn(action, surface2), background);
  const style: Record<string, string> = {
    "--sa-action": action,
    // Its look's own text on the main colour when it has one (feature 25f), else worked out.
    "--sa-action-ink": (theme.main && theme.mainInk) || textColorOn(action),
    "--sa-identity": identity,
    "--sa-identity-ink": textColorOn(identity),
  };
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
