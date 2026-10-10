// Backend: every route a stranger may call from a browser, under /public, as one app. Its type is
// PublicAppType, so the booking component's typed client never sees an admin or dashboard route.

import { Hono } from "hono";

import { publicBookingLinksRoutes } from "./public-booking-links-routes.js";
import { publicBookingPageRoutes } from "./public-booking-page-routes.js";
import { publicBookingsRoutes } from "./public-bookings-routes.js";

export const publicRoutes = new Hono()
  .route("/public", publicBookingLinksRoutes)
  .route("/public", publicBookingsRoutes)
  .route("/public", publicBookingPageRoutes);
