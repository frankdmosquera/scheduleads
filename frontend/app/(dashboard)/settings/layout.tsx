// Frontend layout for every Settings page: its title and the list of sections.

import type { ReactNode } from "react";

import { SettingsFrame } from "@/components/settings/settings-frame";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <SettingsFrame>{children}</SettingsFrame>;
}
