/** @jsxImportSource react */
// Backend: one labelled line of an email, "WHEN" above "Thursday, October 8 at 9:00 a.m. MDT",
// so each fact can be found at a glance on a phone.

import type { ReactNode } from "react";
import { Section, Text } from "@react-email/components";

import { emailColors } from "./email-colors.js";

export function EmailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Section style={{ marginBottom: "12px" }}>
      <Text
        style={{
          margin: "0 0 2px",
          fontSize: "11px",
          lineHeight: "16px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: emailColors.muted,
        }}
      >
        {label}
      </Text>
      <Text style={{ margin: 0, fontSize: "16px", lineHeight: "24px", color: emailColors.ink }}>
        {children}
      </Text>
    </Section>
  );
}
