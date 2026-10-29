// Frontend: the business's main colour as the dashboard's highlight (feature 25e): buttons, focus
// rings, the active menu item. Every token built from the accent is set again here, because those
// tokens were worked out on the page's root and would otherwise keep the product's own indigo. The
// text on it is the business's look's own while the colour is unshaded (feature 25f), else worked
// out for contrast. No main colour: nothing set, the product's own stays.

import type { CSSProperties } from "react";

import { readableOn } from "@scheduleads-app/shared/readable-on";
import { textColorOn } from "@scheduleads-app/shared/text-color-on";

const DASHBOARD_BACKGROUND = "#ffffff"; // the light theme's page and cards

export function businessAccentStyle(
  chosen: string | null,
  chosenInk: string | null = null
): CSSProperties {
  if (!chosen) return {};
  // The highlight is also text (the active menu item, tags), so a light colour gets a shade of
  // itself that reads at 4.5 on the page.
  const main = readableOn(chosen, DASHBOARD_BACKGROUND);
  // The business's look's own text on it (feature 25f), while the highlight is its colour unshaded.
  const ink = chosenInk && main === chosen ? chosenInk : textColorOn(main);
  const soft = `color-mix(in srgb, ${main} 14%, var(--background))`;
  return {
    "--accent-base": main,
    "--accent-hover": `color-mix(in srgb, ${main} 86%, black)`,
    "--accent-ink": ink,
    "--accent-soft": soft,
    "--accent-line": `color-mix(in srgb, ${main} 38%, transparent)`,
    "--primary": main,
    "--primary-foreground": ink,
    "--ring": main,
    "--chart-1": main,
    "--sidebar-primary": main,
    "--sidebar-primary-foreground": ink,
    "--sidebar-accent": soft,
    "--sidebar-accent-foreground": main,
    "--sidebar-ring": main,
  } as CSSProperties;
}
