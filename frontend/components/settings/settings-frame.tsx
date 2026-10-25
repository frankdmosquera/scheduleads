// Frontend component: what every Settings page shares: its title and the list of sections, each
// its own page (feature 12d, decision 1). Each later Settings feature adds its entry here.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";
import type { SettingsFrameWordsType } from "@/lib/dashboard-words/settings-frame-words";

const SECTIONS: { href: string; label: keyof SettingsFrameWordsType }[] = [
  { href: "/settings/hours", label: "hours" },
  { href: "/settings/services", label: "services" },
  { href: "/settings/people", label: "people" },
  { href: "/settings/places", label: "places" },
  { href: "/settings/days-off", label: "daysOff" },
  { href: "/settings/booking-form", label: "bookingForm" },
  { href: "/settings/texts", label: "texts" },
  { href: "/settings/calendar", label: "calendar" },
];

export function SettingsFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { words } = useDashboardWords();
  const frameWords = words.settingsFrameWords;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{words.settings}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{frameWords.lede}</p>

      <div className="mt-8 grid items-start gap-6 md:grid-cols-[140px_minmax(0,1fr)]">
        <nav
          aria-label={frameWords.sectionsLabel}
          className="flex flex-wrap gap-1 md:sticky md:top-6 md:flex-col"
        >
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              aria-current={pathname.startsWith(section.href) ? "page" : undefined}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-[var(--accent-soft)] aria-[current=page]:font-medium aria-[current=page]:text-primary"
            >
              {frameWords[section.label]}
            </Link>
          ))}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
