// Frontend: the booking preview's stand-in host page. A Book now that names no service, one per
// service, and switches for the look (the agency's or Primo's), the window's language, and what
// happens after Book (feature 12i). Shown to the platform admin only.

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

const looks: { value: BookingPreviewLookType; label: string }[] = [
  { value: "agency", label: "Agency" },
  { value: "primo", label: "Primo" },
];

type PreviewLanguageType = "en" | "es";
const languages: { value: PreviewLanguageType; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

// After Book: the window's own confirmation, or this page again as the site's thank-you page.
type PreviewAfterType = "stay" | "thanks";
const afters: { value: PreviewAfterType; label: string }[] = [
  { value: "stay", label: "Stay" },
  { value: "thanks", label: "Thank-you page" },
];

export type BookingPreviewScreenPropsType = { businessSlug: string };

export function BookingPreviewScreen({ businessSlug }: BookingPreviewScreenPropsType) {
  const [viewer, setViewer] = useState<BookingPreviewViewerType>("checking");
  const [services, setServices] = useState<BookingLinksResultType | null>(null);
  const [look, setLook] = useState<BookingPreviewLookType>("agency");
  const [language, setLanguage] = useState<PreviewLanguageType>("en");
  const [after, setAfter] = useState<PreviewAfterType>("stay");
  // Set when the window sent the browser back here as the thank-you page. Read once, in the
  // browser; nothing is drawn before the session check, so the server's null never shows.
  const [thankedFor] = useState(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("booked")
  );

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
      <BookingProvider
        apiUrl={API_URL}
        slug={businessSlug}
        language={language}
        afterBooking={
          after === "stay"
            ? "stay"
            : {
                redirectTo: (booked) =>
                  `/admin/booking-preview/${businessSlug}?booked=${encodeURIComponent(booked.startsAt)}`,
              }
        }
      >
        <div className="booking-preview-note">
          <b>Booking preview</b>
          <span>{businessSlug}</span>
          <PreviewChoice legend="Look" options={looks} value={look} onChange={setLook} />
          <PreviewChoice
            legend="Language"
            options={languages}
            value={language}
            onChange={setLanguage}
          />
          <PreviewChoice legend="After Book" options={afters} value={after} onChange={setAfter} />
        </div>

        {thankedFor && (
          <p className="booking-preview-thanks" role="status">
            Thank-you page: the window sent you here after booking {thankedFor}.
          </p>
        )}

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

type PreviewChoicePropsType<ValueType extends string> = {
  legend: string;
  options: { value: ValueType; label: string }[];
  value: ValueType;
  onChange(value: NoInfer<ValueType>): void;
};

function PreviewChoice<ValueType extends string>({
  legend,
  options,
  value,
  onChange,
}: PreviewChoicePropsType<ValueType>) {
  return (
    <fieldset className="booking-preview-looks">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name={`booking-preview-${legend}`}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
