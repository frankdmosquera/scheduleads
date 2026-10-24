// Frontend: the words of Settings, Texts (feature 12j), in English and Spanish ("usted").
// One type, one object per language, so a word left out of either is a type error.

export type ReminderUnitType = "day" | "hour" | "minute";

export type TextsWordsType = {
  notSetUp: string;
  title: string;
  fromNumber(number: string): string;
  cannotChange: string;
  whenCustomerBooks: string;
  yesSendIt: string;
  no: string;
  reminders: string;
  noReminders: string;
  reminderBefore(count: number, unit: ReminderUnitType): string; // "20 hours before"
  removeReminder(reminder: string): string;
  newReminderCount: string;
  newReminderUnit: string;
  minutesBefore: string;
  hoursBefore: string;
  daysBefore: string;
  addReminder: string;
  wholeNumber: string;
  tooFarAhead: string;
  alreadyThere: string;
  addOrClearFirst: string;
  passRepliesTo: string;
  phoneEmailOrBoth: string;
  phone: string;
  email: string;
  saved: string;
  saveTexts: string;
};

const spanishUnits: Record<ReminderUnitType, [string, string]> = {
  day: ["día", "días"],
  hour: ["hora", "horas"],
  minute: ["minuto", "minutos"],
};

export const englishTextsWords: TextsWordsType = {
  notSetUp:
    "Texts are not set up for your business yet. The agency adds your texting number, then you choose what goes here.",
  title: "Texts to your customers",
  fromNumber: (number) => `They go from your texting number, ${number}, which the agency set up.`,
  cannotChange: "Your role cannot change the texts. You can see them here.",
  whenCustomerBooks: "A text when a customer books",
  yesSendIt: "Yes, send it",
  no: "No",
  reminders: "Reminders before the appointment",
  noReminders: "No reminders.",
  reminderBefore: (count, unit) => `${count} ${unit}${count === 1 ? "" : "s"} before`,
  removeReminder: (reminder) => `Remove the reminder ${reminder}`,
  newReminderCount: "New reminder, how many",
  newReminderUnit: "New reminder, unit",
  minutesBefore: "minutes before",
  hoursBefore: "hours before",
  daysBefore: "days before",
  addReminder: "+ Add a reminder",
  wholeNumber: "Give a whole number, at least 1.",
  tooFarAhead: "That is too far ahead.",
  alreadyThere: "That reminder is already there.",
  addOrClearFirst: "Add this reminder, or clear it, before saving.",
  passRepliesTo: "When a customer answers a text, pass it on to",
  phoneEmailOrBoth: "A phone, an email, or both.",
  phone: "Phone",
  email: "Email",
  saved: "Saved the texts.",
  saveTexts: "Save texts",
};

export const spanishTextsWords: TextsWordsType = {
  notSetUp:
    "Los mensajes de texto aún no están configurados para su negocio. La agencia agrega su número para mensajes y luego usted elige lo que va aquí.",
  title: "Mensajes de texto a sus clientes",
  fromNumber: (number) => `Salen de su número para mensajes, ${number}, que configuró la agencia.`,
  cannotChange: "Su rol no puede cambiar los mensajes de texto. Puede verlos aquí.",
  whenCustomerBooks: "Un mensaje cuando un cliente reserva",
  yesSendIt: "Sí, enviarlo",
  no: "No",
  reminders: "Recordatorios antes de la cita",
  noReminders: "Sin recordatorios.",
  reminderBefore: (count, unit) => `${count} ${spanishUnits[unit][count === 1 ? 0 : 1]} antes`,
  removeReminder: (reminder) => `Quitar el recordatorio ${reminder}`,
  newReminderCount: "Nuevo recordatorio, cuántos",
  newReminderUnit: "Nuevo recordatorio, unidad",
  minutesBefore: "minutos antes",
  hoursBefore: "horas antes",
  daysBefore: "días antes",
  addReminder: "+ Agregar un recordatorio",
  wholeNumber: "Escriba un número entero, de 1 o más.",
  tooFarAhead: "Eso es demasiado tiempo antes.",
  alreadyThere: "Ese recordatorio ya está en la lista.",
  addOrClearFirst: "Agregue este recordatorio, o bórrelo, antes de guardar.",
  passRepliesTo: "Cuando un cliente responda un mensaje, reenviarlo a",
  phoneEmailOrBoth: "Un teléfono, un correo, o ambos.",
  phone: "Teléfono",
  email: "Correo",
  saved: "Se guardaron los mensajes de texto.",
  saveTexts: "Guardar mensajes de texto",
};
