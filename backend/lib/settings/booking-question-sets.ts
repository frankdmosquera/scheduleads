// Backend: the ready-made booking questions an owner can start from on Settings (feature 12f), one
// set per trade, in English and Spanish (12j): the page names a set in the language its login
// reads and fills its questions in the business's language, the one its customers read.
// They fill the page's list only when pressed, to change before saving; nothing is ever saved from
// here on its own.

type SetLanguageType = "en" | "es";
type SetQuestionType = { label: string; required: boolean };

export type BookingQuestionSetType = {
  trade: "painting" | "clinic";
  name: Record<SetLanguageType, string>;
  questions: Record<SetLanguageType, SetQuestionType[]>;
};

export const bookingQuestionSets: BookingQuestionSetType[] = [
  {
    trade: "painting",
    name: { en: "Painting", es: "Pintura" },
    questions: {
      en: [
        { label: "Interior or exterior?", required: true },
        { label: "How many rooms?", required: false },
      ],
      es: [
        { label: "¿Interior o exterior?", required: true },
        { label: "¿Cuántas habitaciones?", required: false },
      ],
    },
  },
  {
    trade: "clinic",
    name: { en: "Clinic", es: "Clínica" },
    questions: {
      en: [
        { label: "Any allergies or skin conditions?", required: true },
        { label: "Is this your first visit?", required: false },
      ],
      es: [
        { label: "¿Tiene alergias o alguna afección de la piel?", required: true },
        { label: "¿Es su primera visita?", required: false },
      ],
    },
  },
];
