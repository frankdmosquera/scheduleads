// Booking component: the booking window, a native <dialog> (decision 10): the browser gives the
// focus trap, Escape and the inert page behind it. Mounted only while open.

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import type {
  BookingApiClientType,
  BookingBusinessType,
  BookingMadeType,
  BookingServiceType,
} from "../api-client/booking-api-types.js";
import type { AfterBookingType, BookedType } from "../booking-provider/after-booking-type.js";
import { BookingWordsContext } from "../words/booking-words-context.js";
import type { BookingWordsType } from "../words/booking-words-type.js";
import { fetchOneService } from "../api-client/fetch-one-service.js";
import { fetchServiceList } from "../api-client/fetch-service-list.js";
import { newBookingForm } from "./booking-form/new-booking-form.js";
import { BookingProblemScreen } from "./screens/booking-problem-screen.js";
import { themeStyle } from "./theme-style.js";
import { bookingProblemScreen } from "./booking-problem-screen-state.js";
import type { BookingScreenType } from "./booking-screen-type.js";
import { LoadingScreen } from "./screens/loading-screen.js";
import { ServiceListScreen } from "./screens/service-list-screen.js";
import { DetailsScreen } from "./screens/details-screen.js";
import { DoneScreen } from "./screens/done-screen.js";
import { ServiceScreen } from "./screens/service-screen.js";
import { worstBookingProblem } from "./worst-booking-problem.js";

export type BookingWindowPropsType = {
  apiClient: BookingApiClientType;
  slug: string;
  bookingId: string | undefined;
  words: BookingWordsType;
  afterBooking: AfterBookingType;
  onBooked: ((booked: BookedType) => void) | undefined;
  goTo(address: string): void; // the browser's own navigation; a test hands its own
  onClosed(): void;
};

export function BookingWindow({
  apiClient,
  slug,
  bookingId,
  words,
  afterBooking,
  onBooked,
  goTo,
  onClosed,
}: BookingWindowPropsType) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOutside = useRef(false); // the last press began and ended on the dark area
  const titleId = useId();
  const [screen, setScreen] = useState<BookingScreenType>({ screen: "loading" });
  // The business's colours, kept while a screen without the business (loading) shows, so the
  // window never flashes back to white between screens (feature 25e).
  const [keptTheme, setKeptTheme] = useState<BookingBusinessType["theme"] | null>(null);
  const shownTheme = "business" in screen && screen.business ? screen.business.theme : undefined;
  useEffect(() => {
    if (shownTheme !== undefined) setKeptTheme(shownTheme);
  }, [shownTheme]);
  // Every load takes a number; an answer to an older one (a retry, another pick, a close) is dropped.
  const latestLoad = useRef(0);
  // What she typed on screen two, kept while the window is open (a taken time keeps her words) and
  // new with each opening, so each opening is a new form with its own key.
  const [form, setForm] = useState(newBookingForm);

  const loadServices = useCallback(async () => {
    const load = ++latestLoad.current;
    setScreen({ screen: "loading" });
    const list = await fetchServiceList(apiClient, slug);
    if (load !== latestLoad.current) return;

    if (list.state === "problem") {
      setScreen(bookingProblemScreen(list.problem, null, loadServices));
    } else if (list.services.length === 0) {
      setScreen(bookingProblemScreen("nothing-to-book", list.business, loadServices));
    } else {
      setScreen({ screen: "services", business: list.business, services: list.services });
    }
  }, [apiClient, slug]);

  // A button that names its service: the business and the service are asked for together.
  const loadNamedService = useCallback(
    async (bookingLinkId: string) => {
      const load = ++latestLoad.current;
      setScreen({ screen: "loading" });
      const [list, one] = await Promise.all([
        fetchServiceList(apiClient, slug),
        fetchOneService(apiClient, slug, bookingLinkId),
      ]);
      if (load !== latestLoad.current) return;

      const business = list.state === "ok" ? list.business : null;
      const problem = worstBookingProblem([
        list.state === "problem" ? list.problem : null,
        one.state === "problem" ? one.problem : null,
      ]);
      if (problem || !business || one.state !== "ok") {
        const retry = () => void loadNamedService(bookingLinkId);
        setScreen(bookingProblemScreen(problem ?? "cannot-load", business, retry));
        return;
      }
      setScreen({
        screen: "service",
        business,
        service: one.service,
        availability: one.availability,
        pickedFrom: null,
        place: null,
        notice: null,
      });
    },
    [apiClient, slug]
  );

  // A service picked from the list: the business is already known.
  const loadPickedService = useCallback(
    async (
      business: BookingBusinessType,
      services: BookingServiceType[],
      bookingLinkId: string
    ) => {
      const load = ++latestLoad.current;
      setScreen({ screen: "loading" });
      const one = await fetchOneService(apiClient, slug, bookingLinkId);
      if (load !== latestLoad.current) return;

      if (one.state === "problem") {
        const retry = () => void loadPickedService(business, services, bookingLinkId);
        setScreen(bookingProblemScreen(one.problem, business, retry));
        return;
      }
      setScreen({
        screen: "service",
        business,
        service: one.service,
        availability: one.availability,
        pickedFrom: services,
        place: null,
        notice: null,
      });
    },
    [apiClient, slug]
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    if (bookingId === undefined) void loadServices();
    else void loadNamedService(bookingId);
    return () => {
      latestLoad.current++; // closed: no answer lands on a window that is gone
    };
  }, [bookingId, loadServices, loadNamedService]);

  // Each new screen is announced by moving focus to its heading. The first one keeps the
  // browser's own focus, on Close.
  const firstScreen = useRef(true);
  useEffect(() => {
    if (firstScreen.current) {
      firstScreen.current = false;
      return;
    }
    document.getElementById(titleId)?.focus();
  }, [screen, titleId]);

  // After a 201: the site hears of it, then the visitor stays on the confirmation or goes to the
  // site's page. The confirmation shows either way, so nothing waits on a blank form while the
  // browser leaves. A throwing onBooked still sends the visitor on (a broken count must not cost
  // the thank-you page); a throwing redirectTo leaves them on the confirmation. Never a second booking.
  const booked = (booking: BookingMadeType) => {
    const made: BookedType = {
      bookingId: booking.id,
      serviceName: booking.service.name,
      startsAt: booking.startsAt,
      timeZone: booking.timezone,
    };
    try {
      onBooked?.(made);
    } catch (error) {
      console.error("The site's onBooked failed:", error);
    }
    if (afterBooking === "stay") return;
    try {
      const { redirectTo } = afterBooking;
      goTo(typeof redirectTo === "function" ? redirectTo(made) : redirectTo);
    } catch (error) {
      console.error("The site's redirectTo failed:", error);
    }
  };

  return (
    <BookingWordsContext value={words}>
      <dialog
        ref={dialogRef}
        className="sa-dialog"
        style={themeStyle(shownTheme === undefined ? keptTheme : shownTheme)}
        lang={words.language}
        aria-labelledby={titleId}
        onClose={() => {
          latestLoad.current++;
          onClosed();
        }}
        // A tap on the dark area around the window closes it, as the X does (feature 25d, as on
        // Cal.com). Only a press that starts and ends there: a drag from inside out, or from
        // outside in, never closes it.
        onPointerDown={(event) => {
          pressedOutside.current = event.target === event.currentTarget;
        }}
        onPointerUp={(event) => {
          if (event.target !== event.currentTarget) pressedOutside.current = false;
        }}
        onClick={(event) => {
          if (pressedOutside.current && event.target === event.currentTarget) {
            event.currentTarget.close();
          }
          pressedOutside.current = false;
        }}
      >
        <div
          className={
            screen.screen === "service" || screen.screen === "details" || screen.screen === "done"
              ? "sa-modal sa-modal--book"
              : "sa-modal"
          }
        >
          <button
            type="button"
            className="sa-x sa-x--corner"
            aria-label={words.close}
            onClick={() => dialogRef.current?.close()}
          >
            &#10005;
          </button>

          {screen.screen === "loading" ? (
            <LoadingScreen titleId={titleId} />
          ) : screen.screen === "services" ? (
            <ServiceListScreen
              business={screen.business}
              services={screen.services}
              titleId={titleId}
              onPick={(bookingLinkId) =>
                void loadPickedService(screen.business, screen.services, bookingLinkId)
              }
            />
          ) : screen.screen === "service" ? (
            <ServiceScreen
              apiClient={apiClient}
              slug={slug}
              business={screen.business}
              service={screen.service}
              availability={screen.availability}
              place={screen.place}
              notice={screen.notice}
              titleId={titleId}
              onBack={
                screen.pickedFrom
                  ? () =>
                      setScreen({
                        screen: "services",
                        business: screen.business,
                        services: screen.pickedFrom ?? [],
                      })
                  : null
              }
              onTimeChosen={(chosen) => setScreen({ ...screen, screen: "details", chosen })}
            />
          ) : screen.screen === "details" ? (
            <DetailsScreen
              apiClient={apiClient}
              slug={slug}
              business={screen.business}
              service={screen.service}
              availability={screen.availability}
              chosen={screen.chosen}
              form={form}
              titleId={titleId}
              onFormChange={setForm}
              onBack={() => {
                const { chosen, ...oneService } = screen;
                setScreen({ ...oneService, screen: "service", place: chosen.place, notice: null });
              }}
              onBooked={(booking, email) => {
                const { chosen: _chosen, ...oneService } = screen;
                setScreen({ ...oneService, screen: "done", booking, email });
                booked(booking);
              }}
              onTimeTaken={(message) => {
                // Back to the same month and person, whose times load again without the taken one.
                const { chosen, ...oneService } = screen;
                setScreen({
                  ...oneService,
                  screen: "service",
                  place: chosen.place,
                  notice: message,
                });
              }}
            />
          ) : screen.screen === "done" ? (
            <DoneScreen
              business={screen.business}
              service={screen.service}
              booking={screen.booking}
              email={screen.email}
              titleId={titleId}
            />
          ) : (
            <BookingProblemScreen
              problem={screen.problem}
              business={screen.business}
              retry={screen.retry}
              titleId={titleId}
            />
          )}
        </div>
      </dialog>
    </BookingWordsContext>
  );
}
