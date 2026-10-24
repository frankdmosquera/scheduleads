// Frontend: the words of the Calendar screen: the week, booking by hand, time off (feature 12j), in
// English and Spanish ("usted"). One type, one object per language, so a word left out of either is
// a type error. A date or time inside a sentence comes already written in the language.

export type ScheduleWordsType = {
  // The week
  lede: string;
  loading: string;
  calendarOf: string;
  placeSuffix: string; // after a place's name in the picker, with its leading space
  previousWeek: string;
  thisWeek: string;
  nextWeek: string;
  weekOf(day: string, timezone: string): string;
  googleUnreadable: string;
  midnight: string;
  closed: string;
  onStandby: string;
  noBookableHours: string;
  timeOff: string;
  busyInGoogle: string;
  removing: string;
  remove: string;
  // Booking by hand
  pickATime: string;
  bookedCustomerHears: string;
  bookedCustomerHearsNothing: string;
  loadingServices: string;
  noLiveService: string;
  bookByHand: string;
  bookByHandLede: string;
  service: string;
  minutesLong(minutes: number): string; // after a service's name, in brackets
  day: string;
  time: string;
  customersName: string;
  phoneOptional: string;
  emailOptional: string;
  addressOptional: string;
  noteOptional: string;
  booking: string;
  book: string;
  // Time off
  chooseMoveOrCancel: string;
  pickTheNewTime: string;
  savedCustomersHear: string;
  savedTimeOffIn: string;
  timeOffLede: string;
  from: string;
  at: string;
  to: string;
  bookingsInThatTime: string;
  alreadyBegun: string;
  moveIt: string;
  cancelIt: string;
  newDay: string;
  newTime: string;
  whoDoesIt: string;
  saving: string;
  saveTimeOff: string;
};

export const englishScheduleWords: ScheduleWordsType = {
  lede: "Each person's and place's week: bookings, time off and their Google busy times, over the hours customers can book.",
  loading: "Loading…",
  calendarOf: "Calendar of",
  placeSuffix: " (place)",
  previousWeek: "Previous week",
  thisWeek: "This week",
  nextWeek: "Next week",
  weekOf: (day, timezone) => `Week of ${day} · times in ${timezone}`,
  googleUnreadable:
    "Google could not be read for this week, so its busy times are missing below. Everything else is shown.",
  midnight: "midnight",
  closed: "Closed",
  onStandby: "On standby: not offered to customers",
  noBookableHours: "No bookable hours",
  timeOff: "Time off",
  busyInGoogle: "Busy in Google",
  removing: "Removing…",
  remove: "Remove",
  pickATime: "Pick a time.",
  bookedCustomerHears: "Booked. The customer hears as your settings say.",
  bookedCustomerHearsNothing: "Booked. With no phone or email, the customer hears nothing from us.",
  loadingServices: "Loading services…",
  noLiveService: "This person does no live service yet.",
  bookByHand: "Book by hand",
  bookByHandLede:
    "A phone estimate or a walk-in. Any time this person is free, inside their hours or not.",
  service: "Service",
  minutesLong: (minutes) => `${minutes} min`,
  day: "Day",
  time: "Time",
  customersName: "Customer's name",
  phoneOptional: "Phone (optional)",
  emailOptional: "Email (optional)",
  addressOptional: "Address (optional)",
  noteOptional: "Note (optional)",
  booking: "Booking…",
  book: "Book",
  chooseMoveOrCancel: "Choose move or cancel.",
  pickTheNewTime: "Pick the new time.",
  savedCustomersHear:
    "Saved. The time off is in, and each customer hears what happened to their booking.",
  savedTimeOffIn: "Saved. The time off is in.",
  timeOffLede:
    "An afternoon, a day or a week. Leave a time blank for the whole day. Bookings in that time are listed here, to move or cancel in the same save.",
  from: "From",
  at: "at",
  to: "To",
  bookingsInThatTime: "Bookings in that time",
  alreadyBegun:
    "Already begun: it can be neither moved nor cancelled. Start the time off after it.",
  moveIt: "Move it",
  cancelIt: "Cancel it",
  newDay: "New day",
  newTime: "New time",
  whoDoesIt: "Who does it",
  saving: "Saving…",
  saveTimeOff: "Save time off",
};

export const spanishScheduleWords: ScheduleWordsType = {
  lede: "La semana de cada persona y de cada lugar: reservas, tiempo libre y sus horas ocupadas en Google, sobre las horas en que los clientes pueden reservar.",
  loading: "Cargando…",
  calendarOf: "Calendario de",
  placeSuffix: " (lugar)",
  previousWeek: "Semana anterior",
  thisWeek: "Esta semana",
  nextWeek: "Semana siguiente",
  weekOf: (day, timezone) => `Semana del ${day} · horas en ${timezone}`,
  googleUnreadable:
    "No se pudo leer Google para esta semana, así que abajo faltan sus horas ocupadas. Todo lo demás se muestra.",
  midnight: "medianoche",
  closed: "Cerrado",
  onStandby: "En espera: no se ofrece a los clientes",
  noBookableHours: "Sin horas para reservar",
  timeOff: "Tiempo libre",
  busyInGoogle: "Ocupado en Google",
  removing: "Quitando…",
  remove: "Quitar",
  pickATime: "Elija una hora.",
  bookedCustomerHears: "Reservado. El cliente recibe aviso según sus ajustes.",
  bookedCustomerHearsNothing:
    "Reservado. Sin teléfono ni correo, el cliente no recibe nada de nosotros.",
  loadingServices: "Cargando servicios…",
  noLiveService: "Esta persona todavía no hace ningún servicio activo.",
  bookByHand: "Reservar a mano",
  bookByHandLede:
    "Un presupuesto por teléfono o alguien que llega sin cita. Cualquier hora en que esta persona esté libre, dentro de su horario o no.",
  service: "Servicio",
  minutesLong: (minutes) => `${minutes} min`,
  day: "Día",
  time: "Hora",
  customersName: "Nombre del cliente",
  phoneOptional: "Teléfono (opcional)",
  emailOptional: "Correo (opcional)",
  addressOptional: "Dirección (opcional)",
  noteOptional: "Nota (opcional)",
  booking: "Reservando…",
  book: "Reservar",
  chooseMoveOrCancel: "Elija mover o cancelar.",
  pickTheNewTime: "Elija la nueva hora.",
  savedCustomersHear:
    "Guardado. El tiempo libre quedó registrado, y cada cliente recibe aviso de lo que pasó con su reserva.",
  savedTimeOffIn: "Guardado. El tiempo libre quedó registrado.",
  timeOffLede:
    "Una tarde, un día o una semana. Deje la hora en blanco para el día completo. Las reservas en ese tiempo aparecen aquí, para moverlas o cancelarlas al guardar.",
  from: "Desde",
  at: "a las",
  to: "Hasta",
  bookingsInThatTime: "Reservas en ese tiempo",
  alreadyBegun:
    "Ya comenzó: no se puede mover ni cancelar. Empiece el tiempo libre después de esta reserva.",
  moveIt: "Moverla",
  cancelIt: "Cancelarla",
  newDay: "Nuevo día",
  newTime: "Nueva hora",
  whoDoesIt: "Quién la hace",
  saving: "Guardando…",
  saveTimeOff: "Guardar tiempo libre",
};
