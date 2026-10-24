// Frontend layout for every signed-in screen (Setup, Leads, a lead): the sign-in check and the
// sidebar, mounted once, so moving between screens keeps both in place.

"use client";

import type { ReactNode } from "react";

import { DashboardGate } from "@/components/dashboard/dashboard-gate";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardLanguageFrame } from "@/lib/dashboard-words/dashboard-language-frame";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardLanguageFrame>
      <DashboardGate>
        <DashboardShell>{children}</DashboardShell>
      </DashboardGate>
    </DashboardLanguageFrame>
  );
}
