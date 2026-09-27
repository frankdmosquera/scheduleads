// Shared: the database tables, imported by the backend as @scheduleads-app/shared/db.
// Lives here so only one place can generate migrations. One table per file, in a folder
// per area: auth-tables/ are Better Auth's, booking-tables/ are the booking model's.
// Every timestamp keeps its time zone: a booking product that loses it double-books.

export * from "./auth-tables/user-table.js";
export * from "./auth-tables/session-table.js";
export * from "./auth-tables/account-table.js";
export * from "./auth-tables/verification-table.js";
export * from "./auth-tables/organization-table.js";
export * from "./auth-tables/member-table.js";
export * from "./auth-tables/invitation-table.js";
export * from "./booking-tables/resource-table.js";
export * from "./booking-tables/booking-link-table.js";
export * from "./booking-tables/availability-rule-table.js";
