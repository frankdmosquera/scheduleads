// Booking component: the shapes the public routes answer with, read from the routes' own types.

import type { hc, InferRequestType, InferResponseType } from "hono/client";

import type { PublicAppType } from "backend/app-type";

// Written out, not inferred from createBookingApiClient, so its declaration can name it.
export type BookingApiClientType = ReturnType<typeof hc<PublicAppType>>;

type ServicesRouteType = BookingApiClientType["public"][":slug"]["booking-links"];

// The business's face (name, logo, phone) and its own questions.
export type BookingBusinessType = InferResponseType<ServicesRouteType["$get"], 200>["business"];

// One service in the list: name, duration and description.
export type BookingServiceType = InferResponseType<
  ServicesRouteType["$get"],
  200
>["bookingLinks"][number];

// One service with how its window looks and who picks the person.
export type BookingServiceDetailsType = InferResponseType<
  ServicesRouteType[":bookingLinkId"]["$get"],
  200
>["bookingLink"];

// The business's bookable hours for that service: its zone and how many days ahead it books.
export type BookingAvailabilityType = InferResponseType<
  ServicesRouteType[":bookingLinkId"]["$get"],
  200
>["availability"];

// The free start times for some dates, in the business's zone, with the people the customer may pick.
export type BookingFreeTimesType = InferResponseType<
  ServicesRouteType[":bookingLinkId"]["times"]["$get"],
  200
>;

// One free start time with the business's date and clock time, as the API worked them out.
export type BookingStartTimeType = BookingFreeTimesType["localStartTimes"][number];

type BookingsRouteType = BookingApiClientType["public"][":slug"]["bookings"];

// What Book sends: the time, the customer, her answers and the form's key.
export type BookingRequestType = InferRequestType<BookingsRouteType["$post"]>["json"];

// The booking made, as the route answers it: never the customer's own details.
export type BookingMadeType = InferResponseType<BookingsRouteType["$post"], 201>["booking"];
