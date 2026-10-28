// Shared: the Spanish for every message the API, the shared rules and the dashboard's client can send
// (feature 12j), keyed by the English exactly as the code writes it, with "{}" where the code puts a
// value. In "usted", as the dashboard's words. A message missing here shows in English, never blank;
// spanish-messages.test.ts fails on any message in the code that has no Spanish.

export const spanishMessages: Record<string, string> = {
  // A rule's check with no message of its own
  "Check the address and try again.": "Revise la dirección e inténtelo de nuevo.",
  "Check the form and try again.": "Revise el formulario e inténtelo de nuevo.",
  "Check the list and try again.": "Revise la lista e inténtelo de nuevo.",
  "Check the card and try again.": "Revise la tarjeta e inténtelo de nuevo.",
  "Check the step and try again.": "Revise el paso e inténtelo de nuevo.",
  "That is not a valid question.": "Esa no es una pregunta válida.",

  // Sign-in, the business, the plan
  "Use en or es.": "Use en o es.",
  "Too many tries. Please wait a minute and try again.":
    "Demasiados intentos. Espere un minuto e inténtelo de nuevo.",
  "Sign in to continue.": "Inicie sesión para continuar.",
  "Choose which business you are working in before continuing.":
    "Elija con qué negocio está trabajando antes de continuar.",
  "Your role in this business does not allow this.": "Su rol en este negocio no permite esto.",
  "Only the agency can do this.": "Solo la agencia puede hacer esto.",
  "This business is on a plan the product does not recognise.":
    "Este negocio está en un plan que el producto no reconoce.",
  "This organization's plan does not include {}.": "El plan de este negocio no incluye {}.",
  "Your sign-in has ended. Sign in again.": "Su sesión ha terminado. Inicie sesión de nuevo.",
  "Enter the {} digit code from your email.": "Escriba el código de {} dígitos de su correo.",
  "Enter a valid email address.": "Escriba un correo válido.",
  "Invalid OTP": "Ese código no es correcto.", // Better Auth's words, kept by the sign-in code route

  // The API and the client
  "The API is not responding. Check that it is running.":
    "La API no responde. Revise que esté en funcionamiento.",
  "The API answered with an unexpected status ({}).":
    "La API respondió con un estado inesperado ({}).",
  "This business cannot see leads.": "Este negocio no puede ver prospectos.",
  "This calendar cannot be shown.": "Este calendario no se puede mostrar.",
  "This business cannot change its booking form here.":
    "Este negocio no puede cambiar su formulario de reserva aquí.",
  "This business cannot change its days off here.":
    "Este negocio no puede cambiar sus días libres aquí.",
  "This business cannot change its hours here.": "Este negocio no puede cambiar su horario aquí.",
  "This business cannot change its people here.":
    "Este negocio no puede cambiar sus personas aquí.",
  "This business cannot change its places here.": "Este negocio no puede cambiar sus lugares aquí.",
  "This business cannot change its services here.":
    "Este negocio no puede cambiar sus servicios aquí.",
  "This business cannot change its texts here.":
    "Este negocio no puede cambiar sus mensajes de texto aquí.",

  // The agency's client setup
  "Use at least a couple of letters or numbers in the name.":
    "Use al menos un par de letras o números en el nombre.",
  "That email already has a login.": "Ese correo ya tiene una cuenta.",
  "A business with that name already exists.": "Ya existe un negocio con ese nombre.",
  "This client is already being set up. Try again in a moment.":
    "Este cliente ya se está configurando. Inténtelo de nuevo en un momento.",
  "Enter the client's name.": "Escriba el nombre del cliente.",
  "Enter the business's name.": "Escriba el nombre del negocio.",
  "Use at least a couple of letters or numbers.": "Use al menos un par de letras o números.",
  "That name is taken by the app. Add a word to it.":
    "Ese nombre lo usa la aplicación. Agréguele una palabra.",
  "Use a colour like #1d4ed8.": "Use un color como #1d4ed8.",
  "That website address is too long.": "Esa dirección web es demasiado larga.",

  // Calendar connection
  "Connect your Google calendar first.": "Primero conecte su calendario de Google.",
  "Reconnect your Google calendar. Until then none of your calendars is read, so customers cannot book you.":
    "Vuelva a conectar su calendario de Google. Mientras tanto no se lee ninguno de sus calendarios, así que los clientes no pueden reservarle.",
  "Reconnect your Google calendar to choose which calendars count. Until then only your main calendar counts.":
    "Vuelva a conectar su calendario de Google para elegir qué calendarios cuentan. Mientras tanto solo cuenta su calendario principal.",
  "Google did not answer. Nothing was changed. Try again in a minute.":
    "Google no respondió. No se cambió nada. Inténtelo de nuevo en un minuto.",
  "There is no calendar connected to disconnect.":
    "No hay ningún calendario conectado para desconectar.",
  "One of those calendars is not in your Google account.":
    "Uno de esos calendarios no está en su cuenta de Google.",
  "That is not a calendar.": "Eso no es un calendario.",
  "That is not a list of calendars.": "Eso no es una lista de calendarios.",
  "At most {} calendars.": "Como máximo {} calendarios.",
  "That calendar is there twice.": "Ese calendario está dos veces.",

  // Leads
  "That page of leads does not exist.": "Esa página de prospectos no existe.",
  "No lead here.": "No hay ningún prospecto aquí.",
  "No next step here.": "No hay ningún próximo paso aquí.",
  "Enter a name.": "Escriba un nombre.",
  "That name is too long.": "Ese nombre es demasiado largo.",
  "That phone number is too long.": "Ese teléfono es demasiado largo.",
  "Keep it under 2,000 characters.": "Use menos de 2.000 caracteres.",
  "Enter a phone number or an email, so you can reach them.":
    "Escriba un teléfono o un correo, para poder comunicarse.",
  "Say what is owed.": "Diga qué hay que hacer.",
  "Keep it under 200 characters.": "Use menos de 200 caracteres.",
  "Pick when it is due.": "Elija para cuándo es.",

  // Booking: the window, its answers, the customer's page
  "Nothing is bookable here.": "Aquí no hay nada para reservar.",
  "This service does not take a pick of person.": "Este servicio no permite elegir a la persona.",
  "No booking here.": "No hay ninguna reserva aquí.",
  "That is not a business address.": "Esa no es una dirección de negocio.",
  "That is not a valid booking address.": "Esa no es una dirección de reserva válida.",
  "Times cannot be read right now. Try again shortly.":
    "Ahora no se pueden leer las horas. Inténtelo de nuevo en breve.",
  "This link does not open a booking.": "Este enlace no abre ninguna reserva.",
  "This booking has already started. Call the business to change it.":
    "Esta reserva ya comenzó. Llame al negocio para cambiarla.",
  "This booking was cancelled.": "Esta reserva fue cancelada.",
  "That time was just taken. Pick another.": "Esa hora se acaba de ocupar. Elija otra.",
  "That is not a valid move.": "Ese no es un cambio válido.",
  "That move is too large.": "Ese cambio es demasiado grande.",
  "That is not a valid booking.": "Esa no es una reserva válida.",
  "That booking is too large.": "Esa reserva es demasiado grande.",
  "Each question takes one answer.": "Cada pregunta lleva una sola respuesta.",
  "Answer: {}": "Responda: {}",
  "Sorry, that time was taken while you were booking. Please pick another one.":
    "Lo sentimos, esa hora se ocupó mientras reservaba. Por favor elija otra.",
  "This booking form was already used. Please reload the page and book again.":
    "Este formulario de reserva ya se usó. Por favor recargue la página y reserve de nuevo.",
  "That is not a booking link id.": "Ese no es un identificador de enlace de reserva.",
  "That is not a booking id.": "Ese no es un identificador de reserva.",
  "Pick one of the times offered.": "Elija una de las horas ofrecidas.",
  "That is not a person id.": "Ese no es un identificador de persona.",
  "That is not a booking form key.": "Esa no es una clave de formulario de reserva.",
  "Enter the address.": "Escriba la dirección.",
  "That address is too long.": "Esa dirección es demasiado larga.",
  "Keep it to 2000 characters.": "Use como máximo 2000 caracteres.",
  "That is not a question id.": "Ese no es un identificador de pregunta.",
  "That is not a question.": "Eso no es una pregunta.",
  "Answer in words.": "Responda con palabras.",
  "Keep each answer to 500 characters.": "Use como máximo 500 caracteres en cada respuesta.",
  "That is not a list of answers.": "Eso no es una lista de respuestas.",
  "That is too many answers.": "Son demasiadas respuestas.",
  "That is not a yes or a no.": "Eso no es un sí ni un no.",
  "Enter a phone that can get texts.": "Escriba un teléfono que pueda recibir mensajes de texto.",
  "Use a real date, YYYY-MM-DD.": "Use una fecha real, AAAA-MM-DD.",
  "The last date comes before the first.": "La última fecha es anterior a la primera.",
  "Ask for {} dates at most.": "Pida como máximo {} fechas.",
  "Enter a phone number.": "Escriba un teléfono.",
  "Your browser's time zone is not known.": "No se conoce la zona horaria de su navegador.",
  "Enter a phone number, or leave it empty.": "Escriba un teléfono, o déjelo vacío.",

  // The Calendar: booking by hand, time off
  "Set the business's hours on Settings first.":
    "Primero defina el horario del negocio en Ajustes.",
  "Your login is not linked to anyone on this business's calendar.":
    "Su cuenta no está vinculada a nadie en el calendario de este negocio.",
  "This business has nobody on its calendar yet.":
    "Este negocio todavía no tiene a nadie en su calendario.",
  "You can see only your own calendar.": "Solo puede ver su propio calendario.",
  "That calendar is not one of yours.": "Ese calendario no es suyo.",
  "That time does not exist that day: the clocks skip it.":
    "Esa hora no existe ese día: el reloj la salta.",
  "That service or person is not one of this business's.":
    "Ese servicio o esa persona no es de este negocio.",
  "Someone it needs is already busy then: off, booked, or busy in Google.":
    "Alguien que se necesita ya está ocupado a esa hora: no disponible, reservado u ocupado en Google.",
  "That day is already over.": "Ese día ya terminó.",
  "This person's Google calendar needs reconnecting, so their time cannot be checked. They reconnect on Settings, Calendar.":
    "El calendario de Google de esta persona necesita reconectarse, así que no se puede revisar su tiempo. Se reconecta en Ajustes, Calendario.",
  "Google did not answer, so that time cannot be checked. Try again shortly.":
    "Google no respondió, así que no se puede revisar esa hora. Inténtelo de nuevo en breve.",
  "Time off has to end after it starts.":
    "El horario no disponible tiene que terminar después de empezar.",
  "That person or place is not one of this business's.":
    "Esa persona o ese lugar no es de este negocio.",
  "Already off from {} to {}. Remove that time off first, or pick a time around it.":
    "Ya hay un horario no disponible de {} a {}: quite primero ese horario, o elija una hora fuera de él.",
  "That person does not do this service. Pick someone who does.":
    "Esa persona no hace este servicio. Elija a alguien que lo haga.",
  "That new time is inside the time off itself. Pick a time outside it.":
    "Esa nueva hora está dentro del mismo horario no disponible. Elija una hora fuera de él.",
  "A booking cannot be moved to a time already gone.":
    "Una reserva no se puede mover a una hora que ya pasó.",
  "Google did not answer, so that new time cannot be checked. Nothing was saved.":
    "Google no respondió, así que no se puede revisar esa nueva hora. No se guardó nada.",
  "That new time is not free. Nothing was saved: pick another time.":
    "Esa nueva hora no está libre. No se guardó nada: elija otra hora.",
  "A booking changed meanwhile. Nothing was saved: look again.":
    "Una reserva cambió mientras tanto. No se guardó nada: vuelva a mirar.",
  "Something in that time changed meanwhile. Nothing was saved: look again.":
    "Algo en ese tiempo cambió mientras tanto. No se guardó nada: vuelva a mirar.",
  "There is no such time off.": "Ese horario no disponible no existe.",
  "Pick who does it.": "Elija quién lo hace.",
  "Pick a day.": "Elija un día.",
  "That day does not exist.": "Ese día no existe.",
  "Pick a time.": "Elija una hora.",
  "Give the week as a date, YYYY-MM-DD.": "Indique la semana como una fecha, AAAA-MM-DD.",
  "That date does not exist.": "Esa fecha no existe.",
  "Pick who is off.": "Elija quién no está disponible.",
  "That is not a booking.": "Eso no es una reserva.",
  "That is not a list of bookings.": "Eso no es una lista de reservas.",
  "That is too many bookings for one save.": "Son demasiadas reservas para guardar de una vez.",
  "A booking can have one choice only.": "Una reserva admite una sola opción.",
  "Pick a booking to cancel.": "Elija una reserva para cancelar.",
  "Cancel at most 100 bookings at once.": "Cancele como máximo 100 reservas a la vez.",
  "The same booking is listed twice.": "La misma reserva aparece dos veces.",

  "The business does not work that weekday: set that day's hours on Hours.":
    "El negocio no trabaja ese día de la semana: defina el horario de ese día en Horario.",
  "They do not work that weekday: set their hours on Hours.":
    "Esa persona no trabaja ese día de la semana: defina su horario en Horario.",
  "A booking in that time has already begun, so time off cannot cover it.":
    "Una reserva en ese tiempo ya comenzó, así que el horario no disponible no puede cubrirla.",
  "There are bookings in that time. Choose for each one: move it or cancel it.":
    "Hay reservas en ese tiempo. Elija para cada una: moverla o cancelarla.",

  // Settings: hours and days off
  "Set the business's hours first.": "Primero defina el horario del negocio.",
  "Pick a time zone.": "Elija una zona horaria.",
  "That is not a time zone.": "Esa no es una zona horaria.",
  "Enter the notice, 0 or more.": "Escriba el aviso, 0 o más.",
  "Enter how many days ahead, 1 to 365.": "Escriba con cuántos días de anticipación, de 1 a 365.",
  "Customers can book at most a year ahead.":
    "Los clientes pueden reservar como máximo con un año de anticipación.",
  "Use a real date, like 2026-11-02.": "Use una fecha real, como 2026-11-02.",
  "A one-off date needs at least one window.": "Una fecha especial necesita al menos una franja.",
  "The same date is listed twice.": "La misma fecha aparece dos veces.",
  "A window has to end after it starts.": "Una franja tiene que terminar después de empezar.",
  "Two windows on the same day overlap.": "Dos franjas del mismo día se superponen.",
  "That day is not closed.": "Ese día no está cerrado.",
  "The same closed date is listed twice.": "La misma fecha cerrada aparece dos veces.",
  "Pick a country from the list.": "Elija un país de la lista.",
  "Pick a province from the list.": "Elija una provincia de la lista.",
  "{} is not in the holiday list: untick it.": "{} no está en la lista de festivos: desmárquelo.",
  "Use the two-letter country code, like CA.": "Use el código de país de dos letras, como CA.",
  "Use the province code, like AB.": "Use el código de la provincia, como AB.",
  "The same holiday is picked twice.": "El mismo festivo está marcado dos veces.",
  "Picked holidays need the country they come from.": "Los festivos marcados necesitan su país.",
  "A province needs its country.": "Una provincia necesita su país.",

  // Settings: services
  "A business needs a service.": "Un negocio necesita un servicio.",
  "No service here.": "No hay ningún servicio aquí.",
  "Choose a picture to upload.": "Elija una imagen para subir.",
  "That picture is over 1 MB. Choose a smaller one.":
    "Esa imagen pasa de 1 MB. Elija una más liviana.",
  "Use a PNG, JPEG or WebP picture.": "Use una imagen PNG, JPEG o WebP.",
  "The picture could not be saved. Try again shortly.":
    "La imagen no se pudo guardar. Intente de nuevo en un momento.",
  "This business cannot change its look here.": "Este negocio no puede cambiar su apariencia aquí.",
  "Use a colour like #b5838d.": "Use un color como #b5838d.",
  "That text is too faint on that background to read. Pick a darker or lighter one.":
    "Ese texto es demasiado tenue sobre ese fondo para leerse. Elija uno más oscuro o más claro.",
  "Tick only this business's people.": "Marque solo personas de este negocio.",
  "Tick only this business's places.": "Marque solo lugares de este negocio.",
  "Tick only this business's services.": "Marque solo servicios de este negocio.",
  "Tick at most 500 services.": "Marque como máximo 500 servicios.",
  "Tick each of the services once.": "Cada servicio se marca una sola vez.",
  "{} cannot do this service yet: tick it on their card on People.":
    "{} todavía no sabe hacer este servicio: márquelo en su tarjeta en Personas.",
  "A place has no skills: only people do.": "Un lugar no tiene habilidades: solo las personas.",
  "Tick at most 500 {}.": "Marque como máximo 500 {}.",
  "Tick each of the {} once.": "Cada uno se marca una sola vez.",
  "Use whole minutes.": "Use minutos enteros.",
  "Write the price as a number, like 150 or 12.50.":
    "Escriba el precio como un número, por ejemplo 150 o 12.50.",
  "A price can't be below 0.": "Un precio no puede ser menor que 0.",
  "That price is too high.": "Ese precio es demasiado alto.",
  "Give a price before ticking Starts from.": "Ponga un precio antes de marcar Desde.",
  "Pick a currency from the list.": "Elija una moneda de la lista.",
  "At most 2 decimals.": "Como máximo 2 decimales.",
  "Give a price before priceFrom.": "Ponga un precio antes de priceFrom.",
  "A price needs the file's currency.": "Un precio necesita la moneda del archivo.",
  "A service takes at least a minute.": "Un servicio dura al menos un minuto.",
  "A service fits in one day: 1440 minutes at most.":
    "Un servicio cabe en un día: como máximo 1440 minutos.",
  "Use 0 for no time.": "Use 0 si no hace falta tiempo.",
  "At least every minute.": "Como mínimo cada minuto.",
  "Give the service a name.": "Póngale un nombre al servicio.",
  "Keep it under 500 characters.": "Use menos de 500 caracteres.",
  "Pick who chooses the person.": "Elija quién escoge a la persona.",
  "Pick whether it asks the customer's address.": "Elija si pide la dirección del cliente.",

  // Settings: people
  "No person here.": "No hay ninguna persona aquí.",
  "No person or place here.": "No hay ninguna persona ni lugar aquí.",
  "No place here.": "No hay ningún lugar aquí.",
  "A person's services are what they can do: tick them on People.":
    "Los servicios de una persona son lo que sabe hacer: márquelos en Personas.",
  "Another person or place here already has that name.":
    "Otra persona o lugar de este negocio ya tiene ese nombre.",
  "Someone has to stay on: turn another person on first.":
    "Alguien tiene que quedar en servicio: primero ponga a otra persona en servicio.",
  "A place has no work email.": "Un lugar no tiene correo de trabajo.",
  "Use an address at {}, the business's own.": "Use una dirección en {}, la del propio negocio.",
  "Use an address at {}, your website's own domain.":
    "Use una dirección en {}, el dominio de su propio sitio web.",
  "Leave this empty for now: your website is not set up for your own address yet.":
    "Déjelo vacío por ahora: su sitio web todavía no está listo para su propia dirección.",
  "Set the business's sending address first.": "Primero defina la dirección de envío del negocio.",
  "A place gets no texts: only people do.":
    "Un lugar no recibe mensajes de texto: solo las personas.",
  "That is a texting number, so texts cannot reach them there.":
    "Ese es un número para enviar mensajes, así que los mensajes no les llegan ahí.",
  "The same person or place is listed twice.": "La misma persona o lugar aparece dos veces.",
  "Pick a person or a place.": "Elija una persona o un lugar.",
  "Give them a name.": "Póngale un nombre.",
  "Enter an email address, like pedro@example.com.": "Escriba un correo, como pedro@example.com.",

  // Settings: booking form
  "These questions changed since you opened the page. Reload to see them.":
    "Estas preguntas cambiaron desde que abrió la página. Recárguela para verlas.",
  "Set up texts for this business first: the yes is to texts it sends.":
    "Primero configure los mensajes de texto de este negocio: el sí es para los mensajes que envía.",
  "Pick whether the form asks for the yes to later texts.":
    "Elija si el formulario pide el sí a mensajes de texto más adelante.",
  "Write the question.": "Escriba la pregunta.",
  "Keep the question to 200 characters.": "Use como máximo 200 caracteres en la pregunta.",
  "Pick whether it must be answered.": "Elija si es obligatoria.",
  "That is not a list of questions.": "Eso no es una lista de preguntas.",
  "Ask at most {} questions.": "Haga como máximo {} preguntas.",
  "This question is already on the list.": "Esta pregunta ya está en la lista.",
  "A question is listed twice.": "Una pregunta aparece dos veces.",
  "Pick what a customer must leave.": "Elija qué debe dejar el cliente.",

  // Settings: texts
  "Texts are not set up for your business yet.":
    "Los mensajes de texto todavía no están configurados para su negocio.",
  "That is a texting number, so replies cannot go to it.":
    "Ese es un número para enviar mensajes, así que las respuestas no pueden ir ahí.",
  "Pick whether the confirmation text goes.": "Elija si se envía el mensaje de confirmación.",
  "Give each reminder in whole minutes.": "Indique cada recordatorio en minutos enteros.",
  "A reminder goes at least a minute before.": "Un recordatorio va al menos un minuto antes.",
  "That is not a list of reminders.": "Eso no es una lista de recordatorios.",
  "At most {} reminders.": "Como máximo {} recordatorios.",
  "That reminder is there twice.": "Ese recordatorio está dos veces.",
  "Choose where replies go: a phone, an email, or both.":
    "Elija adónde van las respuestas: un teléfono, un correo o ambos.",
  "Replies cannot go to the texting number itself.":
    "Las respuestas no pueden ir al mismo número que envía los mensajes.",
  "Use a Canadian or US number, like 403 555 0148.":
    "Use un número de Canadá o de EE. UU., como 403 555 0148.",
  "Pick yes or no.": "Elija sí o no.",

  // Setup: email sending
  "Enter the address emails come from, so the key can be tested.":
    "Escriba la dirección desde la que salen los correos, para poder probar la clave.",
  "That is not a Resend key. It starts with re_.":
    "Esa no es una clave de Resend. Empieza con re_.",
  "Resend refused this key.": "Resend rechazó esta clave.",
  "This Resend account has reached its sending limit. Raise it in Resend, or wait for it to reset.":
    "Esta cuenta de Resend llegó a su límite de envíos. Súbalo en Resend, o espere a que se reinicie.",
  "Resend would not send from this address. Check that its domain is verified in the same Resend account, and that the key may send from it.":
    "Resend no quiso enviar desde esta dirección. Revise que su dominio esté verificado en la misma cuenta de Resend, y que la clave pueda enviar desde ella.",
  "Resend would not accept this sender address. Check it is a real address at the business's domain.":
    "Resend no aceptó esta dirección de envío. Revise que sea una dirección real del dominio del negocio.",
  "Resend could not send the test email just now. Try again shortly.":
    "Resend no pudo enviar el correo de prueba en este momento. Inténtelo de nuevo en breve.",
  "The saved key can no longer be read. Paste it again.":
    "La clave guardada ya no se puede leer. Péguela de nuevo.",
};

// Values a message carries that are English words of the code's own, not the business's.
const spanishValues: Record<string, string> = {
  people: "personas",
  places: "lugares",
  booking: "reservas",
  crm: "CRM",
};

const englishDays: Record<string, string> = {
  Mon: "lun",
  Tue: "mar",
  Wed: "mié",
  Thu: "jue",
  Fri: "vie",
  Sat: "sáb",
  Sun: "dom",
};
const englishMonths: Record<string, string> = {
  Jan: "ene",
  Feb: "feb",
  Mar: "mar",
  Apr: "abr",
  May: "may",
  Jun: "jun",
  Jul: "jul",
  Aug: "ago",
  Sep: "sept",
  Oct: "oct",
  Nov: "nov",
  Dec: "dic",
};
const textTime =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{1,2}:\d{2})(am|pm)$/;

// A value in Spanish: the code's own words, or a text's time ("lun 26 oct, 9:00 a. m."); a name as it is.
function spanishValueOf(value: string): string {
  if (spanishValues[value]) return spanishValues[value];
  const time = value.match(textTime);
  if (!time) return value;
  const [, day, month, date, clock, half] = time;
  return `${englishDays[day]} ${date} ${englishMonths[month]}, ${clock} ${half === "am" ? "a. m." : "p. m."}`;
}

// "{}" templates as patterns, longest first, so a longer message wins over a shorter one.
const templates = Object.keys(spanishMessages)
  .filter((english) => english.includes("{}"))
  .sort((a, b) => b.length - a.length)
  .map((english) => ({
    pattern: new RegExp(
      `^${english
        .split("{}")
        .map((part) => part.replace(/[.*+?^$()|[\]\\]/g, "\\$&"))
        .join("(.+?)")}$`
    ),
    spanish: spanishMessages[english],
  }));

// The Spanish for an English message, or undefined when there is none.
export function spanishMessageOf(english: string): string | undefined {
  const exact = spanishMessages[english];
  if (exact !== undefined) return exact;
  for (const { pattern, spanish } of templates) {
    const match = english.match(pattern);
    if (!match) continue;
    let value = 0;
    return spanish.replace(/\{\}/g, () => spanishValueOf(match[++value] ?? ""));
  }
  return undefined;
}

// A message in a language: Spanish when there is one, the English as it came otherwise.
export function messageInLanguage(message: string, language: "en" | "es"): string {
  return language === "es" ? (spanishMessageOf(message) ?? message) : message;
}
