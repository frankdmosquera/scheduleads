// Backend: a business's colours as its booking window gets them (feature 25e): none until its owner
// saved them on Settings > Look, so a brandColor set long before for the emails changes no window. The text on the main colour is its look's own when the saved colours are one of its looks (feature 25f), else worked out for contrast.

import { textColorOn } from "@scheduleads-app/shared/text-color-on";

export type PublicThemeType = {
  main: string | null;
  mainInk: string | null;
  background: string | null;
  text: string | null;
} | null;

export function publicThemeOf(
  coloursOn: boolean,
  main: string | null,
  background: string | null,
  text: string | null,
  savedInk: string | null = null
): PublicThemeType {
  if (!coloursOn || (!main && !background && !text)) return null;
  return { main, mainInk: main ? (savedInk ?? textColorOn(main)) : null, background, text };
}
