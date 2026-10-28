// Shared: a business's colour made readable as text on a background (feature 25e): the colour
// itself when it already reads at 4.5, else the same colour mixed step by step toward black on a
// light background (white on a dark one) until it does. The hue stays the business's own.

import { contrastRatio } from "./contrast-ratio.js";

const READABLE = 4.5;

const channels = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
const toHex = (values: number[]) =>
  `#${values.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;

export function readableOn(colour: string, background: string): string {
  if (contrastRatio(colour, background) >= READABLE) return colour;
  const towards =
    contrastRatio("#000000", background) >= contrastRatio("#ffffff", background) ? 0 : 255;
  const from = channels(colour);
  for (let step = 1; step <= 20; step += 1) {
    const share = step / 20;
    const mixed = toHex(from.map((value) => value + (towards - value) * share));
    if (contrastRatio(mixed, background) >= READABLE) return mixed;
  }
  return towards === 0 ? "#000000" : "#ffffff";
}
