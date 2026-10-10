// Frontend page /leads/[leadId]: one lead's page.

"use client";

import { useParams } from "next/navigation";

import { LeadPageScreen } from "@/components/leads/lead-page-screen";

export default function LeadPage() {
  const { leadId } = useParams<{ leadId: string }>();
  return <LeadPageScreen leadId={leadId} />;
}
