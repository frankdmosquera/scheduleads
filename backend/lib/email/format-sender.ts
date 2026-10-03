// Backend: an email's from line, "Business name" <address>. The name is quoted, so a comma or
// an ampersand in it ("Smith, Jones & Co") cannot split it into two addresses or be refused.

export function formatSender(name: string, address: string): string {
  const quoted = name.replace(/[\r\n]+/g, " ").replace(/["\\]/g, "\\$&");
  return `"${quoted}" <${address}>`;
}
