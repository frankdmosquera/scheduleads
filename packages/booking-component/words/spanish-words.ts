// Booking component: the window's words in Spanish, in "usted", as ialaorden.com is written.

import type { BookingWordsType } from "./booking-words-type.js";

// The shared rules' English messages a customer can meet on the form, in Spanish. A message not
// here gets the general line, so the window never shows English inside Spanish.
const formErrors: Record<string, string> = {
  "Enter a name.": "Escriba su nombre.",
  "That name is too long.": "El nombre es demasiado largo.",
  "Enter a valid email address.": "Escriba un correo electrónico válido.",
  "Enter an email.": "Escriba un correo electrónico.",
  "Enter a phone number.": "Escriba un número de teléfono.",
  "That phone number is too long.": "El número de teléfono es demasiado largo.",
  "Enter an email or a phone number. At least one is required.":
    "Escriba un correo electrónico o un teléfono. Se requiere al menos uno.",
  "Enter a phone that can get texts.": "Escriba un teléfono que pueda recibir mensajes de texto.",
  "Enter the address.": "Escriba la dirección.",
  "That address is too long.": "La dirección es demasiado larga.",
  "Keep it to 2000 characters.": "Use como máximo 2000 caracteres.",
  "Answer this question.": "Responda esta pregunta.",
  "Keep each answer to 500 characters.": "Use como máximo 500 caracteres por respuesta.",
  "That is too many answers.": "Hay demasiadas respuestas.",
};
const generalFormError = "Revise este dato.";

export const spanishWords: BookingWordsType = {
  language: "es",
  close: "Cerrar",
  bookOnline: "Reserve en línea",
  bookWith: (businessName) => `Reserve con ${businessName}`,
  loading: "Cargando…",
  chooseService: "Elija qué desea reservar.",
  minutes: (count) => `${count} min`,
  tryAgain: "Intentar de nuevo",
  call: (phone) => `Llamar al ${phone}`,
  problems: {
    "nothing-to-book": "En este momento no se puede reservar en línea.",
    "cannot-load": "La reserva no pudo cargar en este momento.",
    "too-many-tries": "Demasiados intentos. Espere unos minutos.",
  },
  backToServices: "Volver a los servicios",
  backToTimes: "Volver a los horarios",
  pickDateAndTime: "Elija fecha y hora",
  previousMonth: "Mes anterior",
  nextMonth: "Mes siguiente",
  weekdays: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
  timesIn: (zoneName) => `Horarios en ${zoneName}`,
  findingTimes: "Buscando horarios…",
  noTimesLeftIn: (monthName) => `No quedan horarios en ${monthName}.`,
  next: "Siguiente",
  nextAt: (dayName, time) => `Siguiente: ${dayName} a las ${time}`,
  whoWouldYouLike: "¿Con quién desea su cita?",
  anyAvailable: "Cualquiera disponible",
  yourDetails: "Sus datos",
  withPerson: (personName) => `Con ${personName}`,
  nameLabel: "Nombre",
  emailLabel: "Correo electrónico",
  phoneLabel: "Teléfono",
  addressLabel: "Dirección",
  detailsLabel: "¿Qué necesita?",
  eitherHint: "Un correo electrónico o un teléfono. Se requiere al menos uno.",
  book: "Reservar",
  booking: "Reservando…",
  checkingBooking: "Verificando su reserva…",
  noAnswer:
    "No recibimos respuesta sobre su reserva. Puede que se haya hecho: presione Intentar de nuevo para saberlo. Nunca se reserva dos veces.",
  tooManyWhileUnsure:
    "Demasiados intentos. Espere unos minutos y presione Intentar de nuevo para saber si su reserva se hizo. Nunca se reserva dos veces.",
  timeTaken: "Lo sentimos, ese horario se ocupó mientras reservaba. Por favor elija otro.",
  refused: "No se pudo hacer la reserva. Revise sus datos e intente de nuevo.",
  timesUnreadable: "No se pueden leer los horarios en este momento. Intente de nuevo en un rato.",
  youreBooked: "Su reserva está confirmada",
  confirmationOnItsWay: (email) => `Le enviamos la confirmación a ${email}.`,
  formError: (englishMessage) => formErrors[englishMessage] ?? generalFormError,
};
