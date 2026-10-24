// Frontend: the dashboard's words in Spanish (feature 12j), in "usted", as the booking window.

import type { DashboardWordsType } from "@/lib/dashboard-words/dashboard-words-type";
import { spanishLeadsWords } from "@/lib/dashboard-words/leads-words";
import { spanishScheduleWords } from "@/lib/dashboard-words/schedule-words";
import { spanishHoursWords } from "@/lib/dashboard-words/hours-words";
import { spanishDaysOffWords } from "@/lib/dashboard-words/days-off-words";
import { spanishPeopleWords } from "@/lib/dashboard-words/people-words";
import { spanishServicesWords } from "@/lib/dashboard-words/services-words";
import { spanishBookingFormWords } from "@/lib/dashboard-words/booking-form-words";
import { spanishTextsWords } from "@/lib/dashboard-words/texts-words";
import { spanishCalendarSettingsWords } from "@/lib/dashboard-words/calendar-settings-words";
import { spanishSettingsFrameWords } from "@/lib/dashboard-words/settings-frame-words";
import { spanishSetupCardsWords } from "@/lib/dashboard-words/setup-cards-words";

const roleNames: Record<string, string> = {
  owner: "propietario",
  admin: "administrador",
  member: "miembro",
};

export const spanishDashboardWords: DashboardWordsType = {
  intlLocale: "es-419",
  languageSwitchLabel: "Idioma",
  languageNotSaved: "No se pudo guardar su idioma. Inténtelo de nuevo.",
  signIn: "Iniciar sesión",
  signInLede: "Escriba su correo y le enviaremos un código. Sin contraseñas que recordar.",
  emailLabel: "Correo",
  emailPlaceholder: "usted@sunegocio.com",
  sending: "Enviando…",
  sendMeACode: "Enviarme un código",
  codeNotSent: "No se pudo enviar el código. Inténtelo de nuevo.",
  checkYourEmail: "Revise su correo",
  codeOnItsWay: (length) => `Un código de ${length} dígitos va en camino a`,
  useADifferentEmail: "Usar otro correo",
  loginCodeLabel: "Código de acceso",
  checking: "Revisando…",
  codeNotRight: "Ese código no es correcto. Pida uno nuevo.",
  codeExpired: "Ese código ya venció. Pida uno nuevo.",
  codeTriedTooOften: "Ese código se intentó demasiadas veces. Pida uno nuevo.",
  tooManyTries: "Demasiados intentos. Espere un minuto e inténtelo de nuevo.",
  signOut: "Cerrar sesión",
  oneMoment: "Un momento",
  loadingYourBusiness: "Cargando su negocio…",
  takingYouToSignIn: "Abriendo el inicio de sesión",
  oneMomentEllipsis: "Un momento…",
  needsAttention: "Esta cuenta necesita atención",
  planNotRecognisedLede:
    "Su negocio está en un plan que este panel no reconoce, así que no hay nada seguro que mostrarle.",
  nothingLost:
    "No se ha perdido nada. Escríbanos y volveremos a poner la cuenta en el plan correcto.",
  cannotReachTheApi: "No se puede conectar con la API",
  tryAgain: "Intentar de nuevo",
  lookingUpBusinesses: "Buscando sus negocios…",
  businessesNotLoaded: "No se pudieron cargar sus negocios.",
  businessNotOpened: "No se pudo abrir ese negocio.",
  noBusinessYet: "Su cuenta todavía no tiene un negocio",
  noBusinessYetLede:
    "La agencia configura su negocio por usted. Comuníquese con ellos y estará aquí la próxima vez que inicie sesión.",
  nothingUntilThen: "Hasta entonces no hay nada que mostrar.",
  whichBusiness: "¿Qué negocio?",
  whichBusinessLede:
    "Usted pertenece a más de uno, así que no vamos a adivinar. Elija con el que está trabajando.",
  screensLabel: "Pantallas",
  leads: "Prospectos",
  calendar: "Calendario",
  settings: "Ajustes",
  setup: "Configuración",
  signedInAs: "Sesión iniciada como",
  yourRole: "Su rol",
  roleName: (role) => roleNames[role] ?? role,
  address: "Dirección",
  plan: "Plan",
  included: "Incluye",
  nothingIncluded: "nada",
  homeNote:
    "Cada dato de arriba vino de una sola llamada a la API, limitada a este negocio por su sesión. Todos los prospectos están en la pantalla Prospectos.",
  setUpAClient: "Configurar un cliente",
  signInEnded: "Su sesión ha terminado.",
  signInAgain: "Iniciar sesión de nuevo",
  leadsWords: spanishLeadsWords,
  scheduleWords: spanishScheduleWords,
  hoursWords: spanishHoursWords,
  daysOffWords: spanishDaysOffWords,
  peopleWords: spanishPeopleWords,
  servicesWords: spanishServicesWords,
  bookingFormWords: spanishBookingFormWords,
  textsWords: spanishTextsWords,
  calendarSettingsWords: spanishCalendarSettingsWords,
  settingsFrameWords: spanishSettingsFrameWords,
  setupCardsWords: spanishSetupCardsWords,
};
