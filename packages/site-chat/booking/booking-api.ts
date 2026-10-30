import type { ChatLanguageType } from "../words/chat-words-type.js";

/*
 * Booking CRM's public booking routes, called from the visitor's browser like the booking window: no secret, and its
 * limits see each visitor. Plain fetch, because the chat installs without hono, and every answer is checked by hand
 * before it is used, so a changed answer fails as "could not read", never as wrong times.
 */

/** Where the site's business books: the CRM's address and the business's slug, as the booking window gets them. */
export interface BookingAccountType {
  apiUrl: string;
  slug: string;
}

export type ContactRuleType = "email" | "phone" | "either" | "both";
export type AddressModeType = "required" | "optional" | "not_asked";

/** One of the business's own questions, in its order. */
export interface BookingQuestionType {
  id: string;
  label: string;
  required: boolean;
}

/** What the booking form asks, as the business set it in the CRM. */
export interface BookingBusinessType {
  name: string;
  contactRule: ContactRuleType;
  /** The project box's words; null: the chat's own. */
  detailsLabel: string | null;
  detailsRequired: boolean;
  questions: BookingQuestionType[];
}

/** One active service, and whether it asks for an address. */
export interface BookingServiceType {
  id: string;
  name: string;
  addressMode: AddressModeType;
}

export interface BookingFormType {
  business: BookingBusinessType;
  services: BookingServiceType[];
}

/** One free start time, with its date and clock time on the business's clock as the CRM wrote them. */
export interface FreeTimeType {
  startsAt: string;
  /** YYYY-MM-DD on the business's clock. */
  date: string;
  /** "9:00 a.m.", in the language asked for. */
  time: string;
}

export interface FreeTimesType {
  /** The business's IANA zone. */
  timeZone: string;
  times: FreeTimeType[];
}

/** Exactly what the booking window sends when the customer presses Book. */
export interface BookingRequestType {
  bookingLinkId: string;
  startsAt: string;
  customer: { name: string; email?: string; phone?: string };
  location?: string;
  details?: string;
  answers: { questionId: string; question: string; answer: string }[];
  language: ChatLanguageType;
  requestKey: string;
}

/**
 * How a booking went, in our own words, never the CRM's message shown as is. `already`: this key booked on an
 * earlier try whose answer was lost. `needed`: the route refused the form (400), with its words, so the chat can
 * ask what is missing. `lost`: no answer, or the CRM could not check the time: the same key tries again.
 */
export type BookingResultType =
  | { state: "booked" }
  | { state: "taken" }
  | { state: "already" }
  | { state: "tooMany" }
  | { state: "needed"; message: string }
  | { state: "refused" }
  | { state: "lost" };

/** The CRM's own limit for a call, so a stuck request ends as "could not read". */
const TIME_LIMIT_MS = 10_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isText = (value: unknown): value is string => typeof value === "string";

function call(fetchFn: typeof fetch, url: string, init?: RequestInit): Promise<Response> {
  // The public routes refuse credentials, and a client site's cookies are not ours to send.
  return fetchFn(url, { ...init, credentials: "omit", signal: AbortSignal.timeout(TIME_LIMIT_MS) });
}

const base = ({ apiUrl, slug }: BookingAccountType) =>
  `${apiUrl.replace(/\/+$/, "")}/public/${encodeURIComponent(slug)}`;

const contactRules: readonly string[] = ["email", "phone", "either", "both"];
const addressModes: readonly string[] = ["required", "optional", "not_asked"];

/** The business's form and its active services. Throws when they cannot be read. */
export async function readBookingForm(
  account: BookingAccountType,
  fetchFn: typeof fetch
): Promise<BookingFormType> {
  const response = await call(fetchFn, `${base(account)}/booking-links`);
  if (!response.ok) throw new Error(`booking-links ${response.status}`);
  const body: unknown = await response.json();
  const business = isRecord(body) && isRecord(body.business) ? body.business : null;
  const links = isRecord(body) && Array.isArray(body.bookingLinks) ? body.bookingLinks : null;
  if (
    !business ||
    !links ||
    !isText(business.name) ||
    !contactRules.includes(business.contactRule as string) ||
    !(business.detailsLabel === null || isText(business.detailsLabel)) ||
    typeof business.detailsRequired !== "boolean" ||
    !Array.isArray(business.questions)
  )
    throw new Error("booking-links: unexpected answer");
  const questions = business.questions.map((q: unknown) => {
    if (!isRecord(q) || !isText(q.id) || !isText(q.label) || typeof q.required !== "boolean")
      throw new Error("booking-links: unexpected question");
    return { id: q.id, label: q.label, required: q.required };
  });
  const services = links.map((link: unknown) => {
    if (
      !isRecord(link) ||
      !isText(link.id) ||
      !isText(link.name) ||
      !addressModes.includes(link.addressMode as string)
    )
      throw new Error("booking-links: unexpected service");
    return { id: link.id, name: link.name, addressMode: link.addressMode as AddressModeType };
  });
  return {
    business: {
      name: business.name,
      contactRule: business.contactRule as ContactRuleType,
      detailsLabel: business.detailsLabel as string | null,
      detailsRequired: business.detailsRequired,
      questions,
    },
    services,
  };
}

/**
 * A service's free start times from `from` (YYYY-MM-DD) for 31 dates, earliest first, with the business's zone. The
 * CRM cuts the range to today through its horizon. Throws when they cannot be read.
 */
export async function readFreeTimes(
  account: BookingAccountType,
  serviceId: string,
  from: string,
  to: string,
  language: ChatLanguageType,
  fetchFn: typeof fetch
): Promise<FreeTimesType> {
  const query = new URLSearchParams({ from, to, language });
  const response = await call(
    fetchFn,
    `${base(account)}/booking-links/${encodeURIComponent(serviceId)}/times?${query}`
  );
  if (!response.ok) throw new Error(`times ${response.status}`);
  const body: unknown = await response.json();
  const local = isRecord(body) && Array.isArray(body.localStartTimes) ? body.localStartTimes : null;
  if (!local || !isRecord(body) || !isText(body.timezone))
    throw new Error("times: unexpected answer");
  const times = local.map((t: unknown) => {
    if (
      !isRecord(t) ||
      !isText(t.startsAt) ||
      Number.isNaN(Date.parse(t.startsAt)) ||
      !isText(t.date) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(t.date) ||
      !isText(t.time)
    )
      throw new Error("times: unexpected time");
    return { startsAt: t.startsAt, date: t.date, time: t.time };
  });
  return {
    timeZone: body.timezone,
    times: times.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
  };
}

/** The CRM's error code and words, when its answer carries them. */
async function refusalOf(response: Response): Promise<{ code: string | null; message: string }> {
  try {
    const body: unknown = await response.json();
    const error = isRecord(body) && isRecord(body.error) ? body.error : null;
    return {
      code: error && isText(error.code) ? error.code : null,
      message: error && isText(error.message) ? error.message : "",
    };
  } catch {
    return { code: null, message: "" };
  }
}

/** Books into the CRM: the contact, the lead, the booking, the calendar event and the emails, there. */
export async function createBooking(
  account: BookingAccountType,
  request: BookingRequestType,
  fetchFn: typeof fetch
): Promise<BookingResultType> {
  let response: Response;
  try {
    response = await call(fetchFn, `${base(account)}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    return { state: "lost" };
  }
  // Booked either way: the CRM said so, also when this key's earlier try had booked it.
  if (response.status === 201) return { state: "booked" };
  const { code, message } = await refusalOf(response);
  if (response.status === 409 && code === "time_taken") return { state: "taken" };
  // The key booked on an earlier try (its answer lost), with other details: that booking stands.
  if (response.status === 409 && code === "request_key_used") return { state: "already" };
  if (response.status === 429) return { state: "tooMany" };
  if (response.status === 400) return { state: "needed", message };
  // The route's own 503 came after it looked the key up: the same key may try again, as may no answer at all.
  if (response.status >= 500) return { state: "lost" };
  return { state: "refused" };
}
