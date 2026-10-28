// Frontend: the words of the Look page and of every picture field (feature 25e), in English and
// Spanish ("usted"). One type, one object per language, so a word left out of either is a type error.

export type LookWordsType = {
  logo: string;
  logoHint: string;
  noLogo: string;
  cannotChange: string;
  // A picture field, on the Look page and on a service's card
  upload: string;
  replace: string;
  remove: string;
  uploading: string;
  saved: string;
  removed: string;
  pictureTypes: string;
  notAPicture: string;
  servicePhoto: string;
  noPhoto: string;
  servicePhotoHint: string;
  saveServiceFirst: string;
  pictureOf(name: string): string;
};

export const englishLookWords: LookWordsType = {
  logo: "Logo",
  logoHint: "Shown in your booking window and at the top of your customers' emails.",
  noLogo: "No logo yet: your business's name shows instead.",
  cannotChange: "Your login can see the look but not change it.",
  upload: "Upload a picture",
  replace: "Replace",
  remove: "Remove",
  uploading: "Uploading…",
  saved: "Saved.",
  removed: "Removed.",
  pictureTypes: "PNG, JPEG or WebP. It is made lighter before it is sent.",
  notAPicture: "That file could not be read as a picture. Use a PNG, JPEG or WebP.",
  servicePhoto: "Photo (optional)",
  noPhoto: "No photo yet",
  servicePhotoHint: "Shown on this service in your booking window.",
  saveServiceFirst: "Add the service first, then its photo.",
  pictureOf: (name) => `Picture of ${name}`,
};

export const spanishLookWords: LookWordsType = {
  logo: "Logo",
  logoHint: "Se muestra en su ventana de reservas y arriba en los correos a sus clientes.",
  noLogo: "Aún sin logo: se muestra el nombre de su negocio.",
  cannotChange: "Su usuario puede ver la apariencia pero no cambiarla.",
  upload: "Subir una imagen",
  replace: "Cambiar",
  remove: "Quitar",
  uploading: "Subiendo…",
  saved: "Guardado.",
  removed: "Quitado.",
  pictureTypes: "PNG, JPEG o WebP. Se aligera antes de enviarse.",
  notAPicture: "Ese archivo no se pudo leer como imagen. Use un PNG, JPEG o WebP.",
  servicePhoto: "Foto (opcional)",
  noPhoto: "Aún sin foto",
  servicePhotoHint: "Se muestra en este servicio en su ventana de reservas.",
  saveServiceFirst: "Agregue primero el servicio, luego su foto.",
  pictureOf: (name) => `Imagen de ${name}`,
};
