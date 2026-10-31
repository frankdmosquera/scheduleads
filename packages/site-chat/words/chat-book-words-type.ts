/**
 * Every line the chat says while it books, in one language. Placeholders in braces are filled by the chat:
 * `{service}`, `{day}`, `{time}`, `{when}`, `{name}`, `{label}`, `{value}`, `{summary}`, `{next}`.
 */
export interface ChatBookWordsType {
  /** More than one service: the line over their buttons. */
  service: string;
  /** The button beside a service in an opened tile. */
  bookThis: string;
  /** Over the times on the day asked for. */
  on: string;
  /** The day asked for has none: `{next}` is the day the times are on. */
  full: string;
  /** No day asked for: the next day with a free time. */
  next: string;
  /** No free time in the whole window. */
  none: string;
  /** The calendar or the business could not be read: the site's booking window takes it from here. */
  down: string;
  /** Someone took that time meanwhile. */
  gone: string;
  /** Said after the times are read out. */
  which: string;
  /** A time and its day, as the lines below name it. */
  when: string;
  /** A time was picked: said before the next question. */
  booking: string;
  /** The name was given: said before the next question. */
  thanks: string;
  /** Each field the business's form asks, as the chat asks it; `{label}` is the business's own words. */
  ask: {
    name: string;
    email: string;
    phone: string;
    /** The business takes an email or a phone, either one. */
    contact: string;
    address: string;
    details: string;
    question: string;
  };
  /** The project box's words when the business left them as the booking window's own. */
  detailsLabel: string;
  /** Added after a question the form does not require. */
  optional: string;
  /** A reply that does not fit the field asked. */
  bad: {
    name: string;
    email: string;
    phone: string;
    contact: string;
    address: string;
    details: string;
    question: string;
  };
  /** The read-back's parts, one per field given; `{label}` and `{value}`. */
  readBack: {
    name: string;
    email: string;
    phone: string;
    address: string;
    answer: string;
  };
  /** Read back before booking: `{summary}` is `when` and every part above. The visitor's yes is what books. */
  confirm: string;
  /** A "no" to the read-back. */
  change: string;
  /** Booked: `{when}`. */
  booked: string;
  /** An earlier try that seemed lost did book. */
  already: string;
  /** The answer was lost on the way: a yes tries again, and can never book twice. */
  lost: string;
  /** The business's own limit on bookings from one contact. */
  tooMany: string;
  /** Not booked, and the chat cannot tell why: the site's booking window takes it from here. */
  failed: string;
  /** The visitor called it off. */
  cancelled: string;
  /** The locale its days are written in ("en-US"). */
  dateLocale: string;
}
