// Frontend component: two or more choices as radios in one group, for a Settings form. The group
// carries the error and takes the focus after a refused save (a radio cannot be marked invalid).

"use client";

export function ChoiceField<Value extends string | boolean>({
  name,
  legend,
  choices,
  value,
  onChange,
  error,
}: {
  name: string;
  legend: string;
  choices: { value: Value; label: string }[];
  value: Value | undefined;
  onChange: (value: Value) => void;
  error?: string;
}) {
  return (
    <div
      role="radiogroup"
      tabIndex={-1}
      aria-labelledby={`${name}-legend`}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${name}-error` : undefined}
      className="flex flex-col gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <p id={`${name}-legend`} className="text-sm font-medium text-foreground">
        {legend}
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {choices.map((choice) => (
          <label key={String(choice.value)} className="flex items-center gap-2">
            <input
              type="radio"
              name={name}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
              className="accent-[var(--primary)]"
            />
            {choice.label}
          </label>
        ))}
      </div>
      {error ? (
        <p id={`${name}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
