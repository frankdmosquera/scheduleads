// Booking component: the month layout's shell. The rail says whose booking and what; the panel is
// where the month and its times go (step 9.5).

import type {
  BookingBusinessType,
  BookingServiceDetailsType,
} from "../../../api-client/booking-api-types.js";

export type MonthServiceScreenPropsType = {
  business: BookingBusinessType;
  service: BookingServiceDetailsType;
  titleId: string;
  onBack: (() => void) | null;
};

export function MonthServiceScreen({
  business,
  service,
  titleId,
  onBack,
}: MonthServiceScreenPropsType) {
  return (
    <div className="sa-book">
      <aside className="sa-rail">
        <div className="sa-rail-logo">
          {business.logo ? (
            <img src={business.logo} alt={business.name} />
          ) : (
            <span className="sa-rail-wordmark">{business.name}</span>
          )}
        </div>
        <div className="sa-rail-body">
          {onBack && (
            <button
              type="button"
              className="sa-rail-back"
              aria-label="Back to services"
              onClick={onBack}
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
        </div>
      </aside>
      <div className="sa-panel">
        <h2 className="sa-panel-h" id={titleId} tabIndex={-1}>
          Select a date &amp; time
        </h2>
      </div>
    </div>
  );
}
