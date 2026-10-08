// Shared: the shape every stored texting phone must have, for the tables' checks. "+1" and ten
// digits, the area code and exchange starting 2 to 9 (textable-phone-number.ts).

export const STORED_TEXTABLE_PHONE_PATTERN = "^[+]1[2-9][0-9]{2}[2-9][0-9]{6}$";
