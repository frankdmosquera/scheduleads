// Frontend component: a person's initials in a circle, as the mockups' lead rows draw them.

export function ContactInitials({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
  return (
    <span className="grid size-9 flex-none place-items-center rounded-full bg-accent text-xs font-semibold text-foreground">
      {initials || "?"}
    </span>
  );
}
