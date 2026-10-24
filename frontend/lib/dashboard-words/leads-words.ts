// Frontend: the words of the leads list, a lead's page and adding a lead (feature 12j), in English
// and Spanish ("usted"). One type, one object per language, so a word left out of either is a type
// error. A time inside a sentence comes already written in the language (formatLeadTime).

type LeadSourceType = "widget" | "hosted" | "manual";

export type LeadsWordsType = {
  // The list
  listLede: string;
  addALead: string;
  addALeadTitle: string;
  loadingYourLeads: string;
  signInEndedSeeMore: string;
  noLeadsYet: string;
  browserTimeZoneNote: string;
  loading: string;
  showMore: string;
  bookedFor(time: string, cancelled: boolean): string;
  cameInAt(time: string): string;
  noPhoneOrEmail: string;
  sourceName: Record<LeadSourceType, string>;
  // Adding a lead
  nameLabel: string;
  phoneLabel: string;
  emailLabel: string;
  whatTheyWant: string;
  saving: string;
  saveTheLead: string;
  cancel: string;
  // A lead's page
  backToLeads: string;
  loadingThisLead: string;
  noLeadHere: string;
  noLeadHereLede: string;
  alreadyAContact(name: string): string;
  thisRequest: string;
  stage: string;
  cameFrom: string;
  cameIn: string;
  phoneGiven: string;
  bookings(count: number): string; // the section's title
  cancelled: string;
  everythingThatHappened: string;
  nothingYet: string;
  onlyNewest200: string;
  nextSteps: string;
  otherRequests: string;
  aRequest: string;
  // Next steps
  checkTheStep: string;
  nothingOwed: string;
  dueAt(time: string): string;
  nextStepTypeName(type: string): string; // a step with no words of its own: "call"
  doneLabel(what: string | null): string;
  done: string;
  addANextStep: string;
  nextStepPlaceholder: string;
  whenItIsDue: string;
  add: string;
  // The timeline
  aBooking: string;
  aTimeNotRecorded: string;
  booked(service: string, time: string): string;
  moved(service: string, from: string, to: string): string;
  cancelledBooking(service: string): string;
  emailLines: Record<string, string>;
  sentAnEmail: string;
  textLines: Record<string, string>;
  textedAReminder(minutesBefore: number): string;
  sentAText: string;
  otherLines: Record<string, string>; // anything else: its type, underscores as spaces
  byActor(name: string): string; // after the line, with its leading space
};

// "30 minutes", "2 hours", "1 day".
function lengthIn(
  minutes: number,
  units: [string, string, string, string, string, string]
): string {
  const [day, days, hour, hours, minute, minuteMany] = units;
  if (minutes % 1440 === 0) return `${minutes / 1440} ${minutes === 1440 ? day : days}`;
  if (minutes % 60 === 0) return `${minutes / 60} ${minutes === 60 ? hour : hours}`;
  return `${minutes} ${minutes === 1 ? minute : minuteMany}`;
}

const spaced = (type: string) => type.replace(/_/g, " ");

export const englishLeadsWords: LeadsWordsType = {
  listLede: "Everyone who asked for something, and where each one stands.",
  addALead: "+ Add a lead",
  addALeadTitle: "Add a lead",
  loadingYourLeads: "Loading your leads…",
  signInEndedSeeMore: "Your sign-in has ended. Sign in again to see more.",
  noLeadsYet:
    "No leads yet. They appear here when someone books on your site, or when you add one.",
  browserTimeZoneNote:
    "Times are in your browser's time zone: this business has no bookable hours yet.",
  loading: "Loading…",
  showMore: "Show more",
  bookedFor: (time, cancelled) => `${time}${cancelled ? ", cancelled" : ""}`,
  cameInAt: (time) => `came in ${time}`,
  noPhoneOrEmail: "no phone or email",
  sourceName: { widget: "Website", hosted: "Booking page", manual: "Added by hand" },
  nameLabel: "Name",
  phoneLabel: "Phone",
  emailLabel: "Email",
  whatTheyWant: "What they want",
  saving: "Saving…",
  saveTheLead: "Save the lead",
  cancel: "Cancel",
  backToLeads: "← Leads",
  loadingThisLead: "Loading this lead…",
  noLeadHere: "No lead here",
  noLeadHereLede: "This address does not match a lead of your business.",
  alreadyAContact: (name) =>
    `Already a contact: this request was added to ${name}, whose details stay as first given.`,
  thisRequest: "This request",
  stage: "Stage",
  cameFrom: "Came from",
  cameIn: "Came in",
  phoneGiven: "Phone given",
  bookings: (count) => (count === 1 ? "Booking" : "Bookings"),
  cancelled: "Cancelled",
  everythingThatHappened: "Everything that happened",
  nothingYet: "Nothing yet.",
  onlyNewest200: "Only the newest 200 are shown.",
  nextSteps: "Next steps",
  otherRequests: "Other requests",
  aRequest: "A request",
  checkTheStep: "Check the step.",
  nothingOwed: "Nothing owed.",
  dueAt: (time) => `due ${time}`,
  nextStepTypeName: spaced,
  doneLabel: (what) => `Done: ${what ?? "this step"}`,
  done: "Done",
  addANextStep: "Add a next step",
  nextStepPlaceholder: "Call back about the quote",
  whenItIsDue: "When it is due",
  add: "Add",
  aBooking: "a booking",
  aTimeNotRecorded: "a time not recorded",
  booked: (service, time) => `Booked ${service} for ${time}`,
  moved: (service, from, to) => `Moved ${service} from ${from} to ${to}`,
  cancelledBooking: (service) => `Cancelled ${service}`,
  emailLines: {
    booking_confirmation: "Sent the booking confirmation by email",
    booking_notification: "Told the business about the booking by email",
    booking_person_notification: "Told the booked person about the booking by email",
    booking_cancellation: "Sent the cancellation by email",
    booking_cancellation_notification: "Told the business about the cancellation by email",
    booking_move: "Sent the new time by email",
    booking_move_notification: "Told the business about the new time by email",
  },
  sentAnEmail: "Sent an email",
  textLines: {
    booking_confirmation: "Texted the confirmation",
    worker_added: "Texted the worker about the booking",
    worker_moved: "Texted the worker about the new time",
    worker_removed: "Texted the worker about the cancellation",
  },
  textedAReminder: (minutesBefore) =>
    `Texted a reminder ${lengthIn(minutesBefore, ["day", "days", "hour", "hours", "minute", "minutes"])} before`,
  sentAText: "Sent a text",
  otherLines: {
    later_texts_yes: "Said yes to texts",
    lead_added: "Added by hand",
    stage_changed: "Stage changed",
    email_received: "Email received",
    note: "Note",
    call: "Call",
    task: "Task",
  },
  byActor: (name) => ` by ${name}`,
};

const spanishStepTypes: Record<string, string> = { call: "llamada", task: "tarea", note: "nota" };

export const spanishLeadsWords: LeadsWordsType = {
  listLede: "Todas las personas que pidieron algo, y en qué punto está cada una.",
  addALead: "+ Agregar un prospecto",
  addALeadTitle: "Agregar un prospecto",
  loadingYourLeads: "Cargando sus prospectos…",
  signInEndedSeeMore: "Su sesión ha terminado. Inicie sesión de nuevo para ver más.",
  noLeadsYet:
    "Todavía no hay prospectos. Aparecen aquí cuando alguien reserva en su sitio, o cuando usted agrega uno.",
  browserTimeZoneNote:
    "Las horas están en la zona horaria de su navegador: este negocio todavía no tiene horas para reservar.",
  loading: "Cargando…",
  showMore: "Mostrar más",
  bookedFor: (time, cancelled) => `${time}${cancelled ? ", cancelada" : ""}`,
  cameInAt: (time) => `llegó el ${time}`,
  noPhoneOrEmail: "sin teléfono ni correo",
  sourceName: { widget: "Sitio web", hosted: "Página de reservas", manual: "Agregado a mano" },
  nameLabel: "Nombre",
  phoneLabel: "Teléfono",
  emailLabel: "Correo",
  whatTheyWant: "Lo que quiere",
  saving: "Guardando…",
  saveTheLead: "Guardar el prospecto",
  cancel: "Cancelar",
  backToLeads: "← Prospectos",
  loadingThisLead: "Cargando este prospecto…",
  noLeadHere: "Aquí no hay ningún prospecto",
  noLeadHereLede: "Esta dirección no corresponde a ningún prospecto de su negocio.",
  alreadyAContact: (name) =>
    `Ya es un contacto: esta solicitud se agregó a ${name}, cuyos datos quedan como se dieron la primera vez.`,
  thisRequest: "Esta solicitud",
  stage: "Etapa",
  cameFrom: "Vino de",
  cameIn: "Llegó",
  phoneGiven: "Teléfono dado",
  bookings: (count) => (count === 1 ? "Reserva" : "Reservas"),
  cancelled: "Cancelada",
  everythingThatHappened: "Todo lo que pasó",
  nothingYet: "Nada todavía.",
  onlyNewest200: "Solo se muestran los 200 más recientes.",
  nextSteps: "Próximos pasos",
  otherRequests: "Otras solicitudes",
  aRequest: "Una solicitud",
  checkTheStep: "Revise el paso.",
  nothingOwed: "Nada pendiente.",
  dueAt: (time) => `para el ${time}`,
  nextStepTypeName: (type) => spanishStepTypes[type] ?? spaced(type),
  doneLabel: (what) => `Hecho: ${what ?? "este paso"}`,
  done: "Hecho",
  addANextStep: "Agregar un próximo paso",
  nextStepPlaceholder: "Volver a llamar por el presupuesto",
  whenItIsDue: "Para cuándo es",
  add: "Agregar",
  aBooking: "una reserva",
  aTimeNotRecorded: "una hora no registrada",
  booked: (service, time) => `Se reservó ${service} para el ${time}`,
  moved: (service, from, to) => `Se movió ${service} del ${from} al ${to}`,
  cancelledBooking: (service) => `Se canceló ${service}`,
  emailLines: {
    booking_confirmation: "Se envió la confirmación de la reserva por correo",
    booking_notification: "Se avisó al negocio de la reserva por correo",
    booking_person_notification: "Se avisó a la persona asignada de la reserva por correo",
    booking_cancellation: "Se envió la cancelación por correo",
    booking_cancellation_notification: "Se avisó al negocio de la cancelación por correo",
    booking_move: "Se envió el nuevo horario por correo",
    booking_move_notification: "Se avisó al negocio del nuevo horario por correo",
  },
  sentAnEmail: "Se envió un correo",
  textLines: {
    booking_confirmation: "Se envió la confirmación por mensaje de texto",
    worker_added: "Se avisó al trabajador de la reserva por mensaje de texto",
    worker_moved: "Se avisó al trabajador del nuevo horario por mensaje de texto",
    worker_removed: "Se avisó al trabajador de la cancelación por mensaje de texto",
  },
  textedAReminder: (minutesBefore) =>
    `Se envió un recordatorio por mensaje de texto ${lengthIn(minutesBefore, ["día", "días", "hora", "horas", "minuto", "minutos"])} antes`,
  sentAText: "Se envió un mensaje de texto",
  otherLines: {
    later_texts_yes: "Aceptó recibir mensajes de texto",
    lead_added: "Agregado a mano",
    stage_changed: "Cambió de etapa",
    email_received: "Correo recibido",
    note: "Nota",
    call: "Llamada",
    task: "Tarea",
  },
  byActor: (name) => ` por ${name}`,
};
