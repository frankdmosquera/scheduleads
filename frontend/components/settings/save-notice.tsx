// Frontend component: a Settings form's saved or failed message, announced, cleared on the next edit.

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";

export type SaveNoticeType = { tone: "info" | "error"; text: string } | null;

// "Saved" is announced politely from a region that is always there; a failure is an alert.
export function SaveNotice({ notice }: { notice: SaveNoticeType }) {
  return (
    <>
      <div role="status" className="mt-4 empty:hidden">
        {notice?.tone === "info" ? (
          <CentredCardNotice tone="info">{notice.text}</CentredCardNotice>
        ) : null}
      </div>
      {notice?.tone === "error" ? (
        <div className="mt-4">
          <CentredCardNotice>{notice.text}</CentredCardNotice>
        </div>
      ) : null}
    </>
  );
}
