// Frontend page / : Setup, the business's cards (its services, the calendar and email cards).

"use client";

import { useMe } from "@/components/dashboard/dashboard-gate";
import { DashboardHomeScreen } from "@/components/dashboard/dashboard-home-screen";

export default function DashboardPage() {
  return <DashboardHomeScreen me={useMe()} />;
}
