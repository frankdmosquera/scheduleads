// Shared: the text colour that stays readable on a business's own colour (#rrggbb): white or dark
// ink, whichever contrasts more (WCAG relative luminance). A light brand colour gets dark text, so
// a button never turns unreadable. Used by the customer's page, the emails and the window.

import { contrastRatio } from "./contrast-ratio.js";

const INK = "#0f172a";
const WHITE = "#ffffff";

export function textColorOn(background: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(background)) return WHITE;
  return contrastRatio(background, WHITE) >= contrastRatio(background, INK) ? WHITE : INK;
}
