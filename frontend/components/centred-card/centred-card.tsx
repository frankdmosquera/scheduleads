// Frontend component: the centred card shared by sign-in, setting up a client and every refusal
// screen. Its input is centred-card-field.tsx, its notice centred-card-notice.tsx.

import type { ReactNode } from "react";

// Deliberately plain: prototypes/ has no mockup for these screens.
export function CentredCard({
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
