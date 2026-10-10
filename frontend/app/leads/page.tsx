// Frontend page /leads: every lead of the business, inside the signed-in frame.

"use client";

import { DashboardGate } from "@/components/dashboard/dashboard-gate";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { LeadsListScreen } from "@/components/leads/leads-list-screen";

export default function LeadsPage() {
  return (
    <DashboardGate>
      {(me) => (
        <DashboardShell me={me}>
          <LeadsListScreen />
        </DashboardShell>
      )}
    </DashboardGate>
  );
}
