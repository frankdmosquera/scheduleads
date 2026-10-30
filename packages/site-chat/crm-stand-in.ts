// A stand-in Booking CRM for the tests: its three public booking routes, answering as the real ones do, with the
// form's key, the contact rule, the required address, the project box and the business's own questions checked
// the way the real booking route checks them. Nothing here reaches a network.
import type {
  BookingBusinessType,
  BookingRequestType,
  BookingServiceType,
} from "./booking/booking-api.js";

/** What the next booking tries answer, in order, before the normal checks: one entry per try. */
export type CrmTryType = "lost" | "noAnswer" | "tooMany" | "taken" | "unavailable";

export interface CrmStandInType {
  business: BookingBusinessType;
  services: BookingServiceType[];
  /** The free start times, in UTC. */
  starts: string[];
  timeZone: string;
  next?: CrmTryType[];
  /** The form or the times cannot be read. */
  down?: boolean;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const refuse = (code: string, message: string, status: number) =>
  json({ error: { code, message } }, status);

/** The date a moment is on, on `timeZone`'s clock, as YYYY-MM-DD. */
const dateOn = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));

export function crmFetch(crm: CrmStandInType) {
  /** Every booking made, with the request that made it. */
  const bookings: BookingRequestType[] = [];
  /** Every booking request sent, made or not. */
  const sent: BookingRequestType[] = [];
  const reads = { form: 0, times: 0 };

  const fetchFn: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (init?.credentials !== "omit") throw new Error("the public routes take no cookies");
    if (url.pathname === "/public/test-business/booking-links") {
      reads.form++;
      if (crm.down) return json({ error: { code: "unavailable", message: "" } }, 503);
      return json({
        business: {
          ...crm.business,
          logo: null,
          phone: null,
          laterTextsYesWords: null,
          theme: null,
        },
        bookingLinks: crm.services.map((s) => ({ ...s, durationMinutes: 60, price: null })),
      });
    }
    const times = url.pathname.match(/^\/public\/test-business\/booking-links\/([^/]+)\/times$/);
    if (times) {
      reads.times++;
      if (crm.down) return refuse("unavailable", "Times cannot be read right now.", 503);
      const from = url.searchParams.get("from")!;
      const to = url.searchParams.get("to")!;
      const clock = new Intl.DateTimeFormat("en-CA", {
        timeZone: crm.timeZone,
        hour: "numeric",
        minute: "2-digit",
      });
      const starts = crm.starts.filter((s) => {
        const date = dateOn(s, crm.timeZone);
        return date >= from && date <= to;
      });
      return json({
        timezone: crm.timeZone,
        people: [],
        startTimes: starts,
        localStartTimes: starts.map((s) => ({
          startsAt: s,
          date: dateOn(s, crm.timeZone),
          time: clock.format(new Date(s)),
          when: "",
        })),
      });
    }
    if (url.pathname === "/public/test-business/bookings" && init?.method === "POST") {
      const request = JSON.parse(String(init.body)) as BookingRequestType;
      sent.push(request);
      const next = crm.next?.shift();
      if (next === "noAnswer") throw new TypeError("Failed to fetch");
      if (next === "tooMany") return refuse("too_many_tries", "Too many tries.", 429);
      if (next === "unavailable")
        return refuse("unavailable", "Times cannot be read right now.", 503);
      // The form's key first: a form already booked gets that booking back, never a second one.
      const earlier = bookings.find((b) => b.requestKey === request.requestKey);
      if (earlier) {
        const same =
          earlier.bookingLinkId === request.bookingLinkId && earlier.startsAt === request.startsAt;
        return same
          ? json({ booking: { id: "b1", when: "" } }, 201)
          : refuse("request_key_used", "This booking form was already used.", 409);
      }
      if (next === "taken") return refuse("time_taken", "Sorry, that time was taken.", 409);
      const service = crm.services.find((s) => s.id === request.bookingLinkId);
      if (!service) return refuse("not_found", "Not here.", 404);
      if (!request.customer?.name?.trim()) return refuse("bad_request", "Enter a name.", 400);
      const { email, phone } = request.customer;
      const rule = crm.business.contactRule;
      if ((rule === "email" || rule === "both") && !email)
        return refuse("bad_request", "Enter an email.", 400);
      if ((rule === "phone" || rule === "both") && !phone)
        return refuse("bad_request", "Enter a phone number.", 400);
      if (rule === "either" && !email && !phone)
        return refuse(
          "bad_request",
          "Enter an email or a phone number. At least one is required.",
          400
        );
      if (service.addressMode === "required" && !request.location?.trim())
        return refuse("bad_request", "Enter the address.", 400);
      if (crm.business.detailsRequired && !request.details?.trim())
        return refuse(
          "bad_request",
          `Answer: ${crm.business.detailsLabel ?? "What would you like done?"}`,
          400
        );
      for (const q of crm.business.questions) {
        const given = request.answers?.find((a) => a.questionId === q.id)?.answer.trim();
        if (q.required && !given) return refuse("bad_request", `Answer: ${q.label}`, 400);
      }
      if (!crm.starts.includes(request.startsAt))
        return refuse("time_taken", "Sorry, that time was taken.", 409);
      bookings.push(request);
      crm.starts = crm.starts.filter((s) => s !== request.startsAt);
      // Booked, and the answer lost on the way back.
      if (next === "lost") throw new TypeError("Failed to fetch");
      return json({ booking: { id: `b${bookings.length}`, when: "" } }, 201);
    }
    return json({ error: { code: "not_found", message: "" } }, 404);
  };

  return { fetchFn, bookings, sent, reads };
}
