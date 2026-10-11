// Backend: the domain of an email address, lowercased: "bookings@Primo.com" is "primo.com".

export function emailDomainOf(email: string): string {
  return email
    .slice(email.lastIndexOf("@") + 1)
    .trim()
    .toLowerCase();
}
