import { z } from "zod";

/**
 * The rules both sides check sign-in against.
 *
 * They live here rather than in the frontend because the API validates
 * the same values a second time and the two must not disagree. A form
 * that accepts what the server rejects is a dead end the user cannot
 * see a reason for; a form that rejects what the server accepts hides
 * working input. One definition, imported twice.
 *
 * Pure Zod, no database import, for the same reason `subscription-limits.ts` is
 * pure: a browser bundle has to be able to import it.
 */

/**
 * An email address, normalised before it is judged.
 *
 * Trim and lowercase run first, then the shape is checked. Better Auth
 * lowercases the address itself before storing or looking it up
 * (`routes.mjs` does `rawEmail.toLowerCase()`), so normalising here is
 * what keeps the string the user sees identical to the string that
 * becomes their account. Without it, "Frank@Example.com" signs in and
 * then the code is requested for a different-looking address.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

/**
 * The login code.
 *
 * Six digits, because that is what Better Auth's generator produces:
 * `defaultOTPGenerator` in the emailOTP plugin calls
 * `generateRandomString(options.otpLength ?? 6, "0-9")` and nothing here
 * overrides `otpLength`. Read off the installed 1.7.5, not remembered.
 * If the length is ever configured on the server, change it here in the
 * same edit.
 */
export const OTP_LENGTH = 6;

export const loginCodeSchema = z
  .string()
  .trim()
  .regex(
    new RegExp(`^[0-9]{${OTP_LENGTH}}$`),
    `Enter the ${OTP_LENGTH} digit code from your email.`
  );

/** What a business is called. The one field its owner types. */
export const organizationNameSchema = z
  .string()
  .trim()
  .min(2, "Enter the name of your business.")
  .max(80, "That name is too long.");

/**
 * The slug is derived, never typed.
 *
 * It is unique across every tenant, so letting one business choose it
 * hands them the ability to take a name a later one wanted. Deriving it
 * keeps the choice with the product, and the collision handling with the
 * server, which is the only place that can see all of them.
 */
export function toSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
