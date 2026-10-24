// Frontend: the words of Settings, People: the people and places, adding and changing one, their
// texts (feature 12j), in English and Spanish ("usted"). One type, one object per language, so a
// word left out of either is a type error. A person's or place's name is shown as typed.

export type PeopleWordsType = {
  cannotChange: string;
  addButton: string;
  savedOn(name: string): string;
  savedOff(name: string, stayingCount: number): string;
  upcomingBookingsOf(name: string): string;
  person: string;
  place: string;
  on: string;
  off: string;
  getsTexts: string;
  changeOf(name: string): string;
  change: string;
  cancel: string;
  name: string;
  // Adding one
  addTitle: string;
  personOrPlace: string;
  personChoice: string;
  placeChoice: string;
  adding: string;
  add: string;
  // Changing one
  changeTitle(name: string, kind: "person" | "place"): string;
  workEmail: string;
  workEmailHint(domain: string): string;
  noSendingAddress: string;
  onOffLine: string;
  saving: string;
  save: string;
  // A person's texts
  textsTo(name: string): string;
  noTextingNumber: string;
  texts: string;
  textsOff: string;
  textsOn: string;
  theirPhone: string;
  enterTheirPhone: string;
  addedToTheirDay: string;
  theirBookingMoves: string;
  takenOffTheirDay: string;
  textThem: string;
  no: string;
  pickYesOrNo: string;
  everyChoiceIsNo: string;
};

export const englishPeopleWords: PeopleWordsType = {
  cannotChange: "Your role cannot change the people and places. You can see them here.",
  addButton: "+ Add a person or a place",
  savedOn: (name) => `Saved. ${name} is on.`,
  savedOff: (name, count) =>
    `Saved. ${name} is off: no new bookings.${
      count ? ` ${count === 1 ? "One booking stays" : `${count} bookings stay`}, listed below.` : ""
    }`,
  upcomingBookingsOf: (name) => `${name}'s upcoming bookings`,
  person: "Person",
  place: "Place",
  on: "On",
  off: "Off",
  getsTexts: "Gets texts",
  changeOf: (name) => `Change ${name}`,
  change: "Change",
  cancel: "Cancel",
  name: "Name",
  addTitle: "Add a person or a place",
  personOrPlace: "A person or a place",
  personChoice: "A person, who can be booked",
  placeChoice: "A place, a room or a chair a service needs",
  adding: "Adding…",
  add: "Add",
  changeTitle: (name, kind) => `Change ${name}, a ${kind}`,
  workEmail: "Work email (optional)",
  workEmailHint: (domain) =>
    `At ${domain}. Customers' replies reach them, and they get their own email for each new booking.`,
  noSendingAddress: "The business has no sending address yet, so no work email can be saved.",
  onOffLine: "On: can be booked. Off stops new bookings; the ones already made stay.",
  saving: "Saving…",
  save: "Save",
  textsTo: (name) => `Texts to ${name} about their day`,
  noTextingNumber:
    "The business has no texting number yet, so no texts go until the agency sets one up.",
  texts: "Texts",
  textsOff: "Off",
  textsOn: "On",
  theirPhone: "Their phone",
  enterTheirPhone: "Enter their phone.",
  addedToTheirDay: "A booking is added to their day",
  theirBookingMoves: "Their booking moves to a new time",
  takenOffTheirDay: "A booking is taken off their day",
  textThem: "Text them",
  no: "No",
  pickYesOrNo: "Pick yes or no.",
  everyChoiceIsNo: "Every choice is No, so no texts go.",
};

// Gender-free on purpose: a name may be anyone's, and a place may be "la sala" or "el sillón".
export const spanishPeopleWords: PeopleWordsType = {
  cannotChange: "Su rol no puede cambiar las personas y los lugares. Puede verlos aquí.",
  addButton: "+ Agregar una persona o un lugar",
  savedOn: (name) => `Guardado. ${name} está en servicio.`,
  savedOff: (name, count) =>
    `Guardado. ${name} está fuera de servicio: no hay reservas nuevas.${
      count
        ? ` ${count === 1 ? "Una reserva se mantiene" : `${count} reservas se mantienen`}; se muestran abajo.`
        : ""
    }`,
  upcomingBookingsOf: (name) => `Próximas reservas de ${name}`,
  person: "Persona",
  place: "Lugar",
  on: "En servicio",
  off: "Fuera de servicio",
  getsTexts: "Recibe mensajes",
  changeOf: (name) => `Cambiar ${name}`,
  change: "Cambiar",
  cancel: "Cancelar",
  name: "Nombre",
  addTitle: "Agregar una persona o un lugar",
  personOrPlace: "Una persona o un lugar",
  personChoice: "Una persona, con quien se puede reservar",
  placeChoice: "Un lugar: una sala o una silla que un servicio necesita",
  adding: "Agregando…",
  add: "Agregar",
  changeTitle: (name, kind) => `Cambiar ${name}, ${kind === "person" ? "una persona" : "un lugar"}`,
  workEmail: "Correo de trabajo (opcional)",
  workEmailHint: (domain) =>
    `En ${domain}. Le llegan las respuestas de los clientes y recibe su propio correo por cada reserva nueva.`,
  noSendingAddress:
    "El negocio todavía no tiene una dirección de envío, así que no se puede guardar un correo de trabajo.",
  onOffLine:
    "En servicio: se puede reservar. Fuera de servicio, no hay reservas nuevas; las ya hechas se mantienen.",
  saving: "Guardando…",
  save: "Guardar",
  textsTo: (name) => `Mensajes de texto a ${name} sobre su día`,
  noTextingNumber:
    "El negocio todavía no tiene un número para mensajes de texto, así que no se envía ninguno hasta que la agencia lo configure.",
  texts: "Mensajes de texto",
  textsOff: "Desactivados",
  textsOn: "Activados",
  theirPhone: "Su teléfono",
  enterTheirPhone: "Escriba su teléfono.",
  addedToTheirDay: "Se agrega una reserva a su día",
  theirBookingMoves: "Su reserva cambia a otra hora",
  takenOffTheirDay: "Se quita una reserva de su día",
  textThem: "Enviarle un mensaje",
  no: "No",
  pickYesOrNo: "Elija sí o no.",
  everyChoiceIsNo: "Todas las opciones están en No, así que no se envía ningún mensaje.",
};
