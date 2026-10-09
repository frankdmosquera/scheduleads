// Frontend component: the business's first letter in a square, as the mockups' sidebar draws it.

export function BusinessInitialMark({ name }: { name: string }) {
  return (
    <span className="grid size-9 flex-none place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
