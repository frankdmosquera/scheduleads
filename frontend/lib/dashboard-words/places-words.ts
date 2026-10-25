// Frontend: the words of Settings, Places: the places and the services that need each (feature
// 12k), in English and Spanish ("usted"). Adding and changing one use the People page's words.
// One type, one object per language, so a word left out of either is a type error.

export type PlacesWordsType = {
  lede: string;
  cannotChange: string;
  addButton: string;
  needsTitle(name: string): string;
  needsHint: string;
};

export const englishPlacesWords: PlacesWordsType = {
  lede: "Rooms, chairs or anything a service needs free.",
  cannotChange: "Your role cannot change the places. You can see them here.",
  addButton: "+ Add a place",
  needsTitle: (name) => `Services that need ${name}`,
  needsHint:
    'A service ticked here is booked only while this place is free. It is the same tick as "Places it needs" on the service.',
};

// Gender-free on purpose: a place may be "la sala" or "el sillón".
export const spanishPlacesWords: PlacesWordsType = {
  lede: "Salas, sillas o cualquier cosa que un servicio necesita libre.",
  cannotChange: "Su rol no puede cambiar los lugares. Puede verlos aquí.",
  addButton: "+ Agregar un lugar",
  needsTitle: (name) => `Servicios que necesitan ${name}`,
  needsHint:
    'Un servicio marcado aquí se reserva solo mientras este lugar está libre. Es la misma marca que "Lugares que necesita" en el servicio.',
};
