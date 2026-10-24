// Frontend: the words of Settings, Calendar: the connection and the busy calendars (feature 12j), in
// English and Spanish ("usted").
// One type, one object per language, so a word left out of either is a type error.

import type { CalendarConnectOutcomeType } from "@scheduleads-app/shared/calendar";

export type CalendarSettingsWordsType = {
  lede: string;
  // What happened at Google, keyed by the shared list so a renamed outcome fails the build
  connectOutcome: Record<CalendarConnectOutcomeType, string>;
  handedBack: string;
  stillUsed: string;
  alreadyStopped: string;
  notConfirmed: string; // followed by the link, then a full stop
  yourGoogleAccount: string;
  // The connection
  notLinked: string;
  lastRead(relativeTime: string): string; // "40 seconds ago", from Intl.RelativeTimeFormat
  notReadYet: string;
  disconnecting: string;
  disconnect: string;
  needsReconnecting: string;
  openingGoogle: string;
  reconnect: string;
  connected: string;
  notConnected: string;
  connect: string;
  // Which calendars count as busy
  loadingCalendars: string;
  busySaved: string;
  whichCountAsBusy: string;
  busyHint: string;
  main: string; // after the main calendar, with its own leading space
  noLongerInGoogle: string;
  nothingTicked: string;
};

export const englishCalendarSettingsWords: CalendarSettingsWordsType = {
  lede: "Your own calendar, so customers are never offered a time you are busy.",
  connectOutcome: {
    connected: "Your Google calendar is connected.",
    denied: "You cancelled at Google. Nothing was connected.",
    expired: "That took too long, or the link was already used. Press Connect again.",
    missing_permission:
      "Leave every box ticked at Google: seeing when you are busy, adding bookings, and the list of your calendars. Press Connect again.",
    failed: "Google did not answer properly. Nothing was saved. Try again in a minute.",
  },
  handedBack: "Disconnected. Google no longer gives this app access to your calendar.",
  stillUsed:
    "Disconnected here. Another business of yours still uses this Google account, so Google keeps allowing it.",
  alreadyStopped: "Disconnected. Google had already stopped accepting this connection.",
  notConfirmed: "Disconnected here, but Google did not confirm. Remove the app in",
  yourGoogleAccount: "your Google account",
  notLinked:
    "Your login is not linked to anyone on this business's calendar, so there is nothing to connect yet.",
  lastRead: (relativeTime) => `Last read ${relativeTime}.`,
  notReadYet: "Not read yet.",
  disconnecting: "Disconnecting…",
  disconnect: "Disconnect",
  needsReconnecting: "Needs reconnecting. Google stopped accepting the saved permission.",
  openingGoogle: "Opening Google…",
  reconnect: "Reconnect",
  connected: "Connected.",
  notConnected: "Not connected. Your busy times are not read yet.",
  connect: "Connect",
  loadingCalendars: "Loading your calendars…",
  busySaved: "Saved. Customers are offered times around these calendars.",
  whichCountAsBusy: "Which calendars count as busy",
  busyHint:
    "Customers are never offered a time when anything in a ticked calendar says you are busy. Bookings always go into your main calendar.",
  main: " (main)",
  noLongerInGoogle: "No longer in your Google account",
  nothingTicked: "Nothing ticked: nothing in your Google calendar stops a customer booking you.",
};

export const spanishCalendarSettingsWords: CalendarSettingsWordsType = {
  lede: "Su propio calendario, para que a los clientes nunca se les ofrezca una hora en la que usted está ocupado.",
  connectOutcome: {
    connected: "Su calendario de Google está conectado.",
    denied: "Usted canceló en Google. No se conectó nada.",
    expired: "Tardó demasiado, o el enlace ya se había usado. Pulse Conectar de nuevo.",
    missing_permission:
      "Deje todas las casillas marcadas en Google: ver cuándo está ocupado, agregar reservas y la lista de sus calendarios. Pulse Conectar de nuevo.",
    failed: "Google no respondió bien. No se guardó nada. Inténtelo de nuevo en un minuto.",
  },
  handedBack: "Desconectado. Google ya no le da a esta aplicación acceso a su calendario.",
  stillUsed:
    "Desconectado aquí. Otro de sus negocios todavía usa esta cuenta de Google, así que Google lo sigue permitiendo.",
  alreadyStopped: "Desconectado. Google ya había dejado de aceptar esta conexión.",
  notConfirmed: "Desconectado aquí, pero Google no lo confirmó. Quite la aplicación en",
  yourGoogleAccount: "su cuenta de Google",
  notLinked:
    "Su usuario no está vinculado a nadie en el calendario de este negocio, así que todavía no hay nada que conectar.",
  lastRead: (relativeTime) => `Última lectura ${relativeTime}.`,
  notReadYet: "Aún no se ha leído.",
  disconnecting: "Desconectando…",
  disconnect: "Desconectar",
  needsReconnecting: "Hay que volver a conectarlo. Google dejó de aceptar el permiso guardado.",
  openingGoogle: "Abriendo Google…",
  reconnect: "Volver a conectar",
  connected: "Conectado.",
  notConnected: "No conectado. Todavía no se leen sus horas ocupadas.",
  connect: "Conectar",
  loadingCalendars: "Cargando sus calendarios…",
  busySaved: "Guardado. A los clientes se les ofrecen horas que respetan estos calendarios.",
  whichCountAsBusy: "Qué calendarios cuentan como ocupado",
  busyHint:
    "A los clientes nunca se les ofrece una hora en la que algo de un calendario marcado diga que usted está ocupado. Las reservas siempre van a su calendario principal.",
  main: " (principal)",
  noLongerInGoogle: "Ya no está en su cuenta de Google",
  nothingTicked:
    "Nada marcado: nada de su calendario de Google impide que un cliente lo reserve a usted.",
};
