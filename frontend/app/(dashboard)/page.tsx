// Frontend page / : Setup, the business's cards (its services, the calendar and email cards),
// inside the signed-in frame.

"use client";

import { DashboardGate } from "@/components/dashboard/dashboard-gate";
import { DashboardHomeScreen } from "@/components/dashboard/dashboard-home-screen";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function DashboardPage() {
  return (
    <DashboardGate>
      {(me) => (
        <DashboardShell me={me}>
          <DashboardHomeScreen me={me} />
        </DashboardShell>
      )}
    </DashboardGate>
  );
}
