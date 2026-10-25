// Frontend: the words of the Settings frame, its index and the parts every Settings screen shares
// (feature 12j), in English and Spanish ("usted").
// One type, one object per language, so a word left out of either is a type error.

export type SettingsFrameWordsType = {
  lede: string;
  sectionsLabel: string;
  // The sections, in the menu and as each page's title
  hours: string;
  services: string;
  people: string;
  places: string;
  daysOff: string;
  bookingForm: string;
  texts: string;
  calendar: string;
  // Shared by the Settings screens
  loading: string;
  saving: string;
  save: string;
  cancel: string;
  change: string;
  remove: string;
  addThemOnPeople: string; // a link, followed by a full stop
  addThemOnPlaces: string; // a link, followed by a full stop
  tickItOnPeople: string; // a link, followed by a full stop
  off: string; // after a turned-off person or place, with its own leading space
};

export const englishSettingsFrameWords: SettingsFrameWordsType = {
  lede: "What you change yourself. Nobody at the agency needs to touch anything for this.",
  sectionsLabel: "Settings sections",
  hours: "Hours",
  services: "Services",
  people: "People",
  places: "Places",
  daysOff: "Days off",
  bookingForm: "Booking form",
  texts: "Texts",
  calendar: "Calendar",
  loading: "Loading…",
  saving: "Saving…",
  save: "Save",
  cancel: "Cancel",
  change: "Change",
  remove: "Remove",
  addThemOnPeople: "Add them on People",
  addThemOnPlaces: "Add them on Places",
  tickItOnPeople: "Tick it on their card on People",
  off: " (off)",
};

export const spanishSettingsFrameWords: SettingsFrameWordsType = {
  lede: "Lo que usted cambia por su cuenta. Nadie en la agencia tiene que tocar nada para esto.",
  sectionsLabel: "Secciones de ajustes",
  hours: "Horario",
  services: "Servicios",
  people: "Personas",
  places: "Lugares",
  daysOff: "Días libres",
  bookingForm: "Formulario de reserva",
  texts: "Mensajes de texto",
  calendar: "Calendario",
  loading: "Cargando…",
  saving: "Guardando…",
  save: "Guardar",
  cancel: "Cancelar",
  change: "Cambiar",
  remove: "Quitar",
  addThemOnPeople: "Agréguelos en Personas",
  addThemOnPlaces: "Agréguelos en Lugares",
  tickItOnPeople: "Márquelo en su tarjeta en Personas",
  off: " (fuera de servicio)",
};
