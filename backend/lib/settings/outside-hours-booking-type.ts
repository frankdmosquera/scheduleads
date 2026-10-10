// Backend: one upcoming booking that a save of hours left outside them (feature 12a). Still booked.

export type OutsideHoursBookingType = {
  bookingId: string;
  leadId: string;
  customerName: string;
  serviceName: string;
  personName: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
};
