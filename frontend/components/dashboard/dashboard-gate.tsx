// Frontend component: every signed-in page's first check. Reads GET /me once and shows one screen
// per answer (loading, signed out, pick a business, plan refused, API down); only a business that
// is all set reaches the page itself, which reads it with useMe(). Mounted once, in the signed-in
// layout, so moving between screens never asks again.

"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { CentredCard } from "@/components/centred-card/centred-card";
import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { BusinessPickerScreen } from "@/components/dashboard/business-picker-screen";
import { DashboardSignedOutScreen } from "@/components/dashboard/dashboard-signed-out-screen";
import { Button } from "@/components/ui/button";
import { fetchMe, type MeResultType, type MeType } from "@/lib/api-client/dashboard/fetch-me";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

const MeContext = createContext<MeType | null>(null);

// The signed-in business, for any page inside the gate.
export function useMe(): MeType {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe ran outside DashboardGate.");
  return me;
}

// Shows a newly saved main colour on the whole dashboard at once (feature 25e), without asking /me again.
const SetMainColourContext = createContext<(main: string | null) => void>(() => {});

export function useSetMainColour(): (main: string | null) => void {
  return useContext(SetMainColourContext);
}

export function DashboardGate({ children }: { children: ReactNode }) {
  const { words, showLoginLanguage, forgetLoginLanguage } = useDashboardWords();
  const [result, setResult] = useState<MeResultType | null>(null);

  // Bump to ask /me again: after picking a business, or on "Try again".
  const [reloads, setReloads] = useState(0);
  const reloadDashboard = () => setReloads((n) => n + 1);
  const setMainColour = useCallback(
    (main: string | null) =>
      setResult((now) =>
        now?.state === "ok"
          ? {
              ...now,
              me: { ...now.me, organization: { ...now.me.organization, mainColour: main } },
            }
          : now
      ),
    []
  );

  useEffect(() => {
    // `live` stops a late answer from updating a page the user already left.
    let live = true;

    fetchMe().then((next) => {
      if (!live) return;
      setResult(next);
      if (next.state === "ok") showLoginLanguage(next.me.user.language); // the login's own pick
      if (next.state === "signed-out") forgetLoginLanguage(); // its sign-in ended
    });

    return () => {
      live = false;
    };
  }, [reloads, showLoginLanguage, forgetLoginLanguage]);

  if (!result) {
    return (
      <CentredCard title={words.oneMoment}>
        <p className="text-sm text-muted-foreground">{words.loadingYourBusiness}</p>
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
          title={words.needsAttention}
          lede={words.planNotRecognisedLede}
          footer={<SignOutLink />}
        >
          <CentredCardNotice>{result.message}</CentredCardNotice>
          <p className="mt-4 text-sm text-muted-foreground">{words.nothingLost}</p>
        </CentredCard>
      );

    case "unreachable":
      return (
        <CentredCard title={words.cannotReachTheApi}>
          <CentredCardNotice>{result.message}</CentredCardNotice>
          <Button className="mt-4 w-full" size="lg" onClick={reloadDashboard}>
            {words.tryAgain}
          </Button>
        </CentredCard>
      );

    case "ok":
      return (
        <MeContext.Provider value={result.me}>
          <SetMainColourContext.Provider value={setMainColour}>
            {children}
          </SetMainColourContext.Provider>
        </MeContext.Provider>
      );
  }
}
