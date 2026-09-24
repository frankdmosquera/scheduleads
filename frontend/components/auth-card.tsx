import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The centred card that sign-in, create-organization and every refusal
 * screen sit in.
 *
 * One component rather than three copies of the same markup. There is no
 * mockup for any of these screens in `prototypes/` - the ten that exist
 * are all signed-in CRM views - so this is deliberately plain: the
 * ported tokens, a card, and nothing invented on top of them.
 */

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

/**
 * A labelled input with its error message.
 *
 * The error is wired to the input through `aria-describedby` and
 * `aria-invalid` rather than only being painted red, so it reaches a
 * screen reader and not just a sighted user.
 */
export function Field({
  id,
  label,
  error,
  hint,
  className,
  ...props
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-10 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground",
          "placeholder:text-[var(--faint)]",
          "outline-none transition-colors",
          "focus-visible:border-[var(--accent-line)] focus-visible:ring-3 focus-visible:ring-ring/30",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          "disabled:opacity-50",
          className
        )}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A refusal the user can act on.
 *
 * Every unhappy state on these screens renders through this, so they
 * read the same way: what happened, then the one thing to do about it.
 */
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
