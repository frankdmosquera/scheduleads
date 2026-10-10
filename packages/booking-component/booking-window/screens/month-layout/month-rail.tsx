// Booking component: the month layout's left rail, the same on both screens: whose booking, what,
// how long. Each screen adds its own part below (the person choice, or the picked time).

import type { ReactNode } from "react";

import type {
  BookingBusinessType,
  BookingServiceDetailsType,
} from "../../../api-client/booking-api-types.js";

export type MonthRailPropsType = {
  business: BookingBusinessType;
  service: BookingServiceDetailsType;
  back: { label: string; onBack(): void } | null;
  children?: ReactNode;
};

export function MonthRail({ business, service, back, children }: MonthRailPropsType) {
  return (
    <aside className="sa-rail">
      <div className="sa-rail-logo">
        {business.logo ? (
          <img src={business.logo} alt={business.name} />
        ) : (
          <span className="sa-rail-wordmark">{business.name}</span>
        )}
      </div>
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
            <span>{service.durationMinutes} min</span>
          </div>
        </div>
        {service.description && <p className="sa-rail-where">{service.description}</p>}
        {children}
      </div>
    </aside>
  );
}
