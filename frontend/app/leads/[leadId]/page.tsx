// Frontend page /leads/[leadId]: one lead's page, inside the signed-in frame.

"use client";

import { useParams } from "next/navigation";

import { DashboardGate } from "@/components/dashboard/dashboard-gate";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { LeadPageScreen } from "@/components/leads/lead-page-screen";

export default function LeadPage() {
  const { leadId } = useParams<{ leadId: string }>();

  return (
    <DashboardGate>
      {(me) => (
        <DashboardShell me={me}>
          <LeadPageScreen leadId={leadId} />
        </DashboardShell>
      )}
    </DashboardGate>
  );
}
