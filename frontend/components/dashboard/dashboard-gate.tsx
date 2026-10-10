// Frontend component: every signed-in page's first check. Reads GET /me once and shows one screen
// per answer (loading, signed out, pick a business, plan refused, API down); only a business that
// is all set reaches the page itself, which reads it with useMe(). Mounted once, in the signed-in
// layout, so moving between screens never asks again.

"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { CentredCard } from "@/components/centred-card/centred-card";
import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { BusinessPickerScreen } from "@/components/dashboard/business-picker-screen";
import { DashboardSignedOutScreen } from "@/components/dashboard/dashboard-signed-out-screen";
import { Button } from "@/components/ui/button";
import { fetchMe, type MeResultType, type MeType } from "@/lib/api-client/dashboard/fetch-me";

const MeContext = createContext<MeType | null>(null);

// The signed-in business, for any page inside the gate.
export function useMe(): MeType {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe ran outside DashboardGate.");
  return me;
}

export function DashboardGate({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<MeResultType | null>(null);

  // Bump to ask /me again: after picking a business, or on "Try again".
  const [reloads, setReloads] = useState(0);
  const reloadDashboard = () => setReloads((n) => n + 1);

  useEffect(() => {
    // `live` stops a late answer from updating a page the user already left.
    let live = true;

    fetchMe().then((next) => {
      if (live) setResult(next);
    });

    return () => {
      live = false;
    };
  }, [reloads]);

  if (!result) {
    return (
      <CentredCard title="One moment">
        <p className="text-sm text-muted-foreground">Loading your business…</p>
      </CentredCard>
    );
  }

  switch (result.state) {
    case "signed-out":
      return <DashboardSignedOutScreen />;

    case "no-organization":
      return <BusinessPickerScreen onPicked={reloadDashboard} />;

    case "plan-refused":
      return (
        <CentredCard
          title="This account needs attention"
          lede="Your business is on a plan this dashboard does not recognise, so there is nothing safe to show you."
          footer={<SignOutLink />}
        >
          <CentredCardNotice>{result.message}</CentredCardNotice>
          <p className="mt-4 text-sm text-muted-foreground">
            Nothing is lost. Get in touch and we will put the account back on the right plan.
          </p>
        </CentredCard>
      );

    case "unreachable":
      return (
        <CentredCard title="Cannot reach the API">
          <CentredCardNotice>{result.message}</CentredCardNotice>
          <Button className="mt-4 w-full" size="lg" onClick={reloadDashboard}>
            Try again
          </Button>
        </CentredCard>
      );

    case "ok":
      return <MeContext.Provider value={result.me}>{children}</MeContext.Provider>;
  }
}
