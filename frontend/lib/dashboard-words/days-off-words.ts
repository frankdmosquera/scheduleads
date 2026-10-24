// Frontend: the words of Settings, Days off: closed days, holidays, one-off dates (feature 12j), in
// English and Spanish ("usted"). One type, one object per language, so a word left out of either is
// a type error. Holiday, country and province names come from the holiday list, as it gives them.

export type DaysOffWordsType = {
  setHoursFirst: string;
  cannotChange: string;
  // The list of closed days; `day` is the day written out, "Monday, November 2, 2026"
  openForEveryone: string;
  openFor(names: string): string;
  closed: string;
  closedTheDay(day: string, stayingCount: number): string;
  closeADayButton: string;
  noClosedDays: string;
  openedTheDay(day: string, forWhom: string): string;
  openDayAgain(day: string): string;
  openAgain: string;
  // Closing a day
  closeADay: string;
  closeLede: string;
  date: string;
  pickADate: string;
  pickTodayOrLater: string;
  pickWithinAYear: string;
  alreadyClosed: string;
  closing: string;
  closeTheDay: string;
  cancel: string;
  // Opening a day again
  everyone: string;
  everyoneInASentence: string;
  pickWhoItOpensFor: string;
  openItFor: string;
  opening: string;
  openTheDay: string;
  // The bookings on a day just closed
  bookingsOnTheDayYouClosed: string;
  stillBookedKeepOrCancel: string;
  cancelAll: string;
  cancelAllQuestion(count: number, notToldCount: number): string;
  cancelBookingOf(name: string): string;
  cancelBookingQuestion(name: string): string;
  getsTheCancellationEmail(name: string): string;
  leftNoEmail(name: string): string;
  cancelTheBooking: string;
  cancelling: string;
  keep: string;
  cancelledCount(count: number): string;
  alreadyStarted(name: string): string;
  // Holidays
  holidays: string;
  holidaysLede: string;
  country: string;
  noHolidays: string;
  countryNoLongerOffered(code: string): string;
  provinceOrState: string;
  countrysHolidaysOnly: string;
  provinceNoLongerListed(code: string): string;
  tryAgain: string;
  noLongerInTheList: string;
  pickedBeforeUntick: string;
  pickedNotThisYear: string;
  closeInTheYearsTheyFall: string;
  statutoryHolidays: string;
  closeThemAll: string;
  savedTheHolidays(stayingCount: number): string;
  saving: string;
  saveHolidays: string;
  and: string; // between a holiday's two dates
};

export const englishDaysOffWords: DaysOffWordsType = {
  setHoursFirst:
    "Set the business's hours on Hours first: a day is closed on the business's clock.",
  cannotChange: "Your role cannot change the days off. You can see them here.",
  openForEveryone: "Open for everyone",
  openFor: (names) => `Open for ${names}`,
  closed: "Closed",
  closedTheDay: (day, count) =>
    `Closed ${day}.${
      count ? ` ${count === 1 ? "One booking stays" : `${count} bookings stay`}, listed below.` : ""
    }`,
  closeADayButton: "+ Close a day",
  noClosedDays: "No closed days in the coming year.",
  openedTheDay: (day, forWhom) => `Opened ${day} for ${forWhom}, on their usual hours.`,
  openDayAgain: (day) => `Open ${day} again`,
  openAgain: "Open again",
  closeADay: "Close a day",
  closeLede:
    "Nobody can book online that day. Bookings already made stay, and are listed for you. The business's one-off hours for that date on Hours, if any, are removed.",
  date: "Date",
  pickADate: "Pick a date.",
  pickTodayOrLater: "Pick today or a later date.",
  pickWithinAYear: "Pick a date within a year.",
  alreadyClosed: "That day is already closed.",
  closing: "Closing…",
  closeTheDay: "Close the day",
  cancel: "Cancel",
  everyone: "Everyone",
  everyoneInASentence: "everyone",
  pickWhoItOpensFor: "Pick who it opens for.",
  openItFor: "Open it for, on their usual hours for that weekday",
  opening: "Opening…",
  openTheDay: "Open the day",
  bookingsOnTheDayYouClosed: "Bookings on the day you closed",
  stillBookedKeepOrCancel:
    "Still booked. Keep them, or cancel them: a customer who left an email is told.",
  cancelAll: "Cancel all",
  cancelAllQuestion: (count, notTold) =>
    `Cancel all ${count} bookings? Each customer with an email gets the cancellation email.${
      notTold
        ? ` ${notTold === 1 ? "One left" : `${notTold} left`} no email and ${notTold === 1 ? "is" : "are"} not told.`
        : ""
    }`,
  cancelBookingOf: (name) => `Cancel ${name}'s booking`,
  cancelBookingQuestion: (name) => `Cancel ${name}'s booking?`,
  getsTheCancellationEmail: (name) => `${name} gets the cancellation email.`,
  leftNoEmail: (name) => `${name} left no email, so is not told: call them from their lead.`,
  cancelTheBooking: "Cancel the booking",
  cancelling: "Cancelling…",
  keep: "Keep",
  cancelledCount: (count) => `Cancelled ${count === 1 ? "one booking" : `${count} bookings`}.`,
  alreadyStarted: (name) => `${name}'s booking has already started, so it was not cancelled.`,
  holidays: "Holidays",
  holidaysLede:
    "The statutory holidays where the business is. Ticked ones are closed for online booking every year, until unticked; close any other day by hand.",
  country: "Country",
  noHolidays: "No holidays",
  countryNoLongerOffered: (code) => `${code}, no longer offered`,
  provinceOrState: "Province or state",
  countrysHolidaysOnly: "Country's holidays only",
  provinceNoLongerListed: (code) => `${code}, no longer in the list`,
  tryAgain: "Try again",
  noLongerInTheList: "No longer in the holiday list",
  pickedBeforeUntick: "Picked before, these close nothing now. Untick them to save.",
  pickedNotThisYear: "Picked, not in the coming year",
  closeInTheYearsTheyFall: "These close their day in the years they fall.",
  statutoryHolidays: "Statutory holidays",
  closeThemAll: "Close them all",
  savedTheHolidays: (count) =>
    `Saved the holidays.${
      count
        ? ` ${count === 1 ? "One booking stays" : `${count} bookings stay`} on a closed day, listed at the top.`
        : ""
    }`,
  saving: "Saving…",
  saveHolidays: "Save holidays",
  and: " and ",
};

export const spanishDaysOffWords: DaysOffWordsType = {
  setHoursFirst:
    "Primero fije el horario del negocio en Horario: un día se cierra según el reloj del negocio.",
  cannotChange: "Su rol no puede cambiar los días libres. Puede verlos aquí.",
  openForEveryone: "Abierto para todos",
  openFor: (names) => `Abierto para ${names}`,
  closed: "Cerrado",
  closedTheDay: (day, count) =>
    `Se cerró el ${day}.${
      count
        ? ` ${count === 1 ? "Una reserva se mantiene" : `${count} reservas se mantienen`}; se muestran abajo.`
        : ""
    }`,
  closeADayButton: "+ Cerrar un día",
  noClosedDays: "No hay días cerrados en el próximo año.",
  openedTheDay: (day, forWhom) => `Se abrió el ${day} para ${forWhom}, con su horario de siempre.`,
  openDayAgain: (day) => `Abrir de nuevo el ${day}`,
  openAgain: "Abrir de nuevo",
  closeADay: "Cerrar un día",
  closeLede:
    "Nadie puede reservar en línea ese día. Las reservas ya hechas se mantienen y se le muestran. Si el negocio tenía un horario especial para esa fecha en Horario, se quita.",
  date: "Fecha",
  pickADate: "Elija una fecha.",
  pickTodayOrLater: "Elija hoy o una fecha posterior.",
  pickWithinAYear: "Elija una fecha dentro de un año.",
  alreadyClosed: "Ese día ya está cerrado.",
  closing: "Cerrando…",
  closeTheDay: "Cerrar el día",
  cancel: "Cancelar",
  everyone: "Todos",
  everyoneInASentence: "todos",
  pickWhoItOpensFor: "Elija para quién se abre.",
  openItFor: "Para quién se abre, con su horario de siempre de ese día de la semana",
  opening: "Abriendo…",
  openTheDay: "Abrir el día",
  bookingsOnTheDayYouClosed: "Reservas en el día que cerró",
  stillBookedKeepOrCancel:
    "Siguen reservadas. Puede mantenerlas o cancelarlas: se avisa al cliente que dejó un correo.",
  cancelAll: "Cancelar todas",
  cancelAllQuestion: (count, notTold) =>
    `¿Cancelar las ${count} reservas? Cada cliente con correo recibe el correo de cancelación.${
      notTold
        ? ` ${
            notTold === 1
              ? "Uno no dejó correo y no recibe aviso."
              : `${notTold} no dejaron correo y no reciben aviso.`
          }`
        : ""
    }`,
  cancelBookingOf: (name) => `Cancelar la reserva de ${name}`,
  cancelBookingQuestion: (name) => `¿Cancelar la reserva de ${name}?`,
  getsTheCancellationEmail: (name) => `${name} recibe el correo de cancelación.`,
  leftNoEmail: (name) =>
    `${name} no dejó correo, así que no recibe aviso: llámele desde su prospecto.`,
  cancelTheBooking: "Cancelar la reserva",
  cancelling: "Cancelando…",
  keep: "Mantener",
  cancelledCount: (count) =>
    count === 1 ? "Se canceló una reserva." : `Se cancelaron ${count} reservas.`,
  alreadyStarted: (name) => `La reserva de ${name} ya empezó, así que no se canceló.`,
  holidays: "Días festivos",
  holidaysLede:
    "Los días festivos oficiales donde está el negocio. Los marcados se cierran a las reservas en línea cada año, hasta que los desmarque; cierre cualquier otro día a mano.",
  country: "País",
  noHolidays: "Sin días festivos",
  countryNoLongerOffered: (code) => `${code}, ya no se ofrece`,
  provinceOrState: "Provincia o estado",
  countrysHolidaysOnly: "Solo los festivos del país",
  provinceNoLongerListed: (code) => `${code}, ya no está en la lista`,
  tryAgain: "Intentar de nuevo",
  noLongerInTheList: "Ya no están en la lista de festivos",
  pickedBeforeUntick: "Marcados antes, ya no cierran nada. Desmárquelos para guardar.",
  pickedNotThisYear: "Marcados, no caen en el próximo año",
  closeInTheYearsTheyFall: "Estos cierran su día en los años en que caen.",
  statutoryHolidays: "Festivos oficiales",
  closeThemAll: "Cerrarlos todos",
  savedTheHolidays: (count) =>
    `Festivos guardados.${
      count
        ? ` ${count === 1 ? "Una reserva se mantiene" : `${count} reservas se mantienen`} en un día cerrado; se muestran arriba.`
        : ""
    }`,
  saving: "Guardando…",
  saveHolidays: "Guardar festivos",
  and: " y ",
};
