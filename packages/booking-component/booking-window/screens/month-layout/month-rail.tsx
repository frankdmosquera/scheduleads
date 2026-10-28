// Booking component: the month layout's left rail, the same on every screen: whose booking, what,
// how long, its price when it has one (feature 25d), and its photo above (feature 25e). Each
// screen adds its own part below (the person choice, or the picked time).

import type { ReactNode } from "react";

import type {
  BookingBusinessType,
  BookingServiceDetailsType,
} from "../../../api-client/booking-api-types.js";
import { useBookingWords } from "../../../words/booking-words-context.js";
import { priceText } from "../price-text.js";
import { sizedPicture } from "../sized-picture.js";

export type MonthRailPropsType = {
  business: BookingBusinessType;
  service: BookingServiceDetailsType;
  back: { label: string; onBack(): void } | null;
  children?: ReactNode;
};

export function MonthRail({ business, service, back, children }: MonthRailPropsType) {
  const words = useBookingWords();
  const price = priceText(service.price, words);
  return (
    <aside className="sa-rail">
      <div className="sa-rail-logo">
        {business.logo ? (
          <img src={business.logo} alt={business.name} />
        ) : (
          <span className="sa-rail-wordmark">{business.name}</span>
        )}
      </div>
      {service.imageUrl && (
        <img className="sa-rail-photo" src={sizedPicture(service.imageUrl, "w-640,h-360")} alt="" />
      )}
      <div className="sa-rail-body">
        {back && (
          <button
            type="button"
            className="sa-rail-back"
            aria-label={back.label}
            onClick={back.onBack}
          >
            &#8249;
          </button>
        )}
        <div className="sa-rail-event">{service.name}</div>
        <div className="sa-facts">
          <div className="sa-fact">
            <span className="sa-fact-i" aria-hidden="true">
              &#9201;
            </span>
            <span>{words.minutes(service.durationMinutes)}</span>
          </div>
          {price && (
            <div className="sa-fact sa-fact--price">
              <span className="sa-fact-i" aria-hidden="true">
                &#127991;
              </span>
              <span>{price}</span>
            </div>
          )}
        </div>
        {service.description && <p className="sa-rail-where">{service.description}</p>}
        {children}
      </div>
    </aside>
  );
}
