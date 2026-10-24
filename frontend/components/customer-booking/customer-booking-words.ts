// Frontend: everything the customer's booking page says, in English and Spanish (feature 12i). The
// page speaks its booking's language, the one its window spoke; before the booking has loaded, the
// browser's. Spanish is in "usted". One object per language, so a word left out is a type error.

export type CustomerBookingLanguageType = "en" | "es";

export type CustomerBookingWordsType = {
  intlLocale: string;
  oneMoment: string;
  linkDoesNotWork: string;
  callTheSender: string;
  cannotLoad: string;
  tryInAMoment: string;
  tryAgain: string;
  tabTitle(business: string): string;
  linkGone: string;
  cancelFailed: string;
  moveFailed: string;
  yourBookingCancelled: string;
  yourBookingMoved: string;
  yourBooking: string;
  nowAt(when: string): string;
  alreadyStarted: string;
  toChangeCall(business: string): string;
  what: string;
  whenItWas: string;
  when: string;
  with: string;
  changeTheTime: string;
  cancelThisBooking: string;
  cancelThisBookingQuestion: string;
  cancelling: string;
  yesCancelIt: string;
  keepIt: string;
  call(business: string): string;
  // The change-time panel
  timeJustTaken: string;
  moveQuestion(when: string, person: string | null): string; // person null: the business assigns
  anyAvailablePerson: string;
  moving: string;
  yesMoveIt: string;
  keepTheCurrentTime: string;
  pickANewTime: string;
  who: string;
  anyAvailable: string;
  earlier: string;
  later: string;
  findingTimes: string;
  timesCannotLoad: string;
  noTimesThisWeek: string;
  showNextWeek: string;
  weekTo: string; // "Oct 4 to 10"
  weekHasNoTimes(week: string): string;
  weekHasTimes(week: string, count: number): string;
  booksUpTo(business: string, day: string): string;
  toBookLaterCall: string; // followed by the phone number
};

const english: CustomerBookingWordsType = {
  intlLocale: "en-CA",
  oneMoment: "One moment…",
  linkDoesNotWork: "This link doesn't work",
  callTheSender: "Please call the business that sent it.",
  cannotLoad: "Your booking can't load right now",
  tryInAMoment: "Please try again in a moment.",
  tryAgain: "Try again",
  tabTitle: (business) => `Your booking with ${business}`,
  linkGone: "This link no longer opens a booking. Please call the business.",
  cancelFailed: "The cancel didn't go through. Please try again, or call the business.",
  moveFailed: "The move didn't go through. Please try again, or call the business.",
  yourBookingCancelled: "Your booking is cancelled",
  yourBookingMoved: "Your booking has moved",
  yourBooking: "Your booking",
  nowAt: (when) => `It's now ${when}.`,
  alreadyStarted: "This booking has already started.",
  toChangeCall: (business) => ` To change it, call ${business}.`,
  what: "What",
  whenItWas: "When it was",
  when: "When",
  with: "With",
  changeTheTime: "Change the time",
  cancelThisBooking: "Cancel this booking",
  cancelThisBookingQuestion: "Cancel this booking?",
  cancelling: "Cancelling…",
  yesCancelIt: "Yes, cancel it",
  keepIt: "Keep it",
  call: (business) => `Call ${business}`,
  timeJustTaken: "That time was just taken. Pick another.",
  moveQuestion: (when, person) => `Move to ${when}${person === null ? "" : ` with ${person}`}?`,
  anyAvailablePerson: "any available person",
  moving: "Moving…",
  yesMoveIt: "Yes, move it",
  keepTheCurrentTime: "Keep the current time",
  pickANewTime: "Pick a new time",
  who: "Who",
  anyAvailable: "Any available",
  earlier: "‹ Earlier",
  later: "Later ›",
  findingTimes: "Finding free times…",
  timesCannotLoad: "The free times can't load right now.",
  noTimesThisWeek: "No free times this week.",
  showNextWeek: "Show the next week",
  weekTo: "to",
  weekHasNoTimes: (week) => `${week}: no free times.`,
  weekHasTimes: (week, count) => `${week}: ${count} free ${count === 1 ? "time" : "times"}.`,
  booksUpTo: (business, day) => `${business} takes bookings up to ${day}.`,
  toBookLaterCall: " To book later, call ",
};

const spanish: CustomerBookingWordsType = {
  intlLocale: "es-419",
  oneMoment: "Un momento…",
  linkDoesNotWork: "Este enlace no funciona",
  callTheSender: "Por favor llame al negocio que se lo envió.",
  cannotLoad: "Su reserva no puede cargar en este momento",
  tryInAMoment: "Por favor intente de nuevo en un momento.",
  tryAgain: "Intentar de nuevo",
  tabTitle: (business) => `Su reserva con ${business}`,
  linkGone: "Este enlace ya no abre una reserva. Por favor llame al negocio.",
  cancelFailed: "No se pudo cancelar. Por favor intente de nuevo, o llame al negocio.",
  moveFailed: "No se pudo cambiar la hora. Por favor intente de nuevo, o llame al negocio.",
  yourBookingCancelled: "Su reserva fue cancelada",
  yourBookingMoved: "Su reserva cambió de hora",
  yourBooking: "Su reserva",
  nowAt: (when) => `Ahora es el ${when.charAt(0).toLocaleLowerCase("es") + when.slice(1)}.`,
  alreadyStarted: "Esta reserva ya comenzó.",
  toChangeCall: (business) => ` Para cambiarla, llame a ${business}.`,
  what: "Qué",
  whenItWas: "Cuándo era",
  when: "Cuándo",
  with: "Con",
  changeTheTime: "Cambiar la hora",
  cancelThisBooking: "Cancelar esta reserva",
  cancelThisBookingQuestion: "¿Cancelar esta reserva?",
  cancelling: "Cancelando…",
  yesCancelIt: "Sí, cancelarla",
  keepIt: "Mantenerla",
  call: (business) => `Llamar a ${business}`,
  timeJustTaken: "Esa hora se acaba de ocupar. Elija otra.",
  moveQuestion: (when, person) =>
    `¿Cambiar al ${when.charAt(0).toLocaleLowerCase("es") + when.slice(1)}${person === null ? "" : ` con ${person}`}?`,
  anyAvailablePerson: "cualquier persona disponible",
  moving: "Cambiando…",
  yesMoveIt: "Sí, cambiarla",
  keepTheCurrentTime: "Mantener la hora actual",
  pickANewTime: "Elija una nueva hora",
  who: "Con quién",
  anyAvailable: "Cualquiera disponible",
  earlier: "‹ Antes",
  later: "Después ›",
  findingTimes: "Buscando horarios libres…",
  timesCannotLoad: "Los horarios libres no pueden cargar en este momento.",
  noTimesThisWeek: "No hay horarios libres esta semana.",
  showNextWeek: "Ver la semana siguiente",
  weekTo: "al",
  weekHasNoTimes: (week) => `${week}: no hay horarios libres.`,
  weekHasTimes: (week, count) =>
    `${week}: ${count} ${count === 1 ? "horario libre" : "horarios libres"}.`,
  booksUpTo: (business, day) => `${business} recibe reservas hasta el ${day}.`,
  toBookLaterCall: " Para reservar más adelante, llame al ",
};

export const customerBookingWordsOf: Record<CustomerBookingLanguageType, CustomerBookingWordsType> =
  { en: english, es: spanish };

// Before the booking has loaded: the browser's own language, Spanish or English.
export function browserLanguage(): CustomerBookingLanguageType {
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("es")
    ? "es"
    : "en";
}
