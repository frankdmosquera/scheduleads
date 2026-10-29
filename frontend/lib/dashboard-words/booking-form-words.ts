// Frontend: the words of Settings, Booking form: its rules and its questions (feature 12j), in
// English and Spanish ("usted").
// One type, one object per language, so a word left out of either is a type error.

export type BookingFormWordsType = {
  cannotChange: string;
  // What the form requires
  rulesTitle: string;
  rulesLede: string;
  customerMustLeave: string;
  emailOrPhone: string;
  anEmail: string;
  aPhone: string;
  emailAndPhone: string;
  detailsBoxWords: string;
  detailsBoxHint: string;
  detailsBoxRequired: string;
  yesRequired: string;
  askLaterTextsYes: string;
  yesShowTheBox: string;
  no: string;
  laterTextsOnceSetUp: string;
  emailsComeIn: string; // the business's own language, for its booking emails (12i)
  customersGetTheirs: string;
  rulesSaved: string;
  // The questions
  questionsTitle: string;
  questionsLede(most: number): string;
  noQuestions: string;
  startFromSet(setName: string): string; // the set's name, in the login's language
  questionNumber(position: number): string;
  mustBeAnsweredNumbered(position: number): string;
  mustBeAnswered: string;
  moveUp(position: number): string;
  moveDown(position: number): string;
  removeNumbered(position: number): string;
  up: string;
  down: string;
  movedTo(position: number, count: number): string;
  questionRemoved: string;
  addQuestion: string;
  questionsSaved: string;
  saveQuestions: string;
};

export const englishBookingFormWords: BookingFormWordsType = {
  cannotChange: "Your role cannot change the booking form. You can see it here.",
  rulesTitle: "What the form requires",
  rulesLede:
    "Every booking needs a name. Whether each service asks the address is set on Services.",
  customerMustLeave: "A customer must leave",
  emailOrPhone: "An email or a phone, either one",
  anEmail: "An email",
  aPhone: "A phone",
  emailAndPhone: "An email and a phone, both",
  detailsBoxWords: "The project box's words",
  detailsBoxHint: 'Left empty, the box says "What would you like done?"',
  detailsBoxRequired: "Must a customer fill it in?",
  yesRequired: "Yes, required",
  askLaterTextsYes: "Ask the customer's yes to later texts (offers, reminders to book again)",
  yesShowTheBox: "Yes, show the box",
  no: "No",
  laterTextsOnceSetUp:
    "The form can ask the customer's yes to later texts once texts are set up for this business.",
  emailsComeIn: "Your booking emails come in",
  customersGetTheirs:
    "Customers get theirs in the language they booked in: a Spanish site's window books in Spanish.",
  rulesSaved: "Saved what the form requires and its language.",
  questionsTitle: "Your questions",
  questionsLede: (most) =>
    `Asked after the name, email, phone and address, in this order. At most ${most}. Changing or removing one never changes the answers already given.`,
  noQuestions: "No questions: the form asks only the standard ones.",
  startFromSet: (setName) => `Start from the ${setName.toLowerCase()} set`,
  questionNumber: (position) => `Question ${position}`,
  mustBeAnsweredNumbered: (position) => `Question ${position} must be answered`,
  mustBeAnswered: "Must be answered",
  moveUp: (position) => `Move question ${position} up`,
  moveDown: (position) => `Move question ${position} down`,
  removeNumbered: (position) => `Remove question ${position}`,
  up: "Up",
  down: "Down",
  movedTo: (position, count) => `Moved to position ${position} of ${count}.`,
  questionRemoved: "Question removed.",
  addQuestion: "+ Add a question",
  questionsSaved: "Saved the questions.",
  saveQuestions: "Save questions",
};

export const spanishBookingFormWords: BookingFormWordsType = {
  cannotChange: "Su rol no puede cambiar el formulario de reserva. Puede verlo aquí.",
  rulesTitle: "Lo que pide el formulario",
  rulesLede:
    "Toda reserva necesita un nombre. Si cada servicio pide la dirección se define en Servicios.",
  customerMustLeave: "El cliente debe dejar",
  emailOrPhone: "Un correo o un teléfono, cualquiera de los dos",
  anEmail: "Un correo",
  aPhone: "Un teléfono",
  emailAndPhone: "Un correo y un teléfono, los dos",
  detailsBoxWords: "Lo que dice la casilla del proyecto",
  detailsBoxHint: 'Vacía, la casilla dice "¿Qué necesita?"',
  detailsBoxRequired: "¿El cliente debe llenarla?",
  yesRequired: "Sí, obligatoria",
  askLaterTextsYes:
    "Pedir el sí del cliente a mensajes de texto más adelante (ofertas, recordatorios para volver a reservar)",
  yesShowTheBox: "Sí, mostrar la casilla",
  no: "No",
  laterTextsOnceSetUp:
    "El formulario puede pedir el sí del cliente a mensajes de texto más adelante cuando los mensajes estén configurados para este negocio.",
  emailsComeIn: "Sus correos de reservas llegan en",
  customersGetTheirs:
    "Los clientes reciben los suyos en el idioma en que reservaron: la ventana de un sitio en español reserva en español.",
  rulesSaved: "Se guardó lo que pide el formulario y su idioma.",
  questionsTitle: "Sus preguntas",
  questionsLede: (most) =>
    `Se hacen después del nombre, el correo, el teléfono y la dirección, en este orden. Como máximo ${most}. Cambiar o quitar una nunca cambia las respuestas ya dadas.`,
  noQuestions: "Sin preguntas: el formulario hace solo las de siempre.",
  startFromSet: (setName) => `Empezar con el conjunto de ${setName.toLowerCase()}`,
  questionNumber: (position) => `Pregunta ${position}`,
  mustBeAnsweredNumbered: (position) => `La pregunta ${position} es obligatoria`,
  mustBeAnswered: "Es obligatoria",
  moveUp: (position) => `Subir la pregunta ${position}`,
  moveDown: (position) => `Bajar la pregunta ${position}`,
  removeNumbered: (position) => `Quitar la pregunta ${position}`,
  up: "Subir",
  down: "Bajar",
  movedTo: (position, count) => `Movida a la posición ${position} de ${count}.`,
  questionRemoved: "Pregunta quitada.",
  addQuestion: "+ Agregar una pregunta",
  questionsSaved: "Se guardaron las preguntas.",
  saveQuestions: "Guardar preguntas",
};
