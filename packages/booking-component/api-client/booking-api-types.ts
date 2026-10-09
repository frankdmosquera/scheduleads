// Booking component: the shapes the public routes answer with, read from the routes' own types.

import type { hc, InferResponseType } from "hono/client";

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
