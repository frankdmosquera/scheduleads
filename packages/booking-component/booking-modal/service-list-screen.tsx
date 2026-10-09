// Booking component: the business's services, for a Book now that names none (decision 6). Every
// word from the business is rendered as text.

import type { BookingBusinessType, BookingServiceType } from "../api-client/booking-api-types.js";

export type ServiceListScreenPropsType = {
  business: BookingBusinessType;
  services: BookingServiceType[];
  titleId: string;
  onPick(bookingLinkId: string): void;
};

export function ServiceListScreen({
  business,
  services,
  titleId,
  onPick,
}: ServiceListScreenPropsType) {
  return (
    <>
      <div className="sa-head">
        <div>
          <h2 className="sa-title" id={titleId} tabIndex={-1}>
            Book with {business.name}
          </h2>
          <p className="sa-sub">Choose what you would like to book.</p>
        </div>
      </div>
      <div className="sa-body">
        <ul className="sa-services">
          {services.map((service) => (
            <li key={service.id}>
              <button type="button" className="sa-service" onClick={() => onPick(service.id)}>
                <span className="sa-service-name">{service.name}</span>
                <span className="sa-service-meta">{service.durationMinutes} min</span>
                {service.description && (
                  <span className="sa-service-desc">{service.description}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
