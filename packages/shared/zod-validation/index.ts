// Shared: every Zod validation schema, so one import reaches them all:
// import { signInEmailValidationSchema } from "@scheduleads-app/shared/zod-validation";

export * from "./auth-validation-schemas/email-address-validation-schema.js";
export * from "./auth-validation-schemas/sign-in-email-validation-schema.js";
export * from "./auth-validation-schemas/sign-in-code-validation-schema.js";
export * from "./organization-validation-schemas/business-name-validation-schema.js";
export * from "./organization-validation-schemas/organization-slug-validation-schema.js";
export * from "./organization-validation-schemas/business-email-details-validation-schema.js";
export * from "./organization-validation-schemas/email-sending-key-validation-schema.js";
export * from "./organization-validation-schemas/email-sending-validation-schema.js";
export * from "./admin-validation-schemas/provision-client-validation-schema.js";
export * from "./admin-validation-schemas/client-setup-validation-schema.js";
export * from "./crm-validation-schemas/contact-validation-schema.js";
export * from "./crm-validation-schemas/add-lead-validation-schema.js";
export * from "./crm-validation-schemas/next-step-validation-schema.js";
export * from "./booking-links-validation-schemas/booking-link-id-validation-schema.js";
export * from "./booking-links-validation-schemas/free-times-query-validation-schema.js";
export * from "./booking-links-validation-schemas/create-booking-validation-schema.js";
export * from "./booking-links-validation-schemas/move-booking-validation-schema.js";
export * from "./booking-links-validation-schemas/service-validation-schema.js";
export * from "./booking-links-validation-schemas/save-service-resources-validation-schema.js";
export * from "./resource-validation-schemas/resource-validation-schema.js";
export * from "./availability-validation-schemas/weekly-hours-validation-schema.js";
export * from "./availability-validation-schemas/date-hours-validation-schema.js";
export * from "./availability-validation-schemas/availability-rule-validation-schema.js";
export * from "./text-validation-schemas/text-settings-validation-schema.js";
export * from "./text-validation-schemas/worker-text-settings-validation-schema.js";
