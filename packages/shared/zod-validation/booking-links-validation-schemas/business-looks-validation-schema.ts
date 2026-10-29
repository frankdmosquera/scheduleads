// Shared Zod schema: a business's own looks (feature 25f), the colour sets its website was designed
// with, offered first on Settings > Look so a click picks one. Each is a name, its three colours and
// the text its site puts on the main colour (ink), kept as designed rather than worked out. Set from
// the business's setup file; at most six, each name once.

import { z } from "zod";

import { contrastRatio } from "../../helpers/contrast-ratio.js";

const READABLE = 4.5; // WCAG AA for ordinary text

const hexValidationSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, "Use a colour like #b5838d.");

export const businessLookValidationSchema = z
  .object({
    name: z.string().trim().min(1).max(30),
    main: hexValidationSchema,
    background: hexValidationSchema,
    text: hexValidationSchema,
    ink: hexValidationSchema, // the text on the main colour, as the site has it
  })
  .strict()
  .refine(({ background, text }) => contrastRatio(background, text) >= READABLE, {
    message: "That text is too faint on that background to read. Pick a darker or lighter one.",
    path: ["text"],
  });

export const businessLooksValidationSchema = z
  .array(businessLookValidationSchema)
  .max(6)
  .refine((looks) => new Set(looks.map((look) => look.name.toLowerCase())).size === looks.length, {
    message: "Each look needs its own name.",
  });

export type BusinessLookType = z.output<typeof businessLookValidationSchema>;
