// Frontend component: the one way every unhappy state is said, an error or a piece of information.

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Every unhappy state renders through this, so they all read the same way.
export function CentredCardNotice({
  tone = "error",
  children,
}: {
  tone?: "error" | "info";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        tone === "error"
          ? "bg-[var(--lost-soft)] text-[var(--lost)]"
          : "bg-[var(--info-soft)] text-[var(--info)]"
      )}
    >
      {children}
    </p>
  );
}
