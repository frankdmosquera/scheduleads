// Frontend: the booking preview's stand-in host page. A Book now that names no service, one per
// service, and a switch between the agency's look and Primo's. Shown to the platform admin only.

"use client";

import { BookingProvider, BookNowTrigger } from "@frankdmosquera/booking-component";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";

import {
  fetchBookingLinks,
  type BookingLinksResultType,
} from "@/lib/api-client/booking-links/fetch-booking-links";
import { API_URL, authClient } from "@/lib/auth-client";
import { isPlatformAdmin } from "@/lib/is-platform-admin";

export type BookingPreviewViewerType = "checking" | "platform-admin" | "someone-else";

export type BookingPreviewLookType = "agency" | "primo";

const looks: { look: BookingPreviewLookType; label: string }[] = [
  { look: "agency", label: "Agency" },
  { look: "primo", label: "Primo" },
];

export type BookingPreviewScreenPropsType = { businessSlug: string };

export function BookingPreviewScreen({ businessSlug }: BookingPreviewScreenPropsType) {
  const [viewer, setViewer] = useState<BookingPreviewViewerType>("checking");
  const [services, setServices] = useState<BookingLinksResultType | null>(null);
  const [look, setLook] = useState<BookingPreviewLookType>("agency");

  useEffect(() => {
    let live = true; // a late answer never updates a page the user already left
    authClient.getSession().then(({ data }) => {
      if (live) setViewer(isPlatformAdmin(data?.user) ? "platform-admin" : "someone-else");
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (viewer !== "platform-admin") return;
    let live = true;
    fetchBookingLinks(businessSlug).then((result) => {
      if (live) setServices(result);
    });
    return () => {
      live = false;
    };
  }, [viewer, businessSlug]);

  // Nothing at all while the session is checked: the page must not show it exists.
  if (viewer === "checking") return null;
  if (viewer === "someone-else") notFound();

  return (
    <div className={`booking-preview booking-preview--${look}`}>
      <BookingProvider apiUrl={API_URL} slug={businessSlug}>
        <div className="booking-preview-note">
          <b>Booking preview</b>
          <span>{businessSlug}</span>
          <fieldset className="booking-preview-looks">
            <legend className="sr-only">Look</legend>
            {looks.map((option) => (
              <label key={option.look}>
                <input
                  type="radio"
                  name="booking-preview-look"
                  value={option.look}
                  checked={look === option.look}
                  onChange={() => setLook(option.look)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
        </div>

        <header className="booking-preview-top">
          <span className="booking-preview-wordmark">A client&apos;s site</span>
          <BookNowTrigger className="booking-preview-button">Book now</BookNowTrigger>
        </header>

        <section className="booking-preview-hero">
          <h1>Work done properly, booked in a minute.</h1>
          <p>
            A stand-in for a client&apos;s own page. The header&apos;s Book now opens the list; each
            service&apos;s own button opens that service.
          </p>
        </section>

        {services?.state === "ok" && services.bookingLinks.length > 0 ? (
          <section className="booking-preview-services" aria-label="Services">
            {services.bookingLinks.map((service) => (
              <article key={service.id} className="booking-preview-service">
                <h2>{service.name}</h2>
                <p>{service.durationMinutes} min</p>
                <BookNowTrigger
                  bookingId={service.id}
                  className="booking-preview-button"
                  ariaLabel={`Book now: ${service.name}`}
                >
                  Book now
                </BookNowTrigger>
              </article>
            ))}
          </section>
        ) : services ? (
          <p className="booking-preview-empty">
            {services.state === "unreachable"
              ? services.message
              : "This business lists no services."}
          </p>
        ) : null}
      </BookingProvider>
    </div>
  );
}
