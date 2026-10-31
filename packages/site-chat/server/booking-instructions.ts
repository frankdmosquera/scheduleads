import type { BookingAskBodyType } from "../booking/booking-understood-type.js";

/**
 * What the booking AI is told with every reply during a booking, written for any business: the business, the
 * service and the form's own fields come with each request. It reads the reply and returns fields; it never books,
 * never reads back and never says booked.
 */
const bookingInstructions = `You help a visitor book {service} with {business}, in the chat on its website. Today is {today} ({todayIso}).
{services}
Free times now on screen as buttons, for {day}:
{times}

Time picked: {picked}.
What the business's booking form asks, in its order, and what the visitor gave so far:
{fields}

The chat last asked for: {asking}.

Read the visitor's latest message together with the conversation, then fill in every field:
- service: the number of the listed service they chose, else null. Only a service from the list.
- time: the number of the listed time they chose ("the last one", "the 9:30"), else null. Only a time from the list.
- day: when they ask for times on another day than {day}, that day's date as YYYY-MM-DD, else null. "Monday" is the next Monday after today. A day that is already the one on screen is not another day.
- part: "morning", "afternoon" or "evening" when they ask for times in that part of a day, else null.
- name: their name, when they give it in this message, else null.
- email: their email address, when they give it in this message, else null.
- phone: their phone number, when they give it in this message, else null.
- address: the address the booking is for, when they give it in this message, else null.
- details: their answer to "{detailsLabel}", in their own words, when they give it in this message, else null.
- answers: for each of the form's own questions (the ones with an id) they answer in this message, its id and their answer in their own words; else an empty list.
- skip: true when they decline to answer what the chat last asked and the form does not require it; else false.
- book: true only when the chat's last message read the booking back and the visitor says yes to it without changing anything; else false.
- cancel: true when they no longer want to book; else false.
- other: true when the message is not about this booking at all (a question about prices or the work, for example); else false.
- reply: what the chat says next, in {language}, one or two short sentences, as the business ("we"). Move the booking on by asking for the first thing still missing, in the form's order. Acknowledge what they just gave. A time that is not on the list is not free: say so, and name the closest listed ones. Never say it is booked, never read the booking back, never offer times that are not listed, never promise a price or anything about the work, and never ask for anything the form does not ask.`;

const replyLanguages = { en: "English", es: "Spanish, addressing the visitor as usted" } as const;

const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);

/** What the chat last asked for, in the instructions' words. */
function askingOf(body: BookingAskBodyType): string {
  if (body.asking === "service") return "which service";
  if (body.asking === "time") return "a time from the list";
  if (body.asking === "confirm")
    return "a yes to the read-back: the chat's last message read the whole booking back";
  return body.fields.find((f) => f.key === body.asking)?.label ?? "the next thing the form asks";
}

/** The booking AI's instructions for this request. */
export function bookingInstructionsFor(body: BookingAskBodyType): string {
  const fields = body.fields
    .map((f) => {
      const id = f.key.startsWith("answer:") ? `, id ${f.key.slice("answer:".length)}` : "";
      return `- ${f.label} (${f.required ? "required" : "optional"}${id}): ${f.value ?? "not given yet"}`;
    })
    .join("\n");
  return fill(bookingInstructions, {
    business: body.business,
    service: body.service ?? "a service",
    services: body.services.length
      ? `\nServices to choose from:\n${body.services.map((name, i) => `${i + 1}. ${name}`).join("\n")}\n`
      : "",
    today: body.today,
    todayIso: body.todayIso,
    day: body.day || "no day yet",
    times: body.times.length
      ? body.times.map((label, i) => `${i + 1}. ${label}`).join("\n")
      : "none yet",
    picked: body.picked ?? "none yet",
    fields: fields || "- the service first",
    detailsLabel:
      body.fields.find((f) => f.key === "details")?.label ?? "what they would like done",
    asking: askingOf(body),
    language: replyLanguages[body.lang],
  });
}
