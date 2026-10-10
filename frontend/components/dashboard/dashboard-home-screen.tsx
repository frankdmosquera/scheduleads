// Frontend component: Setup, once everything is resolved: the business, its plan, who you are, its
// services, the calendar and email cards.

"use client";

import Link from "next/link";

import { CalendarConnectionCard } from "@/components/calendar/calendar-connection-card";
import { BusinessInitialMark } from "@/components/dashboard/business-initial-mark";
import { EmailSendingCard } from "@/components/email-sending/email-sending-card";
import { BookingLinksList } from "@/components/booking-links/booking-links-list";
import type { MeType } from "@/lib/api-client/dashboard/fetch-me";
import { authClient } from "@/lib/auth-client";
import { isPlatformAdmin } from "@/lib/is-platform-admin";

export function DashboardHomeScreen({ me }: { me: MeType }) {
  const { data: session } = authClient.useSession();

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <div className="rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-md)]">
          <div className="flex items-center gap-3">
            <BusinessInitialMark name={me.organization.name} />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
                {me.organization.name}
              </h1>
              <p className="font-mono text-xs text-muted-foreground">{me.organization.plan}</p>
            </div>
          </div>

          <dl className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border text-sm">
            <DashboardFactRow label="Signed in as" value={me.user.name || me.user.email} />
            <DashboardFactRow label="Your role" value={me.role} />
            <DashboardFactRow label="Address" value={me.organization.slug} mono />
            <DashboardFactRow label="Plan" value={me.organization.plan} mono />
            <DashboardFactRow
              label="Included"
              value={me.limits.modules.length > 0 ? me.limits.modules.join(", ") : "nothing"}
            />
          </dl>

          <p className="mt-6 text-sm leading-6 text-muted-foreground">
            Every figure above came from one call to the API, scoped to this business by your
            session. Every lead is on the Leads screen.
          </p>
        </div>

        <BookingLinksList businessSlug={me.organization.slug} />

        <CalendarConnectionCard />

        <EmailSendingCard />

        {isPlatformAdmin(session?.user) ? (
          <div className="mt-4 flex justify-center text-sm text-muted-foreground">
            <Link
              href="/admin/client-setup"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Set up a client
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// One fact about the business, its name on the left.
function DashboardFactRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-4 bg-card px-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "truncate font-mono text-foreground" : "truncate text-foreground"}>
        {value}
      </dd>
    </div>
  );
}
