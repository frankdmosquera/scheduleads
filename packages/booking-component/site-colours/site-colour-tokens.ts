// Booking component: the business's Look colours for its whole website (feature 25f), as five
// --site-* tokens a site maps onto its own colours in its stylesheet. Only real #rrggbb values
// reach a style attribute; a colour the business did not save gives no token, so the site keeps
// its own for it. No theme: no tokens.

import { readableOn } from "@scheduleads-app/shared/readable-on";
import { textColorOn } from "@scheduleads-app/shared/text-color-on";

import type { BookingBusinessType } from "../api-client/booking-api-types.js";

export type SiteThemeType = NonNullable<BookingBusinessType["theme"]>;

export type SiteColourTokensType = Partial<
  Record<
    "--site-main" | "--site-main-ink" | "--site-main-text" | "--site-bg" | "--site-text",
    string
  >
>;

const SITE_BACKGROUND = "#ffffff"; // no background saved: the main colour must read on white

const hexOrNull = (value: unknown) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;

export function siteColourTokens(theme: SiteThemeType | null | undefined): SiteColourTokensType {
  if (!theme) return {};
  const main = hexOrNull(theme.main);
  const background = hexOrNull(theme.background);
  const text = hexOrNull(theme.text);
  const tokens: SiteColourTokensType = {};
  if (main) {
    tokens["--site-main"] = main;
    tokens["--site-main-ink"] = textColorOn(main);
    tokens["--site-main-text"] = readableOn(main, background ?? SITE_BACKGROUND);
  }
  if (background) tokens["--site-bg"] = background;
  if (text) tokens["--site-text"] = text;
  return tokens;
}
