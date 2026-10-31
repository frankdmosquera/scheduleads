import type { ChatLanguageType } from "../words/chat-words-type.js";
import {
  createBooking,
  readBookingForm,
  readFreeTimes,
  type BookingAccountType,
  type BookingFormType,
  type BookingRequestType,
  type BookingResultType,
  type FreeTimesType,
} from "./booking-api.js";

/** The business's booking routes for one chat, with what was read kept a few minutes. */
export interface BookingSourceType {
  form(): Promise<BookingFormType>;
  /** 31 dates of a service's free times from `from` (YYYY-MM-DD). */
  times(serviceId: string, from: string, language: ChatLanguageType): Promise<FreeTimesType>;
  book(request: BookingRequestType): Promise<BookingResultType>;
  /** Drops what was read: the next read asks the CRM again. */
  forget(): void;
}

// Read once for the whole conversation; dropped when a read fails, after any booking try, and after a few minutes,
// so a tab left open never offers a time that has passed.
const FRESH_MS = 5 * 60_000;
const DATES_ASKED = 31;

export function createBookingSource(
  account: BookingAccountType,
  fetchFn: typeof fetch = (input, init) => fetch(input, init),
  now: () => number = Date.now
): BookingSourceType {
  let form: Promise<BookingFormType> | null = null;
  const times = new Map<string, Promise<FreeTimesType>>();
  let readAt = 0;
  const forget = () => {
    form = null;
    times.clear();
  };
  const fresh = () => {
    if (now() - readAt > FRESH_MS) forget();
    if (!form && !times.size) readAt = now();
  };
  return {
    form() {
      fresh();
      form ??= readBookingForm(account, fetchFn).catch((error: unknown) => {
        form = null;
        throw error;
      });
      return form;
    },
    times(serviceId, from, language) {
      fresh();
      const key = `${serviceId}:${from}:${language}`;
      let read = times.get(key);
      if (!read) {
        const [year, month, date] = from.split("-").map(Number);
        const to = new Date(Date.UTC(year, month - 1, date + DATES_ASKED - 1))
          .toISOString()
          .slice(0, 10);
        read = readFreeTimes(account, serviceId, from, to, language, fetchFn).catch(
          (error: unknown) => {
            times.delete(key);
            throw error;
          }
        );
        times.set(key, read);
      }
      return read;
    },
    async book(request) {
      try {
        return await createBooking(account, request, fetchFn);
      } finally {
        // Booked, taken or unknown: the times read before are stale.
        forget();
      }
    },
    forget,
  };
}
