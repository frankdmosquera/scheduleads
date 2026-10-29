// Backend: the owner's Settings pages: Hours (feature 12a), Services and People (12d), Days off
// (12e), the Booking form (12f), Texts (12g). The business always comes from the session, never
// from the request; any member may read, only a role that may change the business may save.

import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { validator } from "hono/validator";
import type { ZodError } from "zod";

import {
  bookingFormRulesValidationSchema,
  bookingQuestionsValidationSchema,
  saveWorkerTextsValidationSchema,
  textChoicesValidationSchema,
  businessHoursValidationSchema,
  addResourceValidationSchema,
  closeDayValidationSchema,
  holidayPicksValidationSchema,
  openClosedDayValidationSchema,
  personHoursValidationSchema,
  saveBusinessColoursValidationSchema,
  saveCurrencyValidationSchema,
  savePersonSkillsValidationSchema,
  savePlaceServicesValidationSchema,
  saveResourceValidationSchema,
  saveServiceResourcesValidationSchema,
  serviceValidationSchema,
} from "@scheduleads-app/shared/zod-validation";

import { db } from "../database.js";
import {
  hasBusinessPermission,
  type PermissionsType,
} from "../lib/auth/has-business-permission.js";
import { refuse } from "../lib/errors/refuse.js";
import { addResource } from "../lib/settings/add-resource.js";
import { addService } from "../lib/settings/add-service.js";
import { closeDay } from "../lib/settings/close-day.js";
import { findBookingForm } from "../lib/settings/find-booking-form.js";
import { findTextsSettings } from "../lib/settings/find-texts-settings.js";
import { findDaysOff } from "../lib/settings/find-days-off.js";
import { findHolidayChoices } from "../lib/settings/find-holiday-choices.js";
import { holidayPackage, type HolidayLanguageType } from "../lib/bookable-hours/holiday-package.js";
import { findHoursSettings } from "../lib/settings/find-hours-settings.js";
import { findPeopleSettings } from "../lib/settings/find-people-settings.js";
import { findPlacesSettings } from "../lib/settings/find-places-settings.js";
import { findServicesSettings } from "../lib/settings/find-services-settings.js";
import { openClosedDay } from "../lib/settings/open-closed-day.js";
import { refuseHolidayPicks } from "../lib/settings/refuse-holiday-picks.js";
import { saveBookingFormRules } from "../lib/settings/save-booking-form-rules.js";
import { saveBookingQuestions } from "../lib/settings/save-booking-questions.js";
import { saveTexts } from "../lib/settings/save-texts.js";
import { saveWorkerTexts } from "../lib/settings/save-worker-texts.js";
import { saveBusinessHours } from "../lib/settings/save-business-hours.js";
import { saveHolidayPicks } from "../lib/settings/save-holiday-picks.js";
import { savePersonHours } from "../lib/settings/save-person-hours.js";
import { savePersonSkills } from "../lib/settings/save-person-skills.js";
import { savePlaceServices } from "../lib/settings/save-place-services.js";
import { saveResource } from "../lib/settings/save-resource.js";
import { deleteFromImageKit } from "../lib/images/delete-from-imagekit.js";
import { ImageKitKeyMissingError } from "../lib/images/imagekit-key-missing-error.js";
import { readUploadedPicture } from "../lib/images/read-uploaded-picture.js";
import { uploadToImageKit, type StoredPictureType } from "../lib/images/upload-to-imagekit.js";
import { findLookSettings } from "../lib/settings/find-look-settings.js";
import { replaceBusinessLogo } from "../lib/settings/replace-business-logo.js";
import { saveBusinessColours } from "../lib/settings/save-business-colours.js";
import { replaceServiceImage } from "../lib/settings/replace-service-image.js";
import { serviceExistsHere } from "../lib/settings/service-exists-here.js";
import { saveService } from "../lib/settings/save-service.js";
import { saveServicesCurrency } from "../lib/settings/save-services-currency.js";
import { saveServiceHours } from "../lib/settings/save-service-hours.js";
import { saveServiceResources } from "../lib/settings/save-service-resources.js";
import { requireOrganizationMiddleware } from "../middleware/auth-middleware/require-organization-middleware.js";
import { requirePermissionMiddleware } from "../middleware/auth-middleware/require-permission-middleware.js";
import { requireKnownSubscriptionMiddleware } from "../middleware/subscription-middleware/require-known-subscription-middleware.js";
import { requireModuleMiddleware } from "../middleware/subscription-middleware/require-module-middleware.js";

const CHANGE_BUSINESS: PermissionsType = { organization: ["update"] };
const NO_BUSINESS_HOURS = refuse("no_business_hours", "Set the business's hours first.");
// Says which field, so the form shows it under the name rather than as a general failure.
const NAME_TAKEN = {
  ...refuse("name_taken", "Another person or place here already has that name."),
  field: "name",
};

// The language the Days off routes name holidays in (feature 12j): en when not given, en or es only.
const holidayLanguageOf = (language: unknown): HolidayLanguageType | null =>
  language === undefined || language === "" || language === "en"
    ? "en"
    : language === "es"
      ? "es"
      : null;

// A Days off answer with its closed holidays named in the language asked; the picks stay English.
const namedIn = <
  DaysOff extends {
    holidayCountry: string | null;
    holidayRegion: string | null;
    closedDays: { date: string; name: string | null }[];
  },
>(
  daysOff: DaysOff,
  language: HolidayLanguageType
): DaysOff => ({
  ...daysOff,
  closedDays: daysOff.closedDays.map((day) => ({
    ...day,
    name:
      day.name &&
      holidayPackage.nameOn(
        daysOff.holidayCountry,
        daysOff.holidayRegion,
        day.name,
        day.date,
        language
      ),
  })),
});

// The first problem, with where it is ("weeklyHours.mon.1"), so the form can show it in place.
const refuseFirstIssue = (c: Context, error: ZodError) => {
  const issue = error.issues[0];
  return c.json(
    {
      ...refuse("bad_request", issue?.message ?? "Check the form and try again."),
      field: issue?.path.join(".") ?? "",
    },
    400
  );
};

// A picture's form (feature 25e): one file of at most 1 MB, with a little room for the form around it.
const pictureBodyLimit = bodyLimit({
  maxSize: 1_100_000,
  onError: (c) =>
    c.json(refuse("bad_request", "That picture is over 1 MB. Choose a smaller one."), 413),
});

// Checks the sent picture and keeps it in ImageKit: what was stored, or the refusal to answer with.
async function storePicture(
  c: Context,
  organizationId: string,
  sent: unknown,
  name: "logo" | "service"
): Promise<StoredPictureType | Response> {
  const picture = await readUploadedPicture(sent);
  if (!picture.ok) return c.json(refuse("bad_request", picture.message), 400);
  try {
    return await uploadToImageKit(
      organizationId,
      picture.bytes,
      `${name}.${picture.kind.extension}`
    );
  } catch (error) {
    if (!(error instanceof ImageKitKeyMissingError))
      console.error("Storing a picture failed:", error);
    return c.json(refuse("unavailable", "The picture could not be saved. Try again shortly."), 503);
  }
}

// Saves where a stored picture is; when that save fails, the picture is deleted again, so a fault
// never leaves a file in ImageKit that nothing points at.
async function keepOrUndo<Answer>(stored: StoredPictureType, save: () => Promise<Answer>) {
  try {
    return await save();
  } catch (error) {
    await deleteFromImageKit(stored.fileId);
    throw error;
  }
}

export const settingsRoutes = new Hono()
  // The Hours section: the business's hours, null before the first save.
  .get(
    "/hours",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    async (c) => {
      const { organizationId } = c.get("organization");
      const [settings, canEdit] = await Promise.all([
        findHoursSettings(organizationId),
        hasBusinessPermission(c.req.raw.headers, organizationId, CHANGE_BUSINESS),
      ]);
      return c.json({ canEdit, ...settings }, 200);
    }
  )

  // The business's card. Never touches its closed days or holidays.
  .put(
    "/hours/business",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = businessHoursValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      // The answer lists the upcoming bookings the new hours leave outside; none is changed.
      const saved = await saveBusinessHours(
        c.get("organization").organizationId,
        c.req.valid("json"),
        new Date()
      );
      return c.json(saved, 200);
    }
  )

  // One person's card. Another business's person, a place or an unknown id: the same 404.
  .put(
    "/hours/people/:personId",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = personHoursValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const saved = await savePersonHours(
        c.get("organization").organizationId,
        c.req.param("personId"),
        c.req.valid("json"),
        new Date()
      );
      if (!saved.ok && saved.reason === "no_person")
        return c.json(refuse("not_found", "No person here."), 404);
      if (!saved.ok) return c.json(NO_BUSINESS_HOURS, 409);
      return c.json({ person: saved.person, outsideHours: saved.outsideHours }, 200);
    }
  )

  // The Services page: every service of the business, live or hidden, with who is ticked on each,
  // and every person and place to tick.
  .get(
    "/services",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    async (c) => {
      const { organizationId } = c.get("organization");
      const [settings, canEdit] = await Promise.all([
        findServicesSettings(organizationId),
        hasBusinessPermission(c.req.raw.headers, organizationId, CHANGE_BUSINESS),
      ]);
      return c.json({ canEdit, ...settings }, 200);
    }
  )

  .post(
    "/services",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = serviceValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const service = await addService(c.get("organization").organizationId, c.req.valid("json"));
      return c.json({ service }, 201);
    }
  )

  // The currency every price is in (feature 25d); null hides the prices and keeps them.
  .put(
    "/services/currency",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = saveCurrencyValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const saved = await saveServicesCurrency(
        c.get("organization").organizationId,
        c.req.valid("json")
      );
      return c.json(saved, 200);
    }
  )

  // A service's photo (feature 25e): one PNG, JPEG or WebP, checked, then kept in ImageKit; the
  // old one is deleted. Another business's service or an unknown id: the same 404, before any upload.
  .put(
    "/services/:serviceId/image",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    pictureBodyLimit,
    validator("form", (value) => ({ picture: value.picture })),
    async (c) => {
      const { organizationId } = c.get("organization");
      const serviceId = c.req.param("serviceId");
      if (!(await serviceExistsHere(organizationId, serviceId)))
        return c.json(refuse("not_found", "No service here."), 404);
      const stored = await storePicture(c, organizationId, c.req.valid("form").picture, "service");
      if (stored instanceof Response) return stored;
      const saved = await keepOrUndo(stored, () =>
        replaceServiceImage(organizationId, serviceId, stored)
      );
      if (!saved) {
        await deleteFromImageKit(stored.fileId); // the service went meanwhile
        return c.json(refuse("not_found", "No service here."), 404);
      }
      return c.json(saved, 200);
    }
  )
  .delete(
    "/services/:serviceId/image",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    async (c) => {
      const saved = await replaceServiceImage(
        c.get("organization").organizationId,
        c.req.param("serviceId"),
        null
      );
      if (!saved) return c.json(refuse("not_found", "No service here."), 404);
      return c.json(saved, 200);
    }
  )

  // The Look page (feature 25e): the business's logo, uploaded here and kept in ImageKit.
  .get(
    "/look",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    async (c) => {
      const { organizationId } = c.get("organization");
      const [look, canEdit] = await Promise.all([
        findLookSettings(organizationId),
        hasBusinessPermission(c.req.raw.headers, organizationId, CHANGE_BUSINESS),
      ]);
      return c.json({ canEdit, ...look }, 200);
    }
  )
  .put(
    "/look/logo",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    pictureBodyLimit,
    validator("form", (value) => ({ picture: value.picture })),
    async (c) => {
      const { organizationId } = c.get("organization");
      const stored = await storePicture(c, organizationId, c.req.valid("form").picture, "logo");
      if (stored instanceof Response) return stored;
      return c.json(
        await keepOrUndo(stored, () => replaceBusinessLogo(organizationId, stored)),
        200
      );
    }
  )
  // The business's three colours (feature 25e): saved together; text too faint to read is refused.
  .put(
    "/look/colours",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = saveBusinessColoursValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) =>
      c.json(
        await saveBusinessColours(c.get("organization").organizationId, c.req.valid("json")),
        200
      )
  )
  .delete(
    "/look/logo",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    async (c) => c.json(await replaceBusinessLogo(c.get("organization").organizationId, null), 200)
  )

  // Another business's service or an unknown id: the same 404.
  .put(
    "/services/:serviceId",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = serviceValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      // A new length lists the upcoming bookings that would no longer fit; none is changed.
      const saved = await saveService(
        c.get("organization").organizationId,
        c.req.param("serviceId"),
        c.req.valid("json"),
        new Date()
      );
      if (!saved) return c.json(refuse("not_found", "No service here."), 404);
      return c.json(saved, 200);
    }
  )

  // When a service runs: its own week, or null for whenever the business is open, and its one-off
  // dates. The answer lists its upcoming bookings the new hours leave outside; none is changed.
  // Another business's service or an unknown id: the same 404.
  .put(
    "/services/:serviceId/hours",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = personHoursValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const saved = await saveServiceHours(
        c.get("organization").organizationId,
        c.req.param("serviceId"),
        c.req.valid("json"),
        new Date()
      );
      if (!saved.ok && saved.reason === "no_service")
        return c.json(refuse("not_found", "No service here."), 404);
      if (!saved.ok) return c.json(NO_BUSINESS_HOURS, 409);
      return c.json({ hours: saved.hours, outsideHours: saved.outsideHours }, 200);
    }
  )

  // Who does a service: the ticks replace the ones before. A person or place of another business, or
  // one in the wrong list, is refused on its list and nothing changes.
  .put(
    "/services/:serviceId/resources",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = saveServiceResourcesValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const saved = await saveServiceResources(
        c.get("organization").organizationId,
        c.req.param("serviceId"),
        c.req.valid("json")
      );
      if (!saved.ok && saved.reason === "not_found")
        return c.json(refuse("not_found", "No service here."), 404);
      if (!saved.ok)
        return c.json({ ...refuse("bad_request", saved.message), field: saved.field }, 400);
      return c.json(saved.ticks, 200);
    }
  )

  // The People page: every person of the business, on or off, with what they can do and their hours.
  .get(
    "/people",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    async (c) => {
      const { organizationId } = c.get("organization");
      const [settings, canEdit] = await Promise.all([
        findPeopleSettings(organizationId),
        hasBusinessPermission(c.req.raw.headers, organizationId, CHANGE_BUSINESS),
      ]);
      return c.json({ canEdit, ...settings }, 200);
    }
  )

  // The Places page: every place of the business, on or off, with the services that need each.
  .get(
    "/places",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    async (c) => {
      const { organizationId } = c.get("organization");
      const [settings, canEdit] = await Promise.all([
        findPlacesSettings(organizationId),
        hasBusinessPermission(c.req.raw.headers, organizationId, CHANGE_BUSINESS),
      ]);
      return c.json({ canEdit, ...settings }, 200);
    }
  )

  // The services that need a place: the ticks replace the ones before, and are the same rows as
  // each service's "Places it needs". Another business's place or an unknown id: the same 404; a
  // person's services are their skills, ticked on People.
  .put(
    "/places/:resourceId/services",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = savePlaceServicesValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const saved = await savePlaceServices(
        c.get("organization").organizationId,
        c.req.param("resourceId"),
        c.req.valid("json")
      );
      if (!saved.ok && saved.reason === "not_found")
        return c.json(refuse("not_found", "No place here."), 404);
      if (!saved.ok && saved.reason === "not_a_place")
        return c.json(
          refuse("bad_request", "A person's services are what they can do: tick them on People."),
          400
        );
      if (!saved.ok)
        return c.json(
          { ...refuse("bad_request", "Tick only this business's services."), field: "serviceIds" },
          400
        );
      return c.json({ serviceIds: saved.serviceIds }, 200);
    }
  )

  // Adds a person or a place: People adds people, Places adds places.
  .post(
    "/people",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = addResourceValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const added = await addResource(c.get("organization").organizationId, c.req.valid("json"));
      if (!added.ok) return c.json(NAME_TAKEN, 409);
      return c.json({ resource: added.resource }, 201);
    }
  )

  // Never deleted: off stops new bookings and the answer lists the ones they still hold. Another
  // business's person or place, or an unknown id: the same 404.
  .put(
    "/people/:resourceId",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = saveResourceValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const saved = await saveResource(
        c.get("organization").organizationId,
        c.req.param("resourceId"),
        c.req.valid("json"),
        new Date()
      );
      if (!saved.ok && saved.reason === "not_found")
        return c.json(refuse("not_found", "No person or place here."), 404);
      if (!saved.ok && saved.reason === "name_taken") return c.json(NAME_TAKEN, 409);
      if (!saved.ok && saved.reason === "bad_work_email")
        return c.json({ ...refuse("bad_request", saved.message), field: "workEmail" }, 400);
      if (!saved.ok && saved.reason === "no_sending_address")
        return c.json(
          {
            ...refuse("no_sending_address", "Set the business's sending address first."),
            field: "workEmail",
          },
          409
        );
      if (!saved.ok)
        return c.json(
          refuse("last_person", "Someone has to stay on: turn another person on first."),
          409
        );
      return c.json({ resource: saved.resource, upcomingBookings: saved.upcomingBookings }, 200);
    }
  )

  // What a person can do: the ticked services replace the ones before. A new one turns them on for
  // it, an unticked one off; the answer names the services left with nobody on. Another business's
  // person or an unknown id: the same 404; a place has no skills.
  .put(
    "/people/:resourceId/skills",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = savePersonSkillsValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const saved = await savePersonSkills(
        c.get("organization").organizationId,
        c.req.param("resourceId"),
        c.req.valid("json")
      );
      if (!saved.ok && saved.reason === "not_found")
        return c.json(refuse("not_found", "No person here."), 404);
      if (!saved.ok && saved.reason === "not_a_person")
        return c.json(refuse("bad_request", "A place has no skills: only people do."), 400);
      if (!saved.ok)
        return c.json(
          { ...refuse("bad_request", "Tick only this business's services."), field: "serviceIds" },
          400
        );
      return c.json({ ...saved.skills, nobodyOn: saved.nobodyOn }, 200);
    }
  )

  // A person's worker texts: on with a phone and three choices, or null to turn them off. Another
  // business's person or an unknown id: the same 404; a place gets no texts.
  .put(
    "/people/:resourceId/texts",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = saveWorkerTextsValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const saved = await saveWorkerTexts(
        c.get("organization").organizationId,
        c.req.param("resourceId"),
        c.req.valid("json")
      );
      if (!saved.ok && saved.reason === "not_found")
        return c.json(refuse("not_found", "No person here."), 404);
      if (!saved.ok && saved.reason === "a_place")
        return c.json(refuse("bad_request", "A place gets no texts: only people do."), 400);
      if (!saved.ok)
        return c.json(
          {
            ...refuse("bad_request", "That is a texting number, so texts cannot reach them there."),
            field: "texts.phone",
          },
          400
        );
      return c.json({ texts: saved.texts }, 200);
    }
  )

  // The Booking form page: the business's own questions in order, the ready-made sets, and what the
  // form requires (its contact rule, and the yes to later texts: null without text settings).
  .get(
    "/booking-form",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    async (c) => {
      const { organizationId } = c.get("organization");
      const [bookingForm, canEdit] = await Promise.all([
        findBookingForm(db, organizationId),
        hasBusinessPermission(c.req.raw.headers, organizationId, CHANGE_BUSINESS),
      ]);
      return c.json({ canEdit, ...bookingForm }, 200);
    }
  )

  // The business's questions, the whole list in its order. Another business's question, or an
  // unknown id: one 404, and nothing saved.
  .put(
    "/booking-form/questions",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = bookingQuestionsValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const saved = await saveBookingQuestions(
        c.get("organization").organizationId,
        c.req.valid("json")
      );
      if (!saved.ok)
        return c.json(
          refuse(
            "not_found",
            "These questions changed since you opened the page. Reload to see them."
          ),
          404
        );
      return c.json({ questions: saved.questions }, 200);
    }
  )

  // What the form requires: the contact rule and the yes to later texts, which needs text settings.
  .put(
    "/booking-form/rules",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = bookingFormRulesValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const saved = await saveBookingFormRules(
        c.get("organization").organizationId,
        c.req.valid("json")
      );
      if (!saved.ok)
        return c.json(
          refuse(
            "no_text_settings",
            "Set up texts for this business first: the yes is to texts it sends."
          ),
          409
        );
      return c.json(saved.rules, 200);
    }
  )

  // The Texts page: the business's texting number, the agency's, and its text choices; null when
  // the agency has not set its texts up yet.
  .get(
    "/texts",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    async (c) => {
      const { organizationId } = c.get("organization");
      const [texts, canEdit] = await Promise.all([
        findTextsSettings(db, organizationId),
        hasBusinessPermission(c.req.raw.headers, organizationId, CHANGE_BUSINESS),
      ]);
      return c.json({ canEdit, texts }, 200);
    }
  )

  // The text choices: the confirmation, the reminders and where replies go. Never the number.
  .put(
    "/texts",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = textChoicesValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const saved = await saveTexts(
        c.get("organization").organizationId,
        c.req.valid("json"),
        new Date()
      );
      if (!saved.ok && saved.reason === "no_text_settings")
        return c.json(
          refuse("no_text_settings", "Texts are not set up for your business yet."),
          409
        );
      if (!saved.ok)
        return c.json(
          {
            ...refuse("bad_request", "That is a texting number, so replies cannot go to it."),
            field: "replyPhone",
          },
          400
        );
      return c.json({ texts: saved.texts }, 200);
    }
  )

  // The Days off page: the closed days and holiday picks, every closed day for a year with who it is
  // opened for, and the people a day can be opened for.
  .get(
    "/days-off",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    validator("query", (value, c) => {
      const language = holidayLanguageOf(value.language);
      return language ? { language } : c.json(refuse("bad_request", "Use en or es."), 400);
    }),
    async (c) => {
      const { organizationId } = c.get("organization");
      const { language } = c.req.valid("query");
      const [daysOff, canEdit] = await Promise.all([
        findDaysOff(db, organizationId, new Date()),
        hasBusinessPermission(c.req.raw.headers, organizationId, CHANGE_BUSINESS),
      ]);
      return c.json({ canEdit, ...namedIn(daysOff, language) }, 200);
    }
  )

  // The holiday picks, saved; never the closed dates or the hours. Closing stops new bookings only:
  // the answer lists the upcoming ones on a day now closed, none changed.
  .put(
    "/days-off",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("query", (value, c) => {
      const language = holidayLanguageOf(value.language);
      return language ? { language } : c.json(refuse("bad_request", "Use en or es."), 400);
    }),
    validator("json", (value, c) => {
      const parsed = holidayPicksValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const { organizationId } = c.get("organization");
      const picks = c.req.valid("json");
      const refusal = await refuseHolidayPicks(organizationId, picks, new Date());
      if (refusal)
        return c.json({ ...refuse("bad_request", refusal.message), field: refusal.field }, 400);
      const saved = await saveHolidayPicks(organizationId, picks, new Date());
      if (!saved.ok) return c.json(NO_BUSINESS_HOURS, 409);
      const { language } = c.req.valid("query");
      return c.json(
        { daysOff: namedIn(saved.daysOff, language), newlyClosed: saved.newlyClosed },
        200
      );
    }
  )

  // The holiday picker: the countries offered, and with a country its provinces and its holidays
  // for the coming year (with a province, the province's too). Nothing picked: just the countries.
  .get(
    "/days-off/holidays",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    validator("query", (value, c) => {
      const { country, region } = value;
      if (Array.isArray(country) || Array.isArray(region) || (region && !country))
        return c.json(
          { ...refuse("bad_request", "A province needs its country."), field: "holidayRegion" },
          400
        );
      const language = holidayLanguageOf(value.language);
      if (!language) return c.json(refuse("bad_request", "Use en or es."), 400);
      return { country: country || null, region: region || null, language };
    }),
    async (c) => {
      const { country, region, language } = c.req.valid("query");
      const choices = await findHolidayChoices(
        c.get("organization").organizationId,
        country,
        region,
        new Date(),
        language
      );
      if (!choices.ok)
        return c.json({ ...refuse("bad_request", choices.message), field: choices.field }, 400);
      const { countries, regions, holidays } = choices;
      return c.json({ countries, regions, holidays }, 200);
    }
  )

  // Closes one day for everyone, taking back the business's own one-off hours on it, which would
  // keep it open. Lists the upcoming bookings left on it, none changed.
  .post(
    "/days-off/close",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("query", (value, c) => {
      const language = holidayLanguageOf(value.language);
      return language ? { language } : c.json(refuse("bad_request", "Use en or es."), 400);
    }),
    validator("json", (value, c) => {
      const parsed = closeDayValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const closed = await closeDay(
        c.get("organization").organizationId,
        c.req.valid("json").date,
        new Date()
      );
      if (!closed.ok) return c.json(NO_BUSINESS_HOURS, 409);
      const { language } = c.req.valid("query");
      return c.json(
        { daysOff: namedIn(closed.daysOff, language), newlyClosed: closed.newlyClosed },
        200
      );
    }
  )

  // Opens a closed day for one person (personId) or for everyone (null). Another business's person,
  // a place or an unknown id: the same 404.
  .post(
    "/days-off/open",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("query", (value, c) => {
      const language = holidayLanguageOf(value.language);
      return language ? { language } : c.json(refuse("bad_request", "Use en or es."), 400);
    }),
    validator("json", (value, c) => {
      const parsed = openClosedDayValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const opening = c.req.valid("json");
      const opened = await openClosedDay(c.get("organization").organizationId, opening, new Date());
      if (opened.ok)
        return c.json({ daysOff: namedIn(opened.daysOff, c.req.valid("query").language) }, 200);
      if (opened.reason === "no_person") return c.json(refuse("not_found", "No person here."), 404);
      if (opened.reason === "no_business_hours") return c.json(NO_BUSINESS_HOURS, 409);
      if (opened.reason === "not_closed")
        return c.json({ ...refuse("not_closed", "That day is not closed."), field: "date" }, 400);
      return c.json(
        refuse(
          "no_usual_hours",
          opening.personId === null
            ? "The business does not work that weekday: set that day's hours on Hours."
            : "They do not work that weekday: set their hours on Hours."
        ),
        409
      );
    }
  );
