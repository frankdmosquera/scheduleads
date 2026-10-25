// Frontend: the words of Settings, Hours: the business's week, a person's hours, the notice
// (feature 12j), in English and Spanish ("usted"). Also the bookings a save lists, which People
// and Days off show too. One type, one object per language, so a word left out of either is a type
// error.

export type DayKeyType = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type HoursWordsType = {
  cannotChange: string;
  setBusinessHoursFirst: string;
  // The business's card
  whenYouTakeBookings: string;
  businessLede: string;
  noHoursYetLede: string;
  savedBusinessHours(outsideCount: number): string;
  oneOffDates: string;
  howFarAhead: string;
  timeZone: string;
  pickATimeZone: string;
  noticeAndHorizonNote: string;
  outsideYourHours: string;
  saving: string;
  saveHours: string;
  // A week and a day's windows
  dayNames: Record<DayKeyType, string>;
  dayShortNames: Record<DayKeyType, string>;
  closed: string;
  windowFrom(day: string, window: number): string;
  windowUntil(day: string, window: number): string;
  removeWindow(day: string, window: number): string;
  addWindow(day: string): string;
  // One-off dates; `person` is a person's name, or null for the business
  noOneOffDates: string;
  oneOffDateLabel(person: string | null, date: number): string;
  removeOneOffDate(person: string | null, date: number): string;
  unnamedOneOffDate(date: number): string;
  removeDate: string;
  addOneOffDate: string;
  // The notice
  leastNotice: string;
  noticeUnit: string;
  noticeUnits: { minutes: string; hours: string; days: string };
  // A person's row
  savedPersonHours(name: string, outsideCount: number): string;
  notSaved: string;
  personWeek(name: string): string;
  followsBusinessWeek: string;
  ownWeek: string;
  ownWeekDays(days: string): string; // the days open, as "Mon, Tue"
  noDays: string;
  oneOffDateCount(count: number): string;
  bookingsOutside(count: number): string;
  personOneOffDates(name: string): string;
  savePersonHours(name: string): string;
  // The bookings a save lists
  stillBookedCallThem: string;
  serviceWith(service: string, person: string): string;
};

export const englishHoursWords: HoursWordsType = {
  cannotChange: "Your role cannot change the hours. You can see them here.",
  setBusinessHoursFirst:
    "Set the business's hours on Hours first. Then each person can follow them or keep their own.",
  whenYouTakeBookings: "When you take bookings",
  businessLede:
    "The hours customers can book online. Everyone follows this week unless their own card says otherwise.",
  noHoursYetLede: "Set your hours. Until you do, customers cannot book online.",
  savedBusinessHours: (count) =>
    `Saved. Customers can book these hours now.${
      count
        ? ` ${count === 1 ? "One booking now sits" : `${count} bookings now sit`} outside them, listed below.`
        : ""
    }`,
  oneOffDates: "One-off dates",
  howFarAhead: "How far ahead, in days",
  timeZone: "Time zone",
  pickATimeZone: "Pick a time zone",
  noticeAndHorizonNote:
    "Notice and how far ahead apply to every service: a customer can never book sooner than the notice or further ahead than this.",
  outsideYourHours: "These bookings now sit outside your hours",
  saving: "Saving…",
  saveHours: "Save hours",
  dayNames: {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
  },
  dayShortNames: {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  },
  closed: "Closed",
  windowFrom: (day, window) => `${day}, window ${window}, from`,
  windowUntil: (day, window) => `${day}, window ${window}, until`,
  removeWindow: (day, window) => `Remove ${day}, window ${window}`,
  addWindow: (day) => `Add a window to ${day}`,
  noOneOffDates: "No one-off dates.",
  oneOffDateLabel: (person, date) =>
    person ? `${person}, one-off date ${date}` : `One-off date ${date}`,
  removeOneOffDate: (person, date) => `Remove ${person ? `${person}, ` : ""}one-off date ${date}`,
  unnamedOneOffDate: (date) => `one-off date ${date}`,
  removeDate: "Remove date",
  addOneOffDate: "+ A day that's different",
  leastNotice: "Least notice you accept",
  noticeUnit: "Notice unit",
  noticeUnits: { minutes: "minutes", hours: "hours", days: "days" },
  savedPersonHours: (name, count) =>
    `Saved. ${name} can be booked on these hours now.${
      count
        ? ` ${count === 1 ? "One booking now sits" : `${count} bookings now sit`} outside them, listed below.`
        : ""
    }`,
  notSaved: "Not saved",
  personWeek: (name) => `${name}'s week`,
  followsBusinessWeek: "Bookable whenever the business is open",
  ownWeek: "Own bookable hours",
  ownWeekDays: (days) => `Own bookable hours · ${days}`,
  noDays: "no days",
  oneOffDateCount: (count) => (count === 1 ? "1 one-off date" : `${count} one-off dates`),
  bookingsOutside: (count) => (count === 1 ? "1 booking outside" : `${count} bookings outside`),
  personOneOffDates: (name) => `Days that are different for ${name}`,
  savePersonHours: (name) => `Save ${name}'s hours`,
  stillBookedCallThem: "Still booked. Open a booking to call the customer.",
  serviceWith: (service, person) => `${service} with ${person}`,
};

export const spanishHoursWords: HoursWordsType = {
  cannotChange: "Su rol no puede cambiar el horario. Puede verlo aquí.",
  setBusinessHoursFirst:
    "Primero fije el horario del negocio en Horario. Luego cada persona puede seguirlo o tener el suyo.",
  whenYouTakeBookings: "Cuándo recibe reservas",
  businessLede:
    "Las horas en que los clientes pueden reservar en línea. Todos siguen esta semana, salvo que su propia tarjeta diga otra cosa.",
  noHoursYetLede: "Fije su horario. Hasta entonces, los clientes no pueden reservar en línea.",
  savedBusinessHours: (count) =>
    `Guardado. Los clientes ya pueden reservar en este horario.${
      count
        ? ` ${count === 1 ? "Una reserva queda" : `${count} reservas quedan`} fuera de él; se muestran abajo.`
        : ""
    }`,
  oneOffDates: "Fechas especiales",
  howFarAhead: "Con cuánta anticipación, en días",
  timeZone: "Zona horaria",
  pickATimeZone: "Elija una zona horaria",
  noticeAndHorizonNote:
    "El aviso mínimo y la anticipación valen para todos los servicios: un cliente nunca puede reservar con menos aviso ni con más anticipación que esto.",
  outsideYourHours: "Estas reservas quedan ahora fuera de su horario",
  saving: "Guardando…",
  saveHours: "Guardar horario",
  dayNames: {
    mon: "Lunes",
    tue: "Martes",
    wed: "Miércoles",
    thu: "Jueves",
    fri: "Viernes",
    sat: "Sábado",
    sun: "Domingo",
  },
  dayShortNames: {
    mon: "lun",
    tue: "mar",
    wed: "mié",
    thu: "jue",
    fri: "vie",
    sat: "sáb",
    sun: "dom",
  },
  closed: "Cerrado",
  windowFrom: (day, window) => `${day}, franja ${window}, desde`,
  windowUntil: (day, window) => `${day}, franja ${window}, hasta`,
  removeWindow: (day, window) => `Quitar ${day}, franja ${window}`,
  addWindow: (day) => `Agregar una franja a ${day}`,
  noOneOffDates: "No hay fechas especiales.",
  oneOffDateLabel: (person, date) =>
    person ? `${person}, fecha especial ${date}` : `Fecha especial ${date}`,
  removeOneOffDate: (person, date) => `Quitar ${person ? `${person}, ` : ""}fecha especial ${date}`,
  unnamedOneOffDate: (date) => `fecha especial ${date}`,
  removeDate: "Quitar fecha",
  addOneOffDate: "+ Un día distinto",
  leastNotice: "Aviso mínimo que acepta",
  noticeUnit: "Unidad del aviso",
  noticeUnits: { minutes: "minutos", hours: "horas", days: "días" },
  savedPersonHours: (name, count) =>
    `Guardado. Ya se puede reservar con ${name} en este horario.${
      count
        ? ` ${count === 1 ? "Una reserva queda" : `${count} reservas quedan`} fuera de él; se muestran abajo.`
        : ""
    }`,
  notSaved: "Sin guardar",
  personWeek: (name) => `Semana de ${name}`,
  followsBusinessWeek: "Reservable siempre que el negocio está abierto",
  ownWeek: "Horario propio para reservar",
  ownWeekDays: (days) => `Horario propio para reservar · ${days}`,
  noDays: "ningún día",
  oneOffDateCount: (count) => (count === 1 ? "1 fecha especial" : `${count} fechas especiales`),
  bookingsOutside: (count) => (count === 1 ? "1 reserva fuera" : `${count} reservas fuera`),
  personOneOffDates: (name) => `Días distintos para ${name}`,
  savePersonHours: (name) => `Guardar el horario de ${name}`,
  stillBookedCallThem: "Siguen reservadas. Abra una reserva para llamar al cliente.",
  serviceWith: (service, person) => `${service} con ${person}`,
};
