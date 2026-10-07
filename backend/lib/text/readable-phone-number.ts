// Backend: a number as Twilio gives it, "+14035550148", as people read it, "403-555-0148". Any
// other shape is shown as it came.

export function readablePhoneNumber(number: string): string {
  return number.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3");
}
