// Frontend helper: is this signed-in user the platform admin (Frank)? Decides only what the
// screen shows, such as the "Set up a client" link; the API checks again on every request.

export function isPlatformAdmin(user: { role?: string | null } | null | undefined): boolean {
  return user?.role === "admin";
}
