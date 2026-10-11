// Backend: the ready-made booking questions an owner can start from on Settings (feature 12f), one
// set per trade. They fill the page's list only when pressed, to change before saving; nothing is
// ever saved from here on its own.

export type BookingQuestionSetType = {
  trade: "painting" | "clinic";
  name: string;
  questions: { label: string; required: boolean }[];
};

export const bookingQuestionSets: BookingQuestionSetType[] = [
  {
    trade: "painting",
    name: "Painting",
    questions: [
      { label: "Interior or exterior?", required: true },
      { label: "How many rooms?", required: false },
    ],
  },
  {
    trade: "clinic",
    name: "Clinic",
    questions: [
      { label: "Any allergies or skin conditions?", required: true },
      { label: "Is this your first visit?", required: false },
    ],
  },
];
