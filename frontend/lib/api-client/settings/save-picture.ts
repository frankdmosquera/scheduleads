// Frontend: one picture saved or removed (feature 25e): the business's logo, or a service's photo.
// The answer is the picture's new address, or null once removed.

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { servicesSettingsRoute } from "@/lib/api-client/settings/fetch-services-settings";
import { lookSettingsRoute } from "@/lib/api-client/settings/fetch-look-settings";
import { readSaveRefusal, type SaveResultType } from "@/lib/api-client/settings/read-save-refusal";
import { inDashboardLanguage } from "@/lib/dashboard-words/message-language";

export type PictureTargetType = { kind: "logo" } | { kind: "service"; serviceId: string };

// picture null removes it.
export async function savePicture(
  target: PictureTargetType,
  picture: File | null
): Promise<SaveResultType<string | null>> {
  const imageRoute = servicesSettingsRoute[":serviceId"].image;
  const param = target.kind === "service" ? { serviceId: target.serviceId } : null;
  const sent =
    target.kind === "logo"
      ? picture
        ? lookSettingsRoute.logo.$put({ form: { picture } })
        : lookSettingsRoute.logo.$delete()
      : picture
        ? imageRoute.$put({ param: param!, form: { picture } })
        : imageRoute.$delete({ param: param! });
  const response = await sent.catch(() => null);
  if (!response) return { state: "refused", message: inDashboardLanguage(apiNotRespondingMessage) };
  if (response.status !== 200) return readSaveRefusal(response);
  const answer = (await response.json()) as { logo?: string | null; imageUrl?: string | null };
  return { state: "ok", answer: (target.kind === "logo" ? answer.logo : answer.imageUrl) ?? null };
}
