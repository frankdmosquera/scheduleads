/** @jsxImportSource react */
// Backend: a full-width tap target in the business's colour. These emails are read on a phone, and
// the button is how the reader calls back.

import type { ReactNode } from "react";
import { Button } from "@react-email/components";

export function EmailButton({
  href,
  color,
  children,
}: {
  href: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <Button
      href={href}
      style={{
        display: "block",
        marginTop: "20px",
        backgroundColor: color,
        borderRadius: "8px",
        color: "#ffffff",
        fontSize: "16px",
        fontWeight: 600,
        padding: "14px 20px",
        textAlign: "center",
        textDecoration: "none",
      }}
    >
      {children}
    </Button>
  );
}
