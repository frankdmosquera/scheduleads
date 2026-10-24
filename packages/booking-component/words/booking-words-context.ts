// Booking component: the open window's words, given once by the window to every screen inside it.

"use client";

import type { BookingLanguageType } from "@scheduleads-app/shared/zod-validation";
import { createContext, useContext } from "react";

import type { BookingWordsType } from "./booking-words-type.js";
import { englishWords } from "./english-words.js";
import { spanishWords } from "./spanish-words.js";

export const wordsOf: Record<BookingLanguageType, BookingWordsType> = {
  en: englishWords,
  es: spanishWords,
};

export const BookingWordsContext = createContext<BookingWordsType>(englishWords);

export function useBookingWords(): BookingWordsType {
  return useContext(BookingWordsContext);
}
