// Booking component: the booking window, a native <dialog> (decision 10): the browser gives the
// focus trap, Escape and the inert page behind it. Mounted only while open.

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import type {
  BookingApiClientType,
  BookingBusinessType,
  BookingServiceType,
} from "../api-client/booking-api-types.js";
import { fetchOneService } from "../api-client/fetch-one-service.js";
import { fetchServiceList } from "../api-client/fetch-service-list.js";
import { BookingProblemScreen } from "./screens/booking-problem-screen.js";
import { bookingProblemScreen } from "./booking-problem-screen-state.js";
import type { BookingScreenType } from "./booking-screen-type.js";
import { LoadingScreen } from "./screens/loading-screen.js";
import { ServiceListScreen } from "./screens/service-list-screen.js";
import { DetailsScreen } from "./screens/details-screen.js";
import { ServiceScreen } from "./screens/service-screen.js";
import { worstBookingProblem } from "./worst-booking-problem.js";

export type BookingWindowPropsType = {
  apiClient: BookingApiClientType;
  slug: string;
  bookingId: string | undefined;
  onClosed(): void;
};

export function BookingWindow({ apiClient, slug, bookingId, onClosed }: BookingWindowPropsType) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [screen, setScreen] = useState<BookingScreenType>({ screen: "loading" });
  // Every load takes a number; an answer to an older one (a retry, another pick, a close) is dropped.
  const latestLoad = useRef(0);

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

  return (
    <dialog
      ref={dialogRef}
      className="sa-dialog"
      aria-labelledby={titleId}
      onClose={() => {
        latestLoad.current++;
        onClosed();
      }}
    >
      <div
        className={
          screen.screen === "service" || screen.screen === "details"
            ? "sa-modal sa-modal--book"
            : "sa-modal"
        }
      >
        <button
          type="button"
          className="sa-x sa-x--corner"
          aria-label="Close"
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
            business={screen.business}
            service={screen.service}
            availability={screen.availability}
            chosen={screen.chosen}
            titleId={titleId}
            onBack={() => {
              const { chosen, ...oneService } = screen;
              setScreen({ ...oneService, screen: "service", place: chosen.place });
            }}
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
  );
}
