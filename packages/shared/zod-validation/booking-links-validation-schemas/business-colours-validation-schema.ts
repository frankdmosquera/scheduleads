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

const coloursShape = {
  main: colourValidationSchema,
  background: colourValidationSchema,
  text: colourValidationSchema,
};

const readable = ({ background, text }: { background: string | null; text: string | null }) =>
  contrastRatio(background ?? WINDOW_BACKGROUND, text ?? WINDOW_TEXT) >= READABLE;
const tooFaint = {
  message: "That text is too faint on that background to read. Pick a darker or lighter one.",
  path: ["text"],
};

export const businessColoursValidationSchema = z
  .object(coloursShape)
  .strict()
  .refine(readable, tooFaint);

export type BusinessColoursType = z.output<typeof businessColoursValidationSchema>;

// What Settings > Look sends (feature 25f): the colours, and the name of the business's own look
// they were picked from, if any; the API keeps that look's ink only when the colours are its own.
export const saveBusinessColoursValidationSchema = z
  .object({ ...coloursShape, look: z.string().trim().min(1).max(30).nullable().optional() })
  .strict()
  .refine(readable, tooFaint);

export type SaveBusinessColoursType = z.output<typeof saveBusinessColoursValidationSchema>;
