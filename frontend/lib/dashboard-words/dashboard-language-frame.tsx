// Frontend component: marks the dashboard's pages with the language they speak (feature 12j), so a
// screen reader reads Spanish as Spanish. A box of its own, never a layout box.

"use client";

import type { ReactNode } from "react";

import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export function DashboardLanguageFrame({ children }: { children: ReactNode }) {
  const { language } = useDashboardWords();
  return (
    <div lang={language} className="contents">
      {children}
    </div>
  );
}
