// Frontend component: one labelled input with its error, inside a centred card.

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// One labelled input with its error, on shadcn's Input and Label (the Forms standard). Every
// form spreads react-hook-form's Controller field into it; the error is linked for screen readers.
export function CentredCardField({
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
