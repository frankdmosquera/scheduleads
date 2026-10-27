// Frontend: the words of the Setup screen's cards: booking links and email sending (feature 12j), in
// English and Spanish ("usted").
// One type, one object per language, so a word left out of either is a type error.

export type SetupCardsWordsType = {
  loading: string;
  // Booking links
  bookingLinks: string;
  bookingLinksLede: string;
  loadingBookingLinks: string;
  notBookable: string;
  noneSwitchedOn: string;
  minutes(count: number): string;
  // Email sending
  emailSending: string;
  emailSendingLede: string;
  senderLabel: string;
  senderPlaceholder: string;
  notifyLabel: string;
  notifyPlaceholder: string;
  sendingFromOwnDomain(sender: string): string;
  sendingFromAgencyDomain(sender: string): string; // until the business's own domain is added
  noticesGoTo(notifyEmail: string): string;
  noticesGoNowhere: string;
  saved: string;
  saving: string;
  save: string;
};

export const englishSetupCardsWords: SetupCardsWordsType = {
  loading: "Loading…",
  bookingLinks: "Booking links",
  bookingLinksLede: "What customers can book on your site.",
  loadingBookingLinks: "Loading your booking links…",
  notBookable: "Not open for online booking yet. Customers can't book on your site until it is.",
  noneSwitchedOn: "None switched on yet. Customers can't book online until one is.",
  minutes: (count) => `${count} min`,
  emailSending: "Email sending",
  emailSendingLede:
    "Booking emails go out in your business's name. Leave a field empty and it is picked for you.",
  senderLabel: "Emails come from",
  senderPlaceholder: "Picked for you",
  notifyLabel: "Booking notifications go to",
  notifyPlaceholder: "Your login email",
  sendingFromOwnDomain: (sender) => `Booking emails come from ${sender}.`,
  sendingFromAgencyDomain: (sender) =>
    `Booking emails come from ${sender} until your own domain is added.`,
  noticesGoTo: (notifyEmail) => `New booking notices go to ${notifyEmail}.`,
  noticesGoNowhere: "New booking notices have nowhere to go yet. Add an address.",
  saved: "Saved.",
  saving: "Saving…",
  save: "Save",
};

export const spanishSetupCardsWords: SetupCardsWordsType = {
  loading: "Cargando…",
  bookingLinks: "Enlaces de reserva",
  bookingLinksLede: "Lo que los clientes pueden reservar en su sitio.",
  loadingBookingLinks: "Cargando sus enlaces de reserva…",
  notBookable:
    "Todavía no está abierto a reservas en línea. Los clientes no pueden reservar en su sitio hasta entonces.",
  noneSwitchedOn:
    "Ninguno está activado todavía. Los clientes no pueden reservar en línea hasta que haya uno.",
  minutes: (count) => `${count} min`,
  emailSending: "Envío de correos",
  emailSendingLede:
    "Los correos de reservas salen a nombre de su negocio. Si deja un campo vacío, se elige por usted.",
  senderLabel: "Los correos salen de",
  senderPlaceholder: "Se elige por usted",
  notifyLabel: "Los avisos de reservas van a",
  notifyPlaceholder: "Su correo de inicio de sesión",
  sendingFromOwnDomain: (sender) => `Los correos de reservas salen de ${sender}.`,
  sendingFromAgencyDomain: (sender) =>
    `Los correos de reservas salen de ${sender} hasta que se agregue su propio dominio.`,
  noticesGoTo: (notifyEmail) => `Los avisos de reservas nuevas van a ${notifyEmail}.`,
  noticesGoNowhere:
    "Los avisos de reservas nuevas todavía no tienen adónde ir. Agregue una dirección.",
  saved: "Guardado.",
  saving: "Guardando…",
  save: "Guardar",
};
