// Frontend: the words of Settings, Services: the list and the service form (feature 12j), in
// English and Spanish ("usted").
// One type, one object per language, so a word left out of either is a type error.

export type ServicesWordsType = {
  // The list
  cannotChange: string;
  addAService: string;
  noLongerFit(count: number): string; // follows a saved message, with its own leading space
  savedButTicksNot(service: string): string;
  savedLive(service: string): string;
  savedHidden(service: string): string;
  heldTitle(service: string): string;
  noServicesYet: string;
  minutes(count: number): string;
  live: string;
  hidden: string;
  changeService(service: string): string; // the change button's label, and the form's title
  // The form
  addTitle: string;
  name: string;
  descriptionOptional: string;
  lengthInMinutes: string;
  freeBefore: string;
  freeBeforeHint: string;
  freeAfter: string;
  freeAfterHint: string;
  startTimes: string;
  oneAfterAnother: string;
  every: string;
  everyHowManyMinutes: string;
  minutesWord: string;
  whoPicksThePerson: string;
  customerPicks: string;
  weSendWhoeverIsFree: string;
  whoDoesIt: string;
  runsWhenOpen: string;
  runsOwnWeek: string;
  runsOwnWeekDays(days: string): string; // the days it runs, as "Mon, Tue"
  whenItRuns(name: string): string;
  itsOneOffDates(name: string): string;
  saveWhenItRuns(name: string): string;
  savedWhenItRuns(name: string, outsideCount: number): string;
  outsideItsHours: string;
  whoDoesItNote: string;
  nobodyCanDoIt: string;
  offeringIt: string;
  notOfferingIt: string;
  nobodyTicked: string;
  everyoneTickedOff: string;
  placesItNeeds: string;
  noPlaceTicked: string;
  everyPlaceTickedOff: string;
  noPlacesYet: string;
  customersAddress: string;
  addressRequired: string;
  addressOptional: string;
  addressNotAsked: string;
  liveCheckbox: string;
  ticksNotSaved(service: string, reason: string): string; // the reason is the API's message
  saveService: string;
  addService: string;
};

export const englishServicesWords: ServicesWordsType = {
  cannotChange: "Your role cannot change the services. You can see them here.",
  addAService: "+ Add a service",
  noLongerFit: (count) =>
    ` ${count === 1 ? "One booking no longer fits" : `${count} bookings no longer fit`} at the new length; still booked, listed below.`,
  savedButTicksNot: (service) => `Saved, but who does ${service} was not.`,
  savedLive: (service) => `Saved. Customers can book ${service} now.`,
  savedHidden: (service) => `Saved. ${service} is hidden; bookings already made stay.`,
  heldTitle: (service) => `${service}: bookings that no longer fit`,
  noServicesYet: "No services yet.",
  minutes: (count) => `${count} min`,
  live: "Live",
  hidden: "Hidden",
  changeService: (service) => `Change ${service}`,
  addTitle: "Add a service",
  name: "Name",
  descriptionOptional: "Description (optional)",
  lengthInMinutes: "Length, in minutes",
  freeBefore: "Free time before",
  freeBeforeHint: "Kept clear, never booked; 0 for none.",
  freeAfter: "Free time after",
  freeAfterHint: "Travel or clean-up; 0 for none.",
  startTimes: "Start times",
  oneAfterAnother: "One after another, every service length",
  every: "Every",
  everyHowManyMinutes: "Start times every how many minutes",
  minutesWord: "minutes",
  whoPicksThePerson: "Who picks the person",
  customerPicks: "The customer picks who does it",
  weSendWhoeverIsFree: "We send whoever is free",
  whoDoesIt: "Who does it",
  runsWhenOpen: "Runs whenever the business is open",
  runsOwnWeek: "Runs on its own week",
  runsOwnWeekDays: (days) => `Runs on its own week · ${days}`,
  whenItRuns: (name) => `When ${name} runs`,
  itsOneOffDates: (name) => `Days that are different for ${name}`,
  saveWhenItRuns: (name) => `Save when ${name} runs`,
  savedWhenItRuns: (name, count) =>
    `Saved. ${name} runs on these hours now.${
      count
        ? ` ${count === 1 ? "One booking now sits" : `${count} bookings now sit`} outside them, listed below.`
        : ""
    }`,
  outsideItsHours: "These bookings now sit outside its hours",
  whoDoesItNote: "Only the people who can do it are listed. Ticked: offering it now.",
  nobodyCanDoIt: "Nobody can do this service yet.",
  offeringIt: "On",
  notOfferingIt: "Off",
  nobodyTicked: "Nobody is on: customers cannot book it.",
  everyoneTickedOff: "Everyone ticked is off, so nobody is offered for it.",
  placesItNeeds: "Places it needs",
  noPlaceTicked: "No place ticked: no room needed.",
  everyPlaceTickedOff: "Every place ticked is off, so it cannot be booked.",
  noPlacesYet: "No places yet.",
  customersAddress: "The customer's address",
  addressRequired: "Asked and required: we go to them",
  addressOptional: "Asked, optional",
  addressNotAsked: "Not asked",
  liveCheckbox: "Live: customers can book it. Off hides it; bookings already made stay.",
  ticksNotSaved: (service, reason) => `${service} is saved, but who does it is not: ${reason}`,
  saveService: "Save service",
  addService: "Add service",
};

export const spanishServicesWords: ServicesWordsType = {
  cannotChange: "Su rol no puede cambiar los servicios. Puede verlos aquí.",
  addAService: "+ Agregar un servicio",
  noLongerFit: (count) =>
    ` ${count === 1 ? "Una reserva ya no cabe" : `${count} reservas ya no caben`} con la nueva duración; siguen reservadas, en la lista de abajo.`,
  savedButTicksNot: (service) => `Guardado, pero no se guardó quién hace ${service}.`,
  savedLive: (service) => `Guardado. Los clientes ya pueden reservar ${service}.`,
  savedHidden: (service) =>
    `Guardado. ${service} está oculto; las reservas ya hechas se mantienen.`,
  heldTitle: (service) => `${service}: reservas que ya no caben`,
  noServicesYet: "Todavía no hay servicios.",
  minutes: (count) => `${count} min`,
  live: "Activo",
  hidden: "Oculto",
  changeService: (service) => `Cambiar ${service}`,
  addTitle: "Agregar un servicio",
  name: "Nombre",
  descriptionOptional: "Descripción (opcional)",
  lengthInMinutes: "Duración, en minutos",
  freeBefore: "Tiempo libre antes",
  freeBeforeHint: "Se deja libre, nunca se reserva; 0 si no hace falta.",
  freeAfter: "Tiempo libre después",
  freeAfterHint: "Para traslado o limpieza; 0 si no hace falta.",
  startTimes: "Horas de inicio",
  oneAfterAnother: "Una tras otra, cada una al terminar el servicio",
  every: "Cada",
  everyHowManyMinutes: "Horas de inicio cada cuántos minutos",
  minutesWord: "minutos",
  whoPicksThePerson: "Quién elige a la persona",
  customerPicks: "El cliente elige quién lo hace",
  weSendWhoeverIsFree: "Enviamos a quien esté libre",
  whoDoesIt: "Quién lo hace",
  runsWhenOpen: "Se ofrece siempre que el negocio está abierto",
  runsOwnWeek: "Se ofrece en su propia semana",
  runsOwnWeekDays: (days) => `Se ofrece en su propia semana · ${days}`,
  whenItRuns: (name) => `Cuándo se ofrece ${name}`,
  itsOneOffDates: (name) => `Días distintos para ${name}`,
  saveWhenItRuns: (name) => `Guardar cuándo se ofrece ${name}`,
  savedWhenItRuns: (name, count) =>
    `Guardado. ${name} se ofrece en este horario ahora.${
      count
        ? ` ${count === 1 ? "Una reserva queda" : `${count} reservas quedan`} fuera de él, en la lista de abajo.`
        : ""
    }`,
  outsideItsHours: "Estas reservas quedan ahora fuera de su horario",
  whoDoesItNote: "Solo aparece quien sabe hacerlo. Marcado: lo ofrece ahora.",
  nobodyCanDoIt: "Nadie sabe hacer este servicio todavía.",
  offeringIt: "Activo",
  notOfferingIt: "Inactivo",
  nobodyTicked: "Nadie lo ofrece: los clientes no pueden reservarlo.",
  everyoneTickedOff: "Todos los marcados están fuera de servicio, así que no se ofrece a nadie.",
  placesItNeeds: "Lugares que necesita",
  noPlaceTicked: "Ningún lugar marcado: no necesita sala.",
  everyPlaceTickedOff:
    "Todos los lugares marcados están fuera de servicio, así que no se puede reservar.",
  noPlacesYet: "Todavía no hay lugares.",
  customersAddress: "La dirección del cliente",
  addressRequired: "Se pide y es obligatoria: vamos a donde está el cliente",
  addressOptional: "Se pide, opcional",
  addressNotAsked: "No se pide",
  liveCheckbox:
    "Activo: los clientes pueden reservarlo. Oculto, no aparece; las reservas ya hechas se mantienen.",
  ticksNotSaved: (service, reason) => `${service} está guardado, pero no quién lo hace: ${reason}`,
  saveService: "Guardar servicio",
  addService: "Agregar servicio",
};
