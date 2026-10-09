// Booking component: what the customer has typed on screen two, kept by the window while it is
// open, so a time taken while she typed sends her back to the times without losing her words.

export type BookingFormValuesType = {
  requestKey: string; // one per form (decision 9): sending it again never makes a second booking
  name: string;
  email: string;
  phone: string;
  location: string;
  details: string;
  answers: Record<string, string>; // by the business's question id
};

// Where an error shows: a standard field, or one of the business's questions.
export type BookingFormFieldType =
  "name" | "email" | "phone" | "location" | "details" | `answer:${string}`;

export type BookingFormErrorType = { field: BookingFormFieldType; message: string };
