// Frontend component: what a leads screen shows when the API says no: the sign-in has ended (with
// the way back), or the business may not see leads.

import Link from "next/link";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";

export function LeadsRefusalNotice({
  refusal,
}: {
  refusal: { state: "signed-out" } | { state: "refused"; message: string };
}) {
  if (refusal.state === "refused") return <CentredCardNotice>{refusal.message}</CentredCardNotice>;
  return (
    <div>
      <CentredCardNotice>Your sign-in has ended.</CentredCardNotice>
      <Link href="/sign-in" className="mt-4 inline-block text-sm underline underline-offset-2">
        Sign in again
      </Link>
    </div>
  );
}
