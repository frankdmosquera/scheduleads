// Frontend page /settings: opens the first section, Hours.

import { redirect } from "next/navigation";

export default function SettingsPage() {
  redirect("/settings/hours");
}
