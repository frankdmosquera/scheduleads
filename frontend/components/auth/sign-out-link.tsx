// Frontend component: the Sign out button. On every signed-in screen, including the
// refusals and the admin pages, so nobody is ever stuck.

"use client";

import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

export function SignOutLink({ onSignedOut }: { onSignedOut?: () => void }) {
  const router = useRouter();

  return (
    <button
      type="button"
      className="underline underline-offset-2 hover:text-foreground"
      onClick={async () => {
        await authClient.signOut();
        if (onSignedOut) onSignedOut();
        else router.push("/sign-in");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
