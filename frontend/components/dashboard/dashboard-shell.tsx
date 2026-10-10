// Frontend component: the signed-in app's frame, as the mockups draw it: the business and the
// screens on the left, the page on the right. Only screens that exist are linked.

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { SignOutLink } from "@/components/auth/sign-out-link";
import { BusinessInitialMark } from "@/components/dashboard/business-initial-mark";
import type { MeType } from "@/lib/api-client/dashboard/fetch-me";

const SCREENS = [
  { href: "/leads", label: "Leads" },
  { href: "/", label: "Setup" },
];

export function DashboardShell({ me, children }: { me: MeType; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <aside className="flex flex-none flex-col gap-6 border-b border-border bg-card p-4 md:w-60 md:border-r md:border-b-0">
        <div className="flex items-center gap-3">
          <BusinessInitialMark name={me.organization.name} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">
              {me.organization.name}
            </div>
            <div className="font-mono text-xs text-muted-foreground">{me.organization.plan}</div>
          </div>
        </div>

        <nav className="flex gap-1 md:flex-col" aria-label="Screens">
          {SCREENS.map((screen) => {
            // "/" is only itself; every other screen also owns the pages under it.
            const current =
              screen.href === "/" ? pathname === "/" : pathname.startsWith(screen.href);
            return (
              <Link
                key={screen.href}
                href={screen.href}
                aria-current={current ? "page" : undefined}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:font-medium aria-[current=page]:text-foreground"
              >
                {screen.label}
              </Link>
            );
          })}
        </nav>

        <div className="text-sm text-muted-foreground md:mt-auto">
          <SignOutLink onSignedOut={() => router.push("/sign-in")} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
