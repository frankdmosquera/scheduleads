// Shared Zod schema: a business's colours from Settings > Look (feature 25e): the main colour, the
// background and the text, each #rrggbb or none. Text too faint on its background is refused; a
// colour left out is the booking window's own (white behind, near-black text).

import { z } from "zod";

import { contrastRatio } from "../../helpers/contrast-ratio.js";

const WINDOW_BACKGROUND = "#ffffff";
const WINDOW_TEXT = "#18181b";
const READABLE = 4.5; // WCAG AA for ordinary text

const colourValidationSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, "Use a colour like #b5838d.")
  .nullable();

export const businessColoursValidationSchema = z
  .object({
    main: colourValidationSchema,
    background: colourValidationSchema,
    text: colourValidationSchema,
  })
  .strict()
  .refine(
    ({ background, text }) =>
      contrastRatio(background ?? WINDOW_BACKGROUND, text ?? WINDOW_TEXT) >= READABLE,
    {
      message: "That text is too faint on that background to read. Pick a darker or lighter one.",
      path: ["text"],
    }
  );

export type BusinessColoursType = z.output<typeof businessColoursValidationSchema>;
