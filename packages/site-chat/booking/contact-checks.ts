/* The chat's checks on what a visitor gives, before anything is sent: the booking route checks again. */

/** The longest each field may be, as Booking CRM's booking route takes it. */
export const fieldLimits = {
  name: 120,
  email: 254,
  phone: 40,
  address: 300,
  details: 2000,
  answer: 500,
} as const;

/** An email that looks like one, or a number of at least seven digits. */
export function passesContactCheck(value: string, check: "email" | "tel"): boolean {
  const v = value.trim();
  if (!v) return false;
  if (check === "email")
    return v.length <= fieldLimits.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  return v.length <= fieldLimits.phone && v.replace(/\D/g, "").length >= 7;
}

/** Words that fit a free-text field: something said, within its limit. */
export function fitsText(value: string | null | undefined, most: number): string | null {
  const v = value?.trim();
  return v && v.length <= most ? v : null;
}
