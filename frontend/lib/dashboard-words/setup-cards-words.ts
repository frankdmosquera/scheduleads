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
  keyLabel: string;
  keyPlaceholder: string;
  notSetUp: string;
  sendingOnceKeySaved(sender: string): string;
  sendingFrom(sender: string, keySavedOn: string): string; // the date as "Oct 2"
  savedTestSent(notifyEmail: string): string;
  savedPasteAKey: string;
  savingAndTesting: string;
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
    "Booking emails go out from your own address, through your own Resend account. Nobody can read the key once it is saved.",
  senderLabel: "Emails come from",
  senderPlaceholder: "bookings@yourbusiness.com",
  notifyLabel: "Booking notifications go to",
  notifyPlaceholder: "you@yourbusiness.com",
  keyLabel: "Resend key (send-only)",
  keyPlaceholder: "Paste a new key, or leave empty to keep the saved one",
  notSetUp: "Not set up. Booking emails are not sent yet.",
  sendingOnceKeySaved: (sender) => `Sending from ${sender} once a key is saved.`,
  sendingFrom: (sender, keySavedOn) => `Sending from ${sender}. Key saved ${keySavedOn}.`,
  savedTestSent: (notifyEmail) => `Saved. A test email went to ${notifyEmail}.`,
  savedPasteAKey: "Saved. Paste a key to start sending.",
  savingAndTesting: "Saving and testing…",
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
    "Los correos de reservas salen desde su propia dirección, a través de su propia cuenta de Resend. Nadie puede leer la clave una vez guardada.",
  senderLabel: "Los correos salen de",
  senderPlaceholder: "reservas@sunegocio.com",
  notifyLabel: "Los avisos de reservas van a",
  notifyPlaceholder: "usted@sunegocio.com",
  keyLabel: "Clave de Resend (solo envío)",
  keyPlaceholder: "Pegue una clave nueva, o déjelo vacío para mantener la guardada",
  notSetUp: "Sin configurar. Todavía no se envían correos de reservas.",
  sendingOnceKeySaved: (sender) => `Se enviará desde ${sender} cuando se guarde una clave.`,
  sendingFrom: (sender, keySavedOn) => `Enviando desde ${sender}. Clave guardada el ${keySavedOn}.`,
  savedTestSent: (notifyEmail) => `Guardado. Se envió un correo de prueba a ${notifyEmail}.`,
  savedPasteAKey: "Guardado. Pegue una clave para empezar a enviar.",
  savingAndTesting: "Guardando y probando…",
  save: "Guardar",
};
