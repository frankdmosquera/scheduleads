// Frontend components: the centred card, input and notice shared by sign-in, setting up a
// client and every refusal screen.

import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Deliberately plain: prototypes/ has no mockup for these screens.
export function AuthCard({
  title,
  lede,
  children,
  footer,
}: {
  title: string;
  lede?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-md)]">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {lede ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{lede}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? (
          <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>
        ) : null}
      </div>
    </main>
  );
}

// One labelled input with its error, on shadcn's Input and Label (the Forms standard). Every
// form spreads react-hook-form's Controller field into it; the error is linked for screen readers.
export function Field({
  id,
  label,
  error,
  className,
  ...props
}: {
  id: string;
  label: string;
  error?: string;
} & React.ComponentProps<typeof Input>) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn("h-10 bg-muted px-3", className)}
      />
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Every unhappy state renders through this, so they all read the same way.
export function Notice({
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
