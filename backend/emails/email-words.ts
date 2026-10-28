// Backend: everything the booking emails say, in English and Spanish (feature 12i). The customer's
// emails use the booking's language, the owner's the business's. Spanish is in "usted", as
// ialaorden.com is written. One object per language, so a word left out of one is a type error.

export type EmailLanguageType = "en" | "es";

export type EmailWordsType = {
  what: string;
  when: string;
  with: string;
  where: string;
  price: string;
  priceFrom(price: string): string; // "From $150": the service can cost more (feature 25d)
  whenItWas: string;
  newTime: string;
  movedFrom: string;
  manageBooking: string;
  callUsAt: string; // "Or call us at", followed by the number
  call(name: string): string;
  // The customer's three
  bookedSubject(business: string, when: string): string;
  bookedHeading: string;
  bookedThanks(customer: string, business: string): string;
  needToChange: string;
  bookedPreview(service: string, when: string): string;
  movedSubject(business: string, when: string): string;
  movedPreview(service: string, when: string): string;
  movedHeading: string;
  movedThanks(customer: string, business: string): string;
  needToChangeAgain: string;
  cancelledSubject(business: string, when: string): string;
  cancelledPreview(service: string, when: string): string;
  cancelledHeading: string;
  cancelledByBusiness(business: string): string;
  cancelledThanks(customer: string): string;
  anotherTime(phone: string): string;
  // The owner's three
  newBookingSubject(service: string, when: string): string;
  newBookingHeading: string;
  bookedWith: string;
  wasBookedWith: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  inTheirWords: string;
  bookedOnSiteReply(customer: string): string;
  bookedOnSiteNoEmail(customer: string): string;
  ownerMovedSubject(service: string, when: string): string;
  ownerMovedHeading: string;
  ownerMovedFooter(customer: string, canReply: boolean): string;
  oldTimeFree: string;
  ownerCancelledSubject(service: string, when: string): string;
  ownerCancelledHeading: string;
  ownerCancelledFooter(customer: string, canReply: boolean): string;
  timeFree: string;
};

const english: EmailWordsType = {
  what: "What",
  when: "When",
  with: "With",
  where: "Where",
  price: "Price",
  priceFrom: (price) => `From ${price}`,
  whenItWas: "When it was",
  newTime: "New time",
  movedFrom: "Moved from",
  manageBooking: "Manage your booking",
  callUsAt: "Or call us at",
  call: (name) => `Call ${name}`,
  bookedSubject: (business, when) => `You're booked with ${business}: ${when}`,
  bookedHeading: "You're booked",
  bookedThanks: (customer, business) => `Thanks, ${customer}. ${business} has you booked.`,
  needToChange: "Need to change it?",
  bookedPreview: (service, when) => `${service}, ${when}`,
  movedSubject: (business, when) => `Your booking with ${business} has moved: ${when}`,
  movedPreview: (service, when) => `Moved: ${service}, ${when}`,
  movedHeading: "Your booking has moved",
  movedThanks: (customer, business) => `Thanks, ${customer}. ${business} has you at the new time.`,
  needToChangeAgain: "Need to change it again?",
  cancelledSubject: (business, when) => `Your booking with ${business} is cancelled: ${when}`,
  cancelledPreview: (service, when) => `Cancelled: ${service}, ${when}`,
  cancelledHeading: "Your booking is cancelled",
  cancelledByBusiness: (business) => `${business} had to cancel your booking.`,
  cancelledThanks: (customer) => `Thanks for letting us know, ${customer}.`,
  anotherTime: (phone) => `Want another time? Call us at ${phone}.`,
  newBookingSubject: (service, when) => `New booking: ${service}, ${when}`,
  newBookingHeading: "New booking",
  bookedWith: "Booked with",
  wasBookedWith: "Was booked with",
  name: "Name",
  phone: "Phone",
  email: "Email",
  address: "Address",
  inTheirWords: "In their words",
  bookedOnSiteReply: (customer) => `Booked on your website. Replying goes straight to ${customer}.`,
  bookedOnSiteNoEmail: (customer) =>
    `Booked on your website. ${customer} gave no email, so call to reach them.`,
  ownerMovedSubject: (service, when) => `Moved: ${service}, ${when}`,
  ownerMovedHeading: "Booking moved",
  ownerMovedFooter: (customer, canReply) =>
    canReply
      ? `${customer} moved it from the link in their confirmation. Replying goes straight to ${customer}.`
      : `${customer} moved it from the link in their confirmation.`,
  oldTimeFree: "The old time is free again: the next customer can book it.",
  ownerCancelledSubject: (service, when) => `Cancelled: ${service}, ${when}`,
  ownerCancelledHeading: "Booking cancelled",
  ownerCancelledFooter: (customer, canReply) =>
    canReply
      ? `${customer} cancelled from the link in their confirmation. Replying goes straight to ${customer}.`
      : `${customer} cancelled from the link in their confirmation.`,
  timeFree: "The time is free again: the next customer can book it.",
};

// Spanish writes a day lowercase inside a line: "confirmada: jueves, 8 de octubre".
const inLine = (when: string) => when.charAt(0).toLocaleLowerCase("es") + when.slice(1);

const spanish: EmailWordsType = {
  what: "Qué",
  when: "Cuándo",
  with: "Con",
  where: "Dónde",
  price: "Precio",
  priceFrom: (price) => `Desde ${price}`,
  whenItWas: "Cuándo era",
  newTime: "Nueva hora",
  movedFrom: "Antes era",
  manageBooking: "Gestionar su reserva",
  callUsAt: "O llámenos al",
  call: (name) => `Llamar a ${name}`,
  bookedSubject: (business, when) => `Su reserva con ${business} está confirmada: ${inLine(when)}`,
  bookedHeading: "Su reserva está confirmada",
  bookedThanks: (customer, business) => `Gracias, ${customer}. ${business} tiene su reserva.`,
  needToChange: "¿Necesita cambiarla?",
  bookedPreview: (service, when) => `${service}, ${inLine(when)}`,
  movedSubject: (business, when) => `Su reserva con ${business} cambió de hora: ${inLine(when)}`,
  movedPreview: (service, when) => `Cambio de hora: ${service}, ${inLine(when)}`,
  movedHeading: "Su reserva cambió de hora",
  movedThanks: (customer, business) =>
    `Gracias, ${customer}. Su nueva hora con ${business} está confirmada.`,
  needToChangeAgain: "¿Necesita cambiarla de nuevo?",
  cancelledSubject: (business, when) => `Su reserva con ${business} fue cancelada: ${inLine(when)}`,
  cancelledPreview: (service, when) => `Cancelada: ${service}, ${inLine(when)}`,
  cancelledHeading: "Su reserva fue cancelada",
  cancelledByBusiness: (business) => `${business} tuvo que cancelar su reserva.`,
  cancelledThanks: (customer) => `Gracias por avisarnos, ${customer}.`,
  anotherTime: (phone) => `¿Quiere otra hora? Llámenos al ${phone}.`,
  newBookingSubject: (service, when) => `Nueva reserva: ${service}, ${inLine(when)}`,
  newBookingHeading: "Nueva reserva",
  bookedWith: "Reservado con",
  wasBookedWith: "Estaba reservado con",
  name: "Nombre",
  phone: "Teléfono",
  email: "Correo",
  address: "Dirección",
  inTheirWords: "En sus palabras",
  bookedOnSiteReply: (customer) =>
    `Reservado en su sitio web. Al responder, le escribe directamente a ${customer}.`,
  bookedOnSiteNoEmail: (customer) =>
    `Reservado en su sitio web. ${customer} no dejó correo: llame para comunicarse.`,
  ownerMovedSubject: (service, when) => `Cambio de hora: ${service}, ${inLine(when)}`,
  ownerMovedHeading: "Reserva cambiada de hora",
  ownerMovedFooter: (customer, canReply) =>
    canReply
      ? `${customer} la cambió desde el enlace de su confirmación. Al responder, le escribe directamente a ${customer}.`
      : `${customer} la cambió desde el enlace de su confirmación.`,
  oldTimeFree: "La hora anterior quedó libre: el próximo cliente puede reservarla.",
  ownerCancelledSubject: (service, when) => `Cancelada: ${service}, ${inLine(when)}`,
  ownerCancelledHeading: "Reserva cancelada",
  ownerCancelledFooter: (customer, canReply) =>
    canReply
      ? `${customer} la canceló desde el enlace de su confirmación. Al responder, le escribe directamente a ${customer}.`
      : `${customer} la canceló desde el enlace de su confirmación.`,
  timeFree: "La hora quedó libre: el próximo cliente puede reservarla.",
};

export const emailWordsOf: Record<EmailLanguageType, EmailWordsType> = { en: english, es: spanish };
