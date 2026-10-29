// Booking component: the business's Look colours for its whole website (feature 25f), as five
// --site-* tokens a site maps onto its own colours in its stylesheet. Only real #rrggbb values
// reach a style attribute; a colour the business did not save gives no token, so the site keeps
// its own for it. No theme: no tokens. The text on the main colour is one of the site's own light
// and dark, whichever reads better, so the site never shows a colour that is not in its palette.

import { contrastRatio } from "@scheduleads-app/shared/contrast-ratio";
import { readableOn } from "@scheduleads-app/shared/readable-on";

import type { BookingBusinessType } from "../api-client/booking-api-types.js";

export type SiteThemeType = NonNullable<BookingBusinessType["theme"]>;

export type SiteColourTokensType = Partial<
  Record<
    "--site-main" | "--site-main-ink" | "--site-main-text" | "--site-bg" | "--site-text",
    string
  >
>;

// The site's own text colours for words on its main colour: its lightest and its darkest.
export type SiteInksType = { light: string; dark: string };

const SITE_BACKGROUND = "#ffffff"; // no background saved: the main colour must read on white
const PLAIN_INKS: SiteInksType = { light: "#ffffff", dark: "#000000" };

const hexOrNull = (value: unknown) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;

export function siteColourTokens(
  theme: SiteThemeType | null | undefined,
  inks: SiteInksType = PLAIN_INKS
): SiteColourTokensType {
  if (!theme) return {};
  const main = hexOrNull(theme.main);
  const background = hexOrNull(theme.background);
  const text = hexOrNull(theme.text);
  const tokens: SiteColourTokensType = {};
  if (main) {
    tokens["--site-main"] = main;
    tokens["--site-main-ink"] =
      contrastRatio(inks.light, main) >= contrastRatio(inks.dark, main) ? inks.light : inks.dark;
    tokens["--site-main-text"] = readableOn(main, background ?? SITE_BACKGROUND);
  }
  if (background) tokens["--site-bg"] = background;
  if (text) tokens["--site-text"] = text;
  return tokens;
}
